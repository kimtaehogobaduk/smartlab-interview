import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score using indexed map lookup for performance.
 * Time complexity: O(S + C) where S = scores.length, C = criteria.length.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  const scoreMap = new Map<string, number>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const bonus = s.bonusPoints ?? 0;
    const cappedBonus = Math.min(Math.max(bonus, 0), s.score * 0.1);
    scoreMap.set(s.criterionId, s.score + cappedBonus);
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

interface ItemWithPrimary extends LeaderboardItem {
  _primaryAverage: number;
  _perCriterionMap: Map<string, number>;
}

/**
 * Optimized buildLeaderboard implementation.
 * Performance impact: Reduces algorithm complexity from O(C*S + C*criteria*subs*scores + N log N * criteria)
 * to O(S + C * criteria + N log N) using Map lookups and precalculated primary criterion scores.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time
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

  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;

  const items: ItemWithPrimary[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const subScoreMaps: Map<string, number>[] = new Array(subs.length);

    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      const scoreMap = new Map<string, number>();
      for (let k = 0; k < s.scores.length; k++) {
        const x = s.scores[k];
        const bonus = x.bonusPoints ?? 0;
        const cappedBonus = Math.min(Math.max(bonus, 0), x.score * 0.1);
        scoreMap.set(x.criterionId, x.score + cappedBonus);
      }
      subScoreMaps[j] = scoreMap;

      if (formula === "mean") {
        let sum = 0;
        for (const scoreVal of scoreMap.values()) {
          sum += scoreVal;
        }
        totals[j] = sum / (s.scores.length || 1);
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterionMap = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);

    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      let sum = 0;
      for (let k = 0; k < subScoreMaps.length; k++) {
        sum += subScoreMaps[k].get(item.id) ?? 0;
      }
      const avg = Math.round((sum / subScoreMaps.length) * 10) / 10;
      perCriterion[j] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
      perCriterionMap.set(item.id, avg);
    }

    const finalScore = aggregate(totals, formula);
    const primaryAverage = primary ? (perCriterionMap.get(primary.id) ?? 0) : 0;

    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
      _primaryAverage: primaryAverage,
      _perCriterionMap: perCriterionMap,
    });
  }

  // O(N log N) sort using pre-calculated primaryAverage
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b._primaryAverage - a._primaryAverage;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Gold badges computation using direct object tracking
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let bestWinner: ItemWithPrimary | null = null;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const value = item._perCriterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestWinner = item;
      }
    }

    if (bestWinner && best > 0) {
      bestWinner.topCriteria.push(criterion.name);
    }
  }

  // Clean up helper properties
  for (let i = 0; i < items.length; i++) {
    delete (items[i] as Partial<ItemWithPrimary>)._primaryAverage;
    delete (items[i] as Partial<ItemWithPrimary>)._perCriterionMap;
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
