import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates effective score including bonus points cap.
 * Bonus points are capped between 0 and 10% of score.
 */
function calcEffectiveScore(score: number, bonusPoints?: number): number {
  return score + Math.min(Math.max(bonusPoints ?? 0, 0), score * 0.1);
}

/**
 * Computes weighted total score for a set of criterion scores.
 * Optimization: Uses a Map for O(1) criterion score lookup instead of O(N) array finds per item.
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
    const score = found ? calcEffectiveScore(found.score, found.bonusPoints) : 0;
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
 * Builds the candidate leaderboard for evaluation results.
 * Optimizations implemented:
 * 1. Pre-groups submissions by candidateId into a Map, turning O(C * S) candidate filtering into O(C + S).
 * 2. Pre-maps each submission's scores by criterionId for O(1) criterion lookup during per-criterion average calculation.
 * 3. Pre-extracts primary criterion averages into a Map to eliminate O(N log N * K) array finds during sorting.
 * 4. Leverages index alignment between criteria.items and item.perCriterion to eliminate O(K * N * K) linear scans during top criteria assignment.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S)
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

  // Identify primary criterion with maximum weight
  let primary: EvaluationCriterion | undefined;
  if (criteria.items.length > 0) {
    primary = criteria.items[0];
    for (let i = 1; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > primary.weight) {
        primary = criteria.items[i];
      }
    }
  }

  const items: LeaderboardItem[] = [];
  const primaryAverages: number[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Map each submission's score array by criterionId
    const subScoreMaps: Map<string, number>[] = new Array(subs.length);
    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      const s = subs[sIdx];
      const map = new Map<string, number>();
      for (let k = 0; k < s.scores.length; k++) {
        const x = s.scores[k];
        map.set(x.criterionId, calcEffectiveScore(x.score, x.bonusPoints));
      }
      subScoreMaps[sIdx] = map;
    }

    const totals: number[] = new Array(subs.length);
    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      if (formula === "mean") {
        let sum = 0;
        const scoreMap = subScoreMaps[sIdx];
        for (const val of scoreMap.values()) {
          sum += val;
        }
        totals[sIdx] = scoreMap.size > 0 ? sum / scoreMap.size : 0;
      } else {
        totals[sIdx] = subs[sIdx].totalWeightedScore;
      }
    }

    let primaryAvg = 0;
    const perCriterion = new Array(criteria.items.length);
    for (let itemIdx = 0; itemIdx < criteria.items.length; itemIdx++) {
      const item = criteria.items[itemIdx];
      let sum = 0;
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        sum += subScoreMaps[sIdx].get(item.id) ?? 0;
      }
      const average = Math.round((sum / subs.length) * 10) / 10;
      if (primary && item.id === primary.id) {
        primaryAvg = average;
      }
      perCriterion[itemIdx] = {
        criterionId: item.id,
        name: item.name,
        average,
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
    primaryAverages.push(primaryAvg);
  }

  // Pre-index primary criterion averages by candidateId to optimize sort comparison from O(K) to O(1)
  const primaryMap = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    primaryMap.set(items[i].candidateId, primaryAverages[i]);
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = primaryMap.get(a.candidateId) ?? 0;
    const bv = primaryMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Identify top candidates for each criterion.
  // Optimization: perCriterion indices align with criteria.items, giving O(1) criterion score lookup per item.
  for (let criterionIdx = 0; criterionIdx < criteria.items.length; criterionIdx++) {
    const criterion = criteria.items[criterionIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[criterionIdx]?.average ?? 0;
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
 * Optimization: Direct index lookup for perCriterion averages matching criteria.items order.
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
  const body = rows.map((r) => [
    r.rank,
    r.name,
    r.track,
    r.panelCount,
    r.finalScore,
    ...criteria.items.map((c) => {
      // Find criterion index in criteria.items to access r.perCriterion directly in O(1)
      const idx = criteria.items.findIndex((item) => item.id === c.id);
      return idx !== -1 ? (r.perCriterion[idx]?.average ?? 0) : 0;
    }),
  ]);
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
