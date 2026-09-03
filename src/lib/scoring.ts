import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for evaluation criteria.
 * Optimization: Uses Map pre-indexing for O(1) criterion lookups instead of O(N) array finds.
 * Expected Impact: Reduces score calculation time from O(Items * Scores) to O(Items + Scores).
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
 * Builds candidate leaderboard sorted by final score and primary criterion tie-breakers.
 * Performance Optimization:
 * 1. Pre-groups submissions by candidateId into a Map, eliminating O(Candidates * Submissions) filter operations.
 * 2. Pre-indexes per-submission scores into Map for O(1) criterion lookup during average aggregation.
 * 3. Uses temporary Map for tie-breaking comparison during sorting to prevent O(N log N * Criteria) array finds.
 * 4. Direct candidate reference tracking in topCriteria calculation eliminating O(Criteria * Candidates * Candidates) array searches.
 * Expected Impact: Reduces leaderboard build time from O(C * S * K * Sc + C log C * K) to O(S * Sc + C * K).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(Submissions)
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    const list = submissionsByCandidate.get(sub.candidateId);
    if (list) {
      list.push(sub);
    } else {
      submissionsByCandidate.set(sub.candidateId, [sub]);
    }
  }

  type ExtendedLeaderboardItem = LeaderboardItem & {
    perCriterionMap: Map<string, number>;
  };

  const items: ExtendedLeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Pre-calculate score maps per submission for O(1) criterion lookup
    const subsWithScoreMaps = subs.map((s) => {
      const scoreMap = new Map<string, number>();
      for (const x of s.scores) {
        const adjusted = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        scoreMap.set(x.criterionId, adjusted);
      }
      return {
        totalWeightedScore: s.totalWeightedScore,
        scoreMap,
        scoreValues: Array.from(scoreMap.values()),
      };
    });

    const totals = subsWithScoreMaps.map((s) =>
      formula === "mean" ? mean(s.scoreValues) : s.totalWeightedScore,
    );

    const perCriterionMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (const s of subsWithScoreMaps) {
        sum += s.scoreMap.get(item.id) ?? 0;
      }
      const avg = Math.round((sum / subsWithScoreMaps.length) * 10) / 10;
      perCriterionMap.set(item.id, avg);
      return {
        criterionId: item.id,
        name: item.name,
        average: avg,
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
      perCriterionMap,
      rank: 0,
      topCriteria: [],
    });
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  // Sort candidates by finalScore, tie-breaking on primary criterion average via O(1) Map lookup
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = a.perCriterionMap.get(primaryId) ?? 0;
    const bv = b.perCriterionMap.get(primaryId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Calculate top criterion per criteria item using O(1) Map lookups and direct item tracking
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: ExtendedLeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) winner.topCriteria.push(criterion.name);
  }

  // Strip temporary perCriterionMap property before returning clean LeaderboardItem array
  for (const item of items) {
    delete (item as { perCriterionMap?: Map<string, number> }).perCriterionMap;
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
