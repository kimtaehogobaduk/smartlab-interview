import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a submission using map-based criterion lookup
 * to avoid linear array searches on every criterion item.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    scoreMap.set(s.criterionId, s);
  }
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
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
    sum += values[i]!;
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
  let sum = 0;
  for (let i = 1; i < sorted.length - 1; i++) {
    sum += sorted[i]!;
  }
  return sum / (sorted.length - 2);
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
 * Builds the candidate leaderboard efficiently by:
 * 1. Pre-grouping submissions by candidateId into a Map O(S)
 * 2. Pre-calculating per-criterion scores using direct Map lookups instead of nested array `.find()` O(C * S_c * K)
 * 3. Sorting with pre-calculated primary criterion averages to eliminate `.find()` calls during comparisons O(N log N)
 * 4. Finding top criteria winners using cached maps without linear search iterations
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  if (candidates.length === 0 || submissions.length === 0) return [];

  // Pre-group submissions by candidateId (O(S) time)
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i]!;
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];
  const itemPerCriterionMaps: Map<string, number>[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx]!;
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const criterionSum = new Map<string, number>();

    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      const s = subs[sIdx]!;
      if (formula === "mean") {
        let sum = 0;
        for (let scoreIdx = 0; scoreIdx < s.scores.length; scoreIdx++) {
          const x = s.scores[scoreIdx]!;
          sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[sIdx] = s.scores.length > 0 ? sum / s.scores.length : 0;
      } else {
        totals[sIdx] = s.totalWeightedScore;
      }

      for (let scoreIdx = 0; scoreIdx < s.scores.length; scoreIdx++) {
        const x = s.scores[scoreIdx]!;
        const scoreWithBonus = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        criterionSum.set(x.criterionId, (criterionSum.get(x.criterionId) ?? 0) + scoreWithBonus);
      }
    }

    const perCriterionMap = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);

    for (let itemIdx = 0; itemIdx < criteria.items.length; itemIdx++) {
      const item = criteria.items[itemIdx]!;
      const sum = criterionSum.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      perCriterionMap.set(item.id, average);
      perCriterion[itemIdx] = {
        criterionId: item.id,
        name: item.name,
        average,
      };
    }

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
    itemPerCriterionMaps.push(perCriterionMap);
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  // Zip items with their primary average for O(1) comparison in sort
  const paired = items.map((item, idx) => ({
    item,
    criterionMap: itemPerCriterionMaps[idx]!,
    primaryAvg: primaryId ? (itemPerCriterionMaps[idx]!.get(primaryId) ?? 0) : 0,
  }));

  paired.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) return b.item.finalScore - a.item.finalScore;
    return b.primaryAvg - a.primaryAvg;
  });

  const sortedItems = paired.map((p, i) => {
    p.item.rank = i + 1;
    return p;
  });

  // Assign top criteria using cached maps without linear search
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx]!;
    let best = -1;
    let winnerPair: (typeof paired)[number] | null = null;
    for (let pIdx = 0; pIdx < sortedItems.length; pIdx++) {
      const p = sortedItems[pIdx]!;
      const value = p.criterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winnerPair = p;
      }
    }
    if (winnerPair && best > 0) {
      winnerPair.item.topCriteria.push(criterion.name);
    }
  }

  return sortedItems.map((p) => p.item);
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
    const pMap = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => pMap.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
