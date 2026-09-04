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
  // Pre-group submissions by candidateId in O(S) time to avoid O(C * S) filtering
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const criteriaItems = criteria.items;
  const numCriteria = criteriaItems.length;

  interface InternalItem {
    item: LeaderboardItem;
    primaryScore: number;
    criterionAvgMap: Map<string, number>;
  }

  // Pre-determine primary criterion with highest weight for tie-breaking
  let primaryCriterion: EvaluationCriterion | undefined;
  for (let i = 0; i < numCriteria; i++) {
    if (!primaryCriterion || criteriaItems[i].weight > primaryCriterion.weight) {
      primaryCriterion = criteriaItems[i];
    }
  }
  const primaryId = primaryCriterion?.id;

  const internalItems: InternalItem[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const numSubs = subs.length;
    const totals: number[] = new Array(numSubs);

    // Track criterion score sums in a Map to eliminate nested s.scores.find calls
    const criterionSums = new Map<string, number>();
    for (let k = 0; k < numCriteria; k++) {
      criterionSums.set(criteriaItems[k].id, 0);
    }

    for (let sIdx = 0; sIdx < numSubs; sIdx++) {
      const s = subs[sIdx];
      let subSumForMean = 0;

      const scoresList = s.scores;
      for (let scIdx = 0; scIdx < scoresList.length; scIdx++) {
        const x = scoresList[scIdx];
        const bonus = Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        const effectiveScore = x.score + bonus;

        const currentSum = criterionSums.get(x.criterionId);
        if (currentSum !== undefined) {
          criterionSums.set(x.criterionId, currentSum + effectiveScore);
        }

        if (formula === "mean") {
          subSumForMean += effectiveScore;
        }
      }

      totals[sIdx] =
        formula === "mean" ? subSumForMean / (scoresList.length || 1) : s.totalWeightedScore;
    }

    const criterionAvgMap = new Map<string, number>();
    const perCriterion = new Array(numCriteria);

    for (let k = 0; k < numCriteria; k++) {
      const item = criteriaItems[k];
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / numSubs) * 10) / 10;
      criterionAvgMap.set(item.id, average);
      perCriterion[k] = {
        criterionId: item.id,
        name: item.name,
        average,
      };
    }

    const finalScore = aggregate(totals, formula);
    const leaderboardItem: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: numSubs,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    internalItems.push({
      item: leaderboardItem,
      primaryScore: primaryId ? (criterionAvgMap.get(primaryId) ?? 0) : 0,
      criterionAvgMap,
    });
  }

  // Sort items using pre-computed primary score for O(1) comparison in sort
  internalItems.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) {
      return b.item.finalScore - a.item.finalScore;
    }
    return b.primaryScore - a.primaryScore;
  });

  const items: LeaderboardItem[] = new Array(internalItems.length);
  for (let i = 0; i < internalItems.length; i++) {
    const internal = internalItems[i];
    internal.item.rank = i + 1;
    items[i] = internal.item;
  }

  // Calculate top criteria winners in O(K * N) time without nested array searches
  for (let k = 0; k < numCriteria; k++) {
    const criterion = criteriaItems[k];
    let best = -1;
    let winnerInternal: InternalItem | null = null;

    for (let i = 0; i < internalItems.length; i++) {
      const internal = internalItems[i];
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
