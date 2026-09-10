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

/**
 * Helper to compute adjusted score including bonus points cap (max 10% of base score).
 */
function getAdjustedScore(scoreObj: { score: number; bonusPoints?: number }): number {
  return scoreObj.score + Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
}

/**
 * Optimized buildLeaderboard implementation.
 * Performance Optimizations:
 * 1. Single pass O(S) submission grouping by candidateId using Map to eliminate repeated O(C*S) filter calls.
 * 2. In-place score summations without intermediate array allocations in map/mean calls.
 * 3. Pre-computed primary criterion identification and direct winner object tracking in top criteria calculation.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidate ID in O(S)
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i]!;
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx]!;
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i]!;
      if (formula === "mean") {
        let sum = 0;
        for (let j = 0; j < s.scores.length; j++) {
          sum += getAdjustedScore(s.scores[j]!);
        }
        totals[i] = s.scores.length > 0 ? sum / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (let i = 0; i < subs.length; i++) {
        const scoreObj = subs[i]!.scores.find((x) => x.criterionId === item.id);
        if (scoreObj) {
          sum += getAdjustedScore(scoreObj);
        }
      }
      const average = Math.round((sum / subs.length) * 10) / 10;
      return {
        criterionId: item.id,
        name: item.name,
        average,
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

  // Find primary criterion (highest weight) for tie-breaking
  let primaryId = "";
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    const item = criteria.items[i]!;
    if (item.weight > maxWeight) {
      maxWeight = item.weight;
      primaryId = item.id;
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = a.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    const bv = b.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i]!.rank = i + 1;
  }

  // Identify top criteria winner per criterion in O(K * C) directly without items.find search
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i]!;
    let best = -1;
    let winner: LeaderboardItem | undefined;
    for (let j = 0; j < items.length; j++) {
      const item = items[j]!;
      const p = item.perCriterion.find((c) => c.criterionId === criterion.id);
      const value = p ? p.average : 0;
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
