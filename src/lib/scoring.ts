import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score from scores array and criterion definitions.
 * Optimization: Uses a Map for O(1) criterion lookup instead of O(M) .find() calls per item.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map(scores.map((s) => [s.criterionId, s]));
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
 * Builds and ranks leaderboard items for candidates.
 * Performance Optimization:
 * - Groups submissions by candidate ID into a Map once (reduces O(C * S) to O(C + S)).
 * - Pre-indexes submission score maps (reduces linear searches inside nested loops).
 * - Caches primary criterion average for tie-breaker sorting (reduces O(N log N * K) array finds to O(N log N)).
 * - Tracks winner object directly in top criteria calculation (eliminates O(K * N^2) search by candidateId).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Pre-calculate mapped score lookup for each submission to avoid repeated linear searches
    const submissionScoreMaps = subs.map((s) => ({
      submission: s,
      scoreMap: new Map(
        s.scores.map((x) => [
          x.criterionId,
          x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1),
        ]),
      ),
    }));

    const totals = submissionScoreMaps.map(({ submission, scoreMap }) => {
      if (formula === "mean") {
        const scores = Array.from(scoreMap.values());
        return mean(scores);
      }
      return submission.totalWeightedScore;
    });

    const perCriterion = criteria.items.map((item) => {
      const criterionScores = submissionScoreMaps.map(({ scoreMap }) => scoreMap.get(item.id) ?? 0);
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(criterionScores) * 10) / 10,
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

  // Pre-determine primary criterion and create a map for O(1) tie-breaker lookup during sorting
  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  const primaryAverageMap = new Map<string, number>();
  if (primaryId) {
    for (const item of items) {
      const p = item.perCriterion.find((c) => c.criterionId === primaryId);
      primaryAverageMap.set(item.candidateId, p?.average ?? 0);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAverageMap.get(a.candidateId) ?? 0;
    const bv = primaryAverageMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Calculate top criteria winners in O(K * N) time with direct candidate item reference
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterion.find((c) => c.criterionId === criterion.id)?.average ?? 0;
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

/**
 * Converts leaderboard items to CSV format.
 * Optimization: Uses per-item criterion Map for O(1) score lookup when generating CSV rows.
 */
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
    const criterionMap = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
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
