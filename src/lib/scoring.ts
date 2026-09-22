import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Performance-optimized calculation of weighted total score.
 * Uses Map lookup for O(1) score matching per criterion.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoresMap = new Map<string, number>();
  for (const s of scores) {
    const bonus = Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
    scoresMap.set(s.criterionId, s.score + bonus);
  }

  let total = 0;
  for (const item of items) {
    const score = scoresMap.get(item.id) ?? 0;
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
 * Performance-optimized leaderboard calculation.
 * - Pre-groups submissions by candidate ID in Map (O(S) instead of O(C * S)).
 * - Pre-maps scores per submission for O(1) criterion lookup.
 * - Pre-caches primary criterion average score for O(1) lookup during sort.
 * - Tracks winner reference directly in top criteria evaluation to eliminate O(C) search.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  // Find primary criterion (highest weight) in O(K)
  let primary: EvaluationCriterion | undefined;
  for (const item of criteria.items) {
    if (!primary || item.weight > primary.weight) {
      primary = item;
    }
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Convert submission scores to Map for O(1) criterion lookup
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const scoreObj of s.scores) {
        const bonus = Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
        map.set(scoreObj.criterionId, scoreObj.score + bonus);
      }
      return map;
    });

    const totals = subs.map((s, i) => {
      if (formula === "mean") {
        const scoreValues = Array.from(subScoreMaps[i]!.values());
        return mean(scoreValues);
      }
      return s.totalWeightedScore;
    });

    const perCriterion = criteria.items.map((item) => {
      const scoreValues = subScoreMaps.map((map) => map.get(item.id) ?? 0);
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(scoreValues) * 10) / 10,
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

  // Cache primary criterion score averages for O(1) sort comparator lookups
  const primaryId = primary?.id;
  const primaryAverages = new Map<string, number>();
  if (primaryId) {
    for (const item of items) {
      const av = item.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
      primaryAverages.set(item.candidateId, av);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAverages.get(a.candidateId) ?? 0;
    const bv = primaryAverages.get(b.candidateId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Track winner item reference directly in top criteria evaluation
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterion.find((c) => c.criterionId === criterion.id)?.average ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
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
