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
  // Optimization 1: Pre-group submissions by candidateId into a Map in O(S) time.
  // Avoids O(C * S) repeated array filtering.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // Find primary criterion (highest weight) for tie-breaker
  const primaryCriterion =
    criteria.items.length > 0
      ? criteria.items.reduce((max, c) => (c.weight > max.weight ? c : max), criteria.items[0])
      : undefined;
  const primaryId = primaryCriterion?.id;

  interface ItemWithMeta {
    item: LeaderboardItem;
    primaryAvg: number;
    perCriterionMap: Map<string, number>;
  }

  const itemInfos: ItemWithMeta[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) => {
      if (formula === "mean") {
        const effectiveScores = s.scores.map(
          (x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1),
        );
        return mean(effectiveScores);
      }
      return s.totalWeightedScore;
    });

    // Optimization 2: Single pass over candidate scores to accumulate criterion sums in O(S * K).
    // Avoids O(K * S * K) repeated array `.find()` calls for each criterion.
    const criterionSums = new Map<string, number>();
    for (const s of subs) {
      for (const scoreObj of s.scores) {
        const effective =
          scoreObj.score + Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
        criterionSums.set(
          scoreObj.criterionId,
          (criterionSums.get(scoreObj.criterionId) ?? 0) + effective,
        );
      }
    }

    const perCriterionMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      perCriterionMap.set(item.id, average);
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

    const finalScore = aggregate(totals, formula);
    const primaryAvg = primaryId ? (perCriterionMap.get(primaryId) ?? 0) : 0;

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

    itemInfos.push({
      item: leaderboardItem,
      primaryAvg,
      perCriterionMap,
    });
  }

  // Optimization 3: O(1) comparison in sort using pre-calculated primary criterion average.
  // Avoids O(K) array `.find()` inside every sort comparator call.
  itemInfos.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) return b.item.finalScore - a.item.finalScore;
    return b.primaryAvg - a.primaryAvg;
  });

  const result: LeaderboardItem[] = [];
  itemInfos.forEach((info, i) => {
    info.item.rank = i + 1;
    result.push(info.item);
  });

  // Optimization 4: Direct reference tracking for top criteria winner in O(C) per criterion.
  // Avoids O(C * K) searches and secondary O(C) candidate lookup.
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const info of itemInfos) {
      const value = info.perCriterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = info.item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
    }
  }

  return result;
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
