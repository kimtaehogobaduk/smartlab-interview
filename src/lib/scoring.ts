import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  for (const item of items) {
    const found = scores.find((s) => s.criterionId === item.id);
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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // ⚡ Optimization: Group submissions by candidateId in O(S) time instead of O(N*S)
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

  // ⚡ Optimization: Find primary criterion index in O(K) without sorting criteria array
  let primaryIndex = -1;
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    if (criteria.items[i].weight > maxWeight) {
      maxWeight = criteria.items[i].weight;
      primaryIndex = i;
    }
  }

  const itemsWithPrimary: { item: LeaderboardItem; primaryAverage: number }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    const totals: number[] = new Array(subCount);
    // ⚡ Optimization: Accumulate scores per criterion ID during a single pass over submissions
    const criterionSums = new Map<string, number>();

    for (let sIdx = 0; sIdx < subCount; sIdx++) {
      const s = subs[sIdx];
      const scores = s.scores;
      if (formula === "mean") {
        let scoreSum = 0;
        for (let scIdx = 0; scIdx < scores.length; scIdx++) {
          const x = scores[scIdx];
          const effectiveScore = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          scoreSum += effectiveScore;
          criterionSums.set(
            x.criterionId,
            (criterionSums.get(x.criterionId) ?? 0) + effectiveScore,
          );
        }
        totals[sIdx] = scores.length > 0 ? scoreSum / scores.length : 0;
      } else {
        totals[sIdx] = s.totalWeightedScore;
        for (let scIdx = 0; scIdx < scores.length; scIdx++) {
          const x = scores[scIdx];
          const effectiveScore = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          criterionSums.set(
            x.criterionId,
            (criterionSums.get(x.criterionId) ?? 0) + effectiveScore,
          );
        }
      }
    }

    // ⚡ Optimization: Pre-allocate perCriterion in criteria.items order
    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      const sum = criterionSums.get(item.id) ?? 0;
      const avg = Math.round((sum / subCount) * 10) / 10;
      perCriterion[cIdx] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    }

    const finalScore = aggregate(totals, formula);
    const primaryAvg = primaryIndex !== -1 ? perCriterion[primaryIndex].average : 0;

    const leaderboardItem: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    itemsWithPrimary.push({ item: leaderboardItem, primaryAverage: primaryAvg });
  }

  // ⚡ Optimization: Sort with pre-calculated primaryAverage (O(1) comparison instead of O(K) .find)
  itemsWithPrimary.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) {
      return b.item.finalScore - a.item.finalScore;
    }
    return b.primaryAverage - a.primaryAverage;
  });

  const resultItems: LeaderboardItem[] = new Array(itemsWithPrimary.length);
  for (let i = 0; i < itemsWithPrimary.length; i++) {
    const entry = itemsWithPrimary[i];
    entry.item.rank = i + 1;
    resultItems[i] = entry.item;
  }

  // ⚡ Optimization: Top criteria winner lookup in O(K * N) using direct array indexing & winner object tracking
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < resultItems.length; i++) {
      const item = resultItems[i];
      const value = item.perCriterion[cIdx].average;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criteria.items[cIdx].name);
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
