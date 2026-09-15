import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates total weighted score for evaluation criteria.
 * Optimized using a lookup map to avoid O(N * M) repeated array searches.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    scoreMap.set(scores[i].criterionId, scores[i]);
  }

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
 * Builds leaderboard data from candidates, submissions, and criteria configuration.
 *
 * Performance Optimizations:
 * 1. Submissions are pre-grouped by candidate ID in O(S) time using a Map, eliminating
 *    O(C * S) repeated filter scans inside candidate loop.
 * 2. Criterion score sums are accumulated in a single pass over candidate submissions,
 *    eliminating nested .find() searches and redundant array allocations per candidate.
 * 3. Primary criterion tie-breaker and top criteria winners are indexed directly,
 *    reducing overall complexity from O(C * S * K^2 + C * K^2) to O(S * K + C * K + C log C).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidate ID
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const criterionSums = new Map<string, number>();

    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (formula === "mean") {
        let scoreSum = 0;
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          const score = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          scoreSum += score;
        }
        totals[i] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }

      for (let j = 0; j < s.scores.length; j++) {
        const x = s.scores[j];
        const score = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + score);
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let k = 0; k < criteria.items.length; k++) {
      const item = criteria.items[k];
      const sum = criterionSums.get(item.id) ?? 0;
      const avg = sum / subs.length;
      perCriterion[k] = {
        criterionId: item.id,
        name: item.name,
        average: Math.round(avg * 10) / 10,
      };
    }

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

  // Determine primary criterion and its index for tie-breaker sorting
  let primaryIndex = -1;
  let maxWeight = -1;
  for (let k = 0; k < criteria.items.length; k++) {
    if (criteria.items[k].weight > maxWeight) {
      maxWeight = criteria.items[k].weight;
      primaryIndex = k;
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIndex === -1) return 0;
    const av = a.perCriterion[primaryIndex]?.average ?? 0;
    const bv = b.perCriterion[primaryIndex]?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Identify top criteria winners directly by criterion index
  for (let k = 0; k < criteria.items.length; k++) {
    const criterion = criteria.items[k];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[k]?.average ?? 0;
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
