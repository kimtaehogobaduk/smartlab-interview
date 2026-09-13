import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Performance Optimization:
 * Pre-constructs a score lookup Map (O(K) setup) to calculate weighted total in O(M) time
 * instead of linear array searches O(M * K).
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { criterionId: string; score: number; bonusPoints?: number }>();
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
 * Performance Optimization:
 * 1. Pre-groups submissions by `candidateId` into a Map (O(S) setup, O(1) lookup vs O(C * S) filtering).
 * 2. Uses score Map per submission for O(1) criterion score lookup instead of O(K) `.find`.
 * 3. Accesses `perCriterion` by direct index `[cIndex]` (O(1) vs O(M) `.find`).
 * 4. Tracks best candidate object directly to eliminate O(C) array search by ID.
 * Expected Performance Impact: Reduces leaderboard build complexity from O(C * S * M * K + M^2 * C) to O(S + C * S * M).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const score of s.scores) {
        const value =
          score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
        map.set(score.criterionId, value);
      }
      return map;
    });

    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (const map of subScoreMaps) {
        sum += map.get(item.id) ?? 0;
      }
      const avg = subScoreMaps.length > 0 ? sum / subScoreMaps.length : 0;
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(avg * 10) / 10,
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
    });
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = a.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    const bv = b.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  criteria.items.forEach((criterion, cIndex) => {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterion[cIndex]?.average ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
    }
  });

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
