import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score from score items and criterion definitions.
 * Optimized with Map indexing to perform O(1) score lookup per criterion.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    scoreMap.set(s.criterionId, s);
  }

  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const found = scoreMap.get(item.id);
    const score = found
      ? found.score + Math.min(Math.max(found.bonusPoints ?? 0, 0), found.score * 0.1)
      : 0;
    total += (score * item.weight) / 100;
  }
  return Math.round(total * 10) / 10;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function trimmed(values: number[]): number {
  if (values.length < 3) return mean(values);
  const sorted = [...values].sort((a, b) => a - b);
  return mean(sorted.slice(1, -1));
}

export function aggregate(values: number[], formula: Formula): number {
  const raw =
    formula === "trimmed" ? trimmed(values) : formula === "median" ? median(values) : mean(values);
  return Math.round(raw * 10) / 10;
}

export interface LeaderboardItem {
  candidateId: string;
  name: string;
  track: string;
  panelCount: number;
  finalScore: number;
  perCriterion: { criterionId: string; name: string; average: number }[];
  rank: number;
  topCriteria: string[];
}

/**
 * Builds leaderboard rankings and criterion averages for all candidates.
 * Optimized from O(C * S * K) to O(S + C * K) using submission grouping,
 * score indexing, cached primary tie-break averages, and direct winner tracking.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId upfront into a Map (O(S) instead of O(C * S))
  const submissionsMap = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let candidateSubs = submissionsMap.get(sub.candidateId);
    if (!candidateSubs) {
      candidateSubs = [];
      submissionsMap.set(sub.candidateId, candidateSubs);
    }
    candidateSubs.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsMap.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Pre-map scores per submission for O(1) criterion score lookups
    const mappedSubs = subs.map((s) => {
      const scoreMap = new Map<string, number>();
      for (let j = 0; j < s.scores.length; j++) {
        const sc = s.scores[j];
        const val = sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
        scoreMap.set(sc.criterionId, val);
      }
      return {
        totalWeightedScore: s.totalWeightedScore,
        scoreMap,
      };
    });

    const totals = mappedSubs.map((s) =>
      formula === "mean" ? mean(Array.from(s.scoreMap.values())) : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => {
      const criterionScores = mappedSubs.map((s) => s.scoreMap.get(item.id) ?? 0);
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(criterionScores) * 10) / 10,
      };
    });

    const finalScore = aggregate(totals, formula);
    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  // Pre-calculate primary criterion ID for fast tie-breaking
  let primaryId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > maxWeight) {
        maxWeight = criteria.items[i].weight;
        primaryId = criteria.items[i].id;
      }
    }
  }

  // Pre-calculate primary average per leaderboard item to avoid linear finds during sort
  const primaryAverages = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const match = item.perCriterion.find((c) => c.criterionId === primaryId);
      primaryAverages.set(item.candidateId, match ? match.average : 0);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAverages.get(a.candidateId) ?? 0;
    const bv = primaryAverages.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Track top criteria winners directly without redundant array searches
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let bestWinner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      for (let k = 0; k < item.perCriterion.length; k++) {
        if (item.perCriterion[k].criterionId === criterion.id) {
          value = item.perCriterion[k].average;
          break;
        }
      }
      if (value > best) {
        best = value;
        bestWinner = item;
      }
    }
    if (bestWinner && best > 0) {
      bestWinner.topCriteria.push(criterion.name);
    }
  }

  return items;
}

export function toCsv(rows: LeaderboardItem[], criteria: CriteriaConfig): string {
  const header = [
    "순위",
    "이름",
    "트랙",
    "면접관수",
    "최종점수",
    ...criteria.items.map((c) => `${c.name}(${c.weight}%)`),
  ];
  const body = rows.map((r) => [
    r.rank,
    r.name,
    r.track,
    r.panelCount,
    r.finalScore,
    ...criteria.items.map((c) => r.perCriterion.find((p) => p.criterionId === c.id)?.average ?? 0),
  ]);
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
