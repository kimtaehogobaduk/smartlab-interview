import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates total weighted score.
 * Optimization: Uses Map for O(1) criterion lookup instead of O(M) Array.find().
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

/**
 * Builds the candidate leaderboard.
 * Optimization: Replaced O(C * S) array filter and nested O(M * N) linear searches with Map-based indexing.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId: O(S) instead of O(C * S)
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

  interface InternalItem {
    item: LeaderboardItem;
    criterionMap: Map<string, number>;
  }

  const internalItems: InternalItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Index effective scores per submission for O(1) criterion lookups
    const indexedSubScores: Map<string, number>[] = new Array(subs.length);
    for (let s = 0; s < subs.length; s++) {
      const sub = subs[s];
      const map = new Map<string, number>();
      for (let sc = 0; sc < sub.scores.length; sc++) {
        const itemScore = sub.scores[sc];
        const effective =
          itemScore.score +
          Math.min(Math.max(itemScore.bonusPoints ?? 0, 0), itemScore.score * 0.1);
        map.set(itemScore.criterionId, effective);
      }
      indexedSubScores[s] = map;
    }

    const totals: number[] = new Array(subs.length);
    for (let s = 0; s < subs.length; s++) {
      if (formula === "mean") {
        totals[s] = mean(Array.from(indexedSubScores[s].values()));
      } else {
        totals[s] = subs[s].totalWeightedScore;
      }
    }

    const perCriterionMap = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);
    for (let c = 0; c < criteria.items.length; c++) {
      const item = criteria.items[c];
      let sum = 0;
      for (let s = 0; s < indexedSubScores.length; s++) {
        sum += indexedSubScores[s].get(item.id) ?? 0;
      }
      const avg = Math.round((sum / subs.length) * 10) / 10;
      perCriterionMap.set(item.id, avg);
      perCriterion[c] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    }

    const finalScore = aggregate(totals, formula);
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

    internalItems.push({ item: leaderboardItem, criterionMap: perCriterionMap });
  }

  // Find primary criterion by max weight in single pass: O(M)
  let primary: EvaluationCriterion | undefined;
  for (let i = 0; i < criteria.items.length; i++) {
    if (!primary || criteria.items[i].weight > primary.weight) {
      primary = criteria.items[i];
    }
  }

  const primaryId = primary?.id;
  internalItems.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) return b.item.finalScore - a.item.finalScore;
    if (!primaryId) return 0;
    const av = a.criterionMap.get(primaryId) ?? 0;
    const bv = b.criterionMap.get(primaryId) ?? 0;
    return bv - av;
  });

  const resultItems: LeaderboardItem[] = new Array(internalItems.length);
  for (let i = 0; i < internalItems.length; i++) {
    const item = internalItems[i].item;
    item.rank = i + 1;
    resultItems[i] = item;
  }

  // Calculate top criteria winners in O(M * N) without redundant Array.find()
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < internalItems.length; i++) {
      const value = internalItems[i].criterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = internalItems[i].item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
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
  const body = rows.map((r) => {
    const criterionMap = new Map<string, number>();
    for (let i = 0; i < r.perCriterion.length; i++) {
      criterionMap.set(r.perCriterion[i].criterionId, r.perCriterion[i].average);
    }
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
