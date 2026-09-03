import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculate weighted total score for an evaluation submission.
 * Optimized using a Map for O(1) score lookup instead of O(N) Array.find.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  // Map criterionId to calculated score with capped bonus
  const scoreMap = new Map<string, number>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const bonus = Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
    scoreMap.set(s.criterionId, s.score + bonus);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreMap.get(item.id) ?? 0;
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
 * Builds leaderboard rankings and criterion breakdowns for candidates.
 *
 * Performance Optimizations:
 * 1. Submissions are pre-grouped by candidate ID into a Map, reducing filtering from O(C * S) to O(S + C).
 * 2. Per-criterion score computations and effective score maps are computed in a single pass per submission.
 * 3. Criterion average lookups and top criteria winner selection use direct Map lookups and references instead of repeated Array.find calls.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId
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

  const items: LeaderboardItem[] = [];
  const itemMapByCandidateId = new Map<string, LeaderboardItem>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const panelCount = subs.length;
    const totals: number[] = new Array(panelCount);

    // Pre-calculate Effective Score per criterion for each submission
    // criterionSums maps criterionId -> sum of effective scores across all panel submissions
    const criterionSums = new Map<string, number>();

    for (let sIdx = 0; sIdx < panelCount; sIdx++) {
      const sub = subs[sIdx];
      let subMeanSum = 0;

      for (let scIdx = 0; scIdx < sub.scores.length; scIdx++) {
        const sc = sub.scores[scIdx];
        const effectiveScore =
          sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
        subMeanSum += effectiveScore;
        criterionSums.set(
          sc.criterionId,
          (criterionSums.get(sc.criterionId) ?? 0) + effectiveScore,
        );
      }

      totals[sIdx] =
        formula === "mean"
          ? sub.scores.length > 0
            ? subMeanSum / sub.scores.length
            : 0
          : sub.totalWeightedScore;
    }

    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / panelCount) * 10) / 10;
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

    const finalScore = aggregate(totals, formula);
    const item: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    items.push(item);
    itemMapByCandidateId.set(candidate.id, item);
  }

  // Find primary criterion (highest weight) for tie breaking
  let primary: EvaluationCriterion | undefined;
  if (criteria.items.length > 0) {
    primary = criteria.items[0];
    for (let i = 1; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > primary.weight) {
        primary = criteria.items[i];
      }
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = a.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
    const bv = b.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Identify top candidate per criterion
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | undefined;

    for (let iIdx = 0; iIdx < items.length; iIdx++) {
      const item = items[iIdx];
      let value = 0;
      for (let pIdx = 0; pIdx < item.perCriterion.length; pIdx++) {
        if (item.perCriterion[pIdx].criterionId === criterion.id) {
          value = item.perCriterion[pIdx].average;
          break;
        }
      }
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
