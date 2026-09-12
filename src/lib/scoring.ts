import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score across criteria.
 * Optimized with Map lookup (O(1)) instead of Array.find (O(N)).
 * Expected performance impact: Reduces score calculation overhead.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (const s of scores) {
    scoreMap.set(s.criterionId, s);
  }
  let total = 0;
  for (const item of items) {
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
 * Builds candidate leaderboard with aggregate scores and criteria averages.
 * Optimized by pre-grouping submissions by candidateId in O(S) time and indexing score maps,
 * reducing time complexity from O(C * S * K^2) to O(C * S + C * K).
 * Expected performance impact: Faster leaderboard calculations for large candidate and submission sets.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidate ID in O(S) time
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    // Index criteria scores per submission to avoid repeated inner Array.find calls
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const scoreObj of s.scores) {
        const effective =
          scoreObj.score + Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
        map.set(scoreObj.criterionId, effective);
      }
      return map;
    });

    const perCriterion = criteria.items.map((item) => ({
      criterionId: item.id,
      name: item.name,
      average: Math.round(mean(subScoreMaps.map((map) => map.get(item.id) ?? 0)) * 10) / 10,
    }));

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

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = a.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
    const bv = b.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
    return bv - av;
  });
  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const cObj = item.perCriterion.find((c) => c.criterionId === criterion.id);
      const value = cObj ? cObj.average : 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) winner.topCriteria.push(criterion.name);
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
  const body = rows.map((r) => {
    const criterionMap = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => criterionMap.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
