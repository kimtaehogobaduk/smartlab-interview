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
  // Optimization: Pre-group submissions by candidateId into a Map in O(S) time.
  // Prevents repeated array filtering O(C * S) over candidates and submissions.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i]!;
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  // Helper function to calculate effective score for a criterion score entry including bonus cap
  const getEffectiveScore = (x: { score: number; bonusPoints?: number }) =>
    x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);

  // Map to store perCriterion averages for direct O(1) lookups: Map<candidateId, Map<criterionId, number>>
  const criterionScoresByCandidate = new Map<string, Map<string, number>>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j]!;
      if (formula === "mean") {
        let sum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          sum += getEffectiveScore(s.scores[k]!);
        }
        totals[j] = mean([sum / (s.scores.length || 1)]);
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const candidateCriterionMap = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);

    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j]!;
      let criterionSum = 0;
      for (let k = 0; k < subs.length; k++) {
        const scores = subs[k]!.scores;
        for (let l = 0; l < scores.length; l++) {
          if (scores[l]!.criterionId === item.id) {
            criterionSum += getEffectiveScore(scores[l]!);
            break;
          }
        }
      }
      const avg = Math.round((criterionSum / subs.length) * 10) / 10;
      perCriterion[j] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
      candidateCriterionMap.set(item.id, avg);
    }

    criterionScoresByCandidate.set(candidate.id, candidateCriterionMap);

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

  // Optimization: Identify primary criterion weight tiebreaker
  let primaryCriterionId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i]!.weight > maxWeight) {
        maxWeight = criteria.items[i]!.weight;
        primaryCriterionId = criteria.items[i]!.id;
      }
    }
  }

  // Optimization: Sort items with O(1) criterion score lookups instead of .find()
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryCriterionId) return 0;
    const av = criterionScoresByCandidate.get(a.candidateId)?.get(primaryCriterionId) ?? 0;
    const bv = criterionScoresByCandidate.get(b.candidateId)?.get(primaryCriterionId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i]!.rank = i + 1;
  }

  // Map candidateId to item for O(1) winner assignment
  const itemByCandidateId = new Map<string, LeaderboardItem>();
  for (let i = 0; i < items.length; i++) {
    itemByCandidateId.set(items[i]!.candidateId, items[i]!);
  }

  // Optimization: Determine top criteria per criterion in O(C) lookups per criterion
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i]!;
    let best = -1;
    let bestId = "";

    for (let j = 0; j < items.length; j++) {
      const candId = items[j]!.candidateId;
      const value = criterionScoresByCandidate.get(candId)?.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestId = candId;
      }
    }

    if (bestId && best > 0) {
      const winner = itemByCandidateId.get(bestId);
      if (winner) winner.topCriteria.push(criterion.name);
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
