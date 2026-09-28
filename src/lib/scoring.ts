import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score.
 * Performance: Uses Map lookup for O(1) score retrieval per criterion instead of O(M) linear search.
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
 * Builds leaderboard data from candidates, submissions, and criteria.
 * Optimizations:
 * 1. Groups submissions by candidateId in O(S) upfront instead of O(C * S) candidate filtering.
 * 2. Avoids temporary array allocations during mean/perCriterion accumulation.
 * 3. Pre-calculates primary criterion averages into a Map for O(1) tie-breaker sorting comparisons.
 * 4. Tracks winning LeaderboardItem directly during criterion iteration to avoid O(N) array scans.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  const items: LeaderboardItem[] = [];

  // Group submissions by candidateId upfront: O(S)
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // Find primary criterion with highest weight: O(K)
  let primary: EvaluationCriterion | undefined;
  for (let i = 0; i < criteria.items.length; i++) {
    const item = criteria.items[i];
    if (!primary || item.weight > primary.weight) {
      primary = item;
    }
  }

  const primaryAvgMap = new Map<string, number>();
  const criterionAvgMap = new Map<string, Map<string, number>>();

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (formula === "mean") {
        let sum = 0;
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[i] = s.scores.length > 0 ? sum / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    const candidateCriterionMap = new Map<string, number>();

    for (let k = 0; k < criteria.items.length; k++) {
      const item = criteria.items[k];
      let sum = 0;

      for (let i = 0; i < subs.length; i++) {
        const scores = subs[i].scores;
        for (let j = 0; j < scores.length; j++) {
          if (scores[j].criterionId === item.id) {
            const score = scores[j];
            sum += score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
            break;
          }
        }
      }

      const average = Math.round((sum / subs.length) * 10) / 10;
      perCriterion[k] = {
        criterionId: item.id,
        name: item.name,
        average,
      };

      candidateCriterionMap.set(item.id, average);
      if (primary && item.id === primary.id) {
        primaryAvgMap.set(candidate.id, average);
      }
    }

    criterionAvgMap.set(candidate.id, candidateCriterionMap);

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

  // O(N log N) sorting with O(1) comparator lookups
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = primaryAvgMap.get(a.candidateId) ?? 0;
    const bv = primaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Determine top candidates per criterion in O(K * N) without O(N) inner array searches
  for (let k = 0; k < criteria.items.length; k++) {
    const criterion = criteria.items[k];
    let bestVal = -1;
    let bestItem: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const val = criterionAvgMap.get(item.candidateId)?.get(criterion.id) ?? 0;
      if (val > bestVal) {
        bestVal = val;
        bestItem = item;
      }
    }

    if (bestItem && bestVal > 0) {
      bestItem.topCriteria.push(criterion.name);
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
  const body = rows.map((r) => {
    const pMap = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => pMap.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
