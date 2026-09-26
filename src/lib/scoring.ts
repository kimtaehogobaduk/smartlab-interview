import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * BOLT OPTIMIZATION:
 * Uses Map lookup for criterionId instead of O(N) array search per item.
 * Reduces overall complexity from O(items * scores) to O(scores + items).
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
 * BOLT OPTIMIZATION:
 * 1. Group submissions by candidateId upfront using a Map O(S), replacing O(C*S) array filters.
 * 2. Single-pass score aggregation per candidate instead of repeated nested score lookups.
 * 3. Store perCriterion map on intermediate items to avoid linear searches during sorting and top criteria extraction.
 * 4. Directly reference winning candidate item for top criteria, eliminating redundant `items.find()` calls.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // 1. Group submissions by candidateId: O(S)
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  interface InternalItem extends LeaderboardItem {
    criterionMap: Map<string, number>;
  }

  const items: InternalItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = [];
    const criterionSumMap = new Map<string, number>();

    for (const s of subs) {
      if (formula === "mean") {
        let sum = 0;
        for (const scoreObj of s.scores) {
          const bonus = Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
          const scoreVal = scoreObj.score + bonus;
          sum += scoreVal;
          criterionSumMap.set(
            scoreObj.criterionId,
            (criterionSumMap.get(scoreObj.criterionId) ?? 0) + scoreVal,
          );
        }
        totals.push(mean(s.scores.length > 0 ? [sum / s.scores.length] : []));
      } else {
        totals.push(s.totalWeightedScore);
        for (const scoreObj of s.scores) {
          const bonus = Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
          const scoreVal = scoreObj.score + bonus;
          criterionSumMap.set(
            scoreObj.criterionId,
            (criterionSumMap.get(scoreObj.criterionId) ?? 0) + scoreVal,
          );
        }
      }
    }

    const criterionMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSumMap.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      criterionMap.set(item.id, average);
      return {
        criterionId: item.id,
        name: item.name,
        average,
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
      criterionMap,
    });
  }

  let primaryId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (const item of criteria.items) {
      if (item.weight > maxWeight) {
        maxWeight = item.weight;
        primaryId = item.id;
      }
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = a.criterionMap.get(primaryId) ?? 0;
    const bv = b.criterionMap.get(primaryId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  for (const criterion of criteria.items) {
    let best = -1;
    let winner: InternalItem | null = null;
    for (const item of items) {
      const value = item.criterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
    }
  }

  // Clean up internal property
  return items.map(({ criterionMap: _, ...publicItem }) => publicItem);
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
    const map = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => map.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
