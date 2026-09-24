import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score based on scores and criterion weights.
 * Performance optimized: Uses a Map for O(1) criterion lookup instead of repeated array.find().
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    scoreMap.set(s.criterionId, s);
  }

  let total = 0;
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

function meanValues(sum: number, count: number): number {
  if (count === 0) return 0;
  return sum / count;
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
 * Builds the leaderboard items from candidates, submissions, and criteria config.
 *
 * Performance Optimizations:
 * 1. Pre-groups submissions by candidateId into a Map O(S) instead of O(N*S) array filtering.
 * 2. Pre-indexes submission scores into Maps to turn O(K * S * |scores|) searches into O(1) lookups.
 * 3. Pre-computes primary criterion averages prior to sorting to eliminate O(K) array searches inside sort comparator.
 * 4. Direct reference tracking in topCriteria determination to eliminate nested candidate lookup.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in a single O(S) pass
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let group = submissionsByCandidate.get(sub.candidateId);
    if (!group) {
      group = [];
      submissionsByCandidate.set(sub.candidateId, group);
    }
    group.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const subScoreMaps: Map<string, number>[] = new Array(subs.length);

    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      const scoreMap = new Map<string, number>();
      let sum = 0;

      for (let k = 0; k < s.scores.length; k++) {
        const x = s.scores[k];
        const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        scoreMap.set(x.criterionId, val);
        sum += val;
      }
      subScoreMaps[j] = scoreMap;

      if (formula === "mean") {
        totals[j] = meanValues(sum, s.scores.length);
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      let sum = 0;
      for (let k = 0; k < subs.length; k++) {
        const val = subScoreMaps[k].get(item.id);
        if (val !== undefined) {
          sum += val;
        }
      }
      const avg = Math.round(meanValues(sum, subs.length) * 10) / 10;
      perCriterion[j] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
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

  // Find primary criterion ID for tie breaking
  let primaryId: string | null = null;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > maxWeight) {
        maxWeight = criteria.items[i].weight;
        primaryId = criteria.items[i].id;
      }
    }
  }

  // Pre-calculate primary criterion scores for O(1) comparison in sort
  const primaryScores = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let val = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === primaryId) {
          val = item.perCriterion[j].average;
          break;
        }
      }
      primaryScores.set(item.candidateId, val);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryScores.get(a.candidateId) ?? 0;
    const bv = primaryScores.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Assign top criteria winners directly without nested array finds
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winnerItem: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let val = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === criterion.id) {
          val = item.perCriterion[j].average;
          break;
        }
      }
      if (val > best) {
        best = val;
        winnerItem = item;
      }
    }

    if (winnerItem && best > 0) {
      winnerItem.topCriteria.push(criterion.name);
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
