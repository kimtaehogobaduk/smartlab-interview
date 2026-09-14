import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a submission.
 * Performance: Pre-indexes scores in a Map to achieve O(M) time complexity (M = criteria count)
 * instead of O(N * M) nested find() searches.
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
 * Builds and ranks leaderboard items for candidates.
 * Performance: Optimizes O(C * S * M) nested array searches down to O(S + C * M)
 * by pre-grouping submissions, indexing scores, and tracking winner references directly.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId in O(S) time
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

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      const s = subs[sIdx];
      if (formula === "mean") {
        let scoreSum = 0;
        for (let scoreIdx = 0; scoreIdx < s.scores.length; scoreIdx++) {
          const x = s.scores[scoreIdx];
          scoreSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[sIdx] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[sIdx] = s.totalWeightedScore;
      }
    }

    // Pre-calculate score maps per submission for O(1) criterion score lookup
    const subScoreMaps: Map<string, { score: number; bonusPoints?: number }>[] = new Array(
      subs.length,
    );
    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
      const scores = subs[sIdx].scores;
      for (let scIdx = 0; scIdx < scores.length; scIdx++) {
        scoreMap.set(scores[scIdx].criterionId, scores[scIdx]);
      }
      subScoreMaps[sIdx] = scoreMap;
    }

    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      let sum = 0;
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const score = subScoreMaps[sIdx].get(item.id);
        if (score) {
          sum += score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
        }
      }
      const avg = subs.length > 0 ? sum / subs.length : 0;
      perCriterion[cIdx] = {
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

  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;

  // Pre-index primary criterion score per item to avoid O(M) find() in sorting comparisons
  const primaryValueMap = new Map<string, number>();
  if (primary) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let primaryVal = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === primary.id) {
          primaryVal = item.perCriterion[j].average;
          break;
        }
      }
      primaryValueMap.set(item.candidateId, primaryVal);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = primaryValueMap.get(a.candidateId) ?? 0;
    const bv = primaryValueMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Assign top criteria using direct winner item references
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === criterion.id) {
          value = item.perCriterion[j].average;
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
