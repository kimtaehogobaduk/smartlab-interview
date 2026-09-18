import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a single evaluation.
 * Optimized with Map lookup for O(1) criterion matching instead of O(N) array search.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    scoreMap.set(scores[i].criterionId, scores[i]);
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
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
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

interface InternalLeaderboardItem extends LeaderboardItem {
  criterionAvgMap: Record<string, number>;
}

/**
 * Builds the ranking leaderboard for candidates based on submissions and criteria.
 * Optimized:
 * 1. Pre-groups submissions by candidateId in O(M) time to avoid O(N * M) filtering.
 * 2. Pre-indexes submission scores by criterionId for O(1) lookups during average calculations.
 * 3. Eliminates O(C) array searches in tie-breaking comparator and top-performer loops.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // 1. Group submissions by candidateId in O(M) time
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: InternalLeaderboardItem[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Index scores per submission for O(1) criterion lookup
    const mappedSubs = subs.map((s) => {
      const scoreMap = new Map<string, number>();
      for (let j = 0; j < s.scores.length; j++) {
        const x = s.scores[j];
        const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        scoreMap.set(x.criterionId, val);
      }
      return {
        raw: s,
        scoreMap,
        meanScore: formula === "mean" ? mean(Array.from(scoreMap.values())) : 0,
      };
    });

    const totals = mappedSubs.map((ms) =>
      formula === "mean" ? ms.meanScore : ms.raw.totalWeightedScore,
    );

    const criterionAvgMap: Record<string, number> = {};
    const perCriterion = criteria.items.map((item) => {
      const scoresForItem = mappedSubs.map((ms) => ms.scoreMap.get(item.id) ?? 0);
      const avg = Math.round(mean(scoresForItem) * 10) / 10;
      criterionAvgMap[item.id] = avg;
      return {
        criterionId: item.id,
        name: item.name,
        average: avg,
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
      criterionAvgMap,
    });
  }

  // Find primary (highest weighted) criterion ID
  let primaryCriterionId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > maxWeight) {
        maxWeight = criteria.items[i].weight;
        primaryCriterionId = criteria.items[i].id;
      }
    }
  }

  // Sort leaderboard items with O(1) primary criterion tie-breaking
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryCriterionId) return 0;
    const av = a.criterionAvgMap[primaryCriterionId] ?? 0;
    const bv = b.criterionAvgMap[primaryCriterionId] ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Identify top performers for each criterion in O(C * K)
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winner: InternalLeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.criterionAvgMap[criterion.id] ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
    }
  }

  // Strip internal lookup maps before returning
  return items.map(({ criterionAvgMap, ...rest }) => rest);
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
