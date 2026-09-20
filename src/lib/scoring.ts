import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a candidate across evaluation criteria.
 * Optimized with Map lookup (O(N) instead of O(N^2)).
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
 * Builds and ranks leaderboard entries for candidates based on submissions and criteria.
 *
 * Performance Optimizations:
 * 1. Submissions grouped by candidateId using a Map (O(S) setup, O(1) candidate lookup instead of O(C * S)).
 * 2. Single-pass score aggregation per candidate per submission using Maps (O(S * scores) instead of O(Criteria * S * scores)).
 * 3. Primary criterion score and criterion average Map cached per item for O(1) tie-breaker sorting and top-criteria calculation.
 * 4. Winner lookup reference for O(1) top criteria assignment (eliminating O(N) array finds).
 * Expected Impact: Reduces leaderboard build complexity from O(C * S * K + N log N * K) to O(S + C * K + N log N).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];

  interface InternalItem {
    item: LeaderboardItem;
    primaryAverage: number;
    criterionAvgMap: Map<string, number>;
  }

  const internalItems: InternalItem[] = [];

  for (let cIndex = 0; cIndex < candidates.length; cIndex++) {
    const candidate = candidates[cIndex];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const criterionSumMap = new Map<string, number>();

    for (let sIndex = 0; sIndex < subs.length; sIndex++) {
      const s = subs[sIndex];
      const scores = s.scores;

      if (formula === "mean") {
        let sumScore = 0;
        for (let scIndex = 0; scIndex < scores.length; scIndex++) {
          const x = scores[scIndex];
          const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          sumScore += val;
          criterionSumMap.set(x.criterionId, (criterionSumMap.get(x.criterionId) ?? 0) + val);
        }
        totals[sIndex] = scores.length > 0 ? sumScore / scores.length : 0;
      } else {
        totals[sIndex] = s.totalWeightedScore;
        for (let scIndex = 0; scIndex < scores.length; scIndex++) {
          const x = scores[scIndex];
          const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          criterionSumMap.set(x.criterionId, (criterionSumMap.get(x.criterionId) ?? 0) + val);
        }
      }
    }

    const criterionAvgMap = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);

    for (let ci = 0; ci < criteria.items.length; ci++) {
      const item = criteria.items[ci];
      const sum = criterionSumMap.get(item.id) ?? 0;
      const avg = Math.round((sum / subs.length) * 10) / 10;
      criterionAvgMap.set(item.id, avg);
      perCriterion[ci] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    }

    const finalScore = aggregate(totals, formula);
    const primaryAverage = primary ? (criterionAvgMap.get(primary.id) ?? 0) : 0;

    const leaderboardItem: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    internalItems.push({
      item: leaderboardItem,
      primaryAverage,
      criterionAvgMap,
    });
  }

  // Sort candidates by finalScore desc, tie-breaker on primary criterion average
  internalItems.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) {
      return b.item.finalScore - a.item.finalScore;
    }
    return b.primaryAverage - a.primaryAverage;
  });

  const resultItems: LeaderboardItem[] = new Array(internalItems.length);
  for (let i = 0; i < internalItems.length; i++) {
    const internal = internalItems[i];
    internal.item.rank = i + 1;
    resultItems[i] = internal.item;
  }

  // Calculate top criteria per item
  for (let ci = 0; ci < criteria.items.length; ci++) {
    const criterion = criteria.items[ci];
    let best = -1;
    let winnerInternal: InternalItem | null = null;

    for (let ii = 0; ii < internalItems.length; ii++) {
      const internal = internalItems[ii];
      const value = internal.criterionAvgMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winnerInternal = internal;
      }
    }

    if (winnerInternal && best > 0) {
      winnerInternal.item.topCriteria.push(criterion.name);
    }
  }

  return resultItems;
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
