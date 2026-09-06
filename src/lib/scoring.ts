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
  // Optimization 1: Group submissions by candidateId in O(S) time upfront
  // avoids repeatedly filtering the submissions array O(C * S) times.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  // Map to store criterion average per candidate for O(1) tie-breaker and winner lookups
  // key: candidateId -> Map<criterionId, averageScore>
  const candidateCritMap = new Map<string, Map<string, number>>();

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = [];
    const critSums = new Map<string, number>();

    // Optimization 2: Accumulate criterion scores in a single pass over candidate's submissions
    // replacing nested Array.find calls for each criterion and each submission.
    for (const sub of subs) {
      if (formula === "mean") {
        let subSum = 0;
        for (const s of sub.scores) {
          const adj = s.score + Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
          subSum += adj;
          critSums.set(s.criterionId, (critSums.get(s.criterionId) ?? 0) + adj);
        }
        totals.push(sub.scores.length > 0 ? subSum / sub.scores.length : 0);
      } else {
        totals.push(sub.totalWeightedScore);
        for (const s of sub.scores) {
          const adj = s.score + Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
          critSums.set(s.criterionId, (critSums.get(s.criterionId) ?? 0) + adj);
        }
      }
    }

    const critAvgMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const sum = critSums.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      critAvgMap.set(item.id, average);
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

    candidateCritMap.set(candidate.id, critAvgMap);

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

  // Optimization 3: Pre-extract primary criterion ID for O(1) tie-breaking during sort,
  // avoiding repeated Array.find calls inside the sort comparator.
  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = candidateCritMap.get(a.candidateId)?.get(primaryId) ?? 0;
    const bv = candidateCritMap.get(b.candidateId)?.get(primaryId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Optimization 4: Hold direct reference to winning item when evaluating top criteria
  // eliminating redundant Array.find calls over all items for each criterion.
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = candidateCritMap.get(item.candidateId)?.get(criterion.id) ?? 0;
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
