import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a candidate across criteria.
 * Uses a Map for O(1) criterion lookup to avoid repeated array searches.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    scoreMap.set(s.criterionId, s);
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
 * Builds and ranks leaderboard items for candidates based on submissions and evaluation criteria.
 * Optimized with Map-based indexing to eliminate O(N*S) array filtering and O(N log N) nested searches.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId: Map<candidateId, EvaluationSubmission[]>
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

  const items: LeaderboardItem[] = [];

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    // Pre-index scores for each submission into Map for O(1) criterion lookup
    const subScoresMaps = subs.map((s) => {
      const m = new Map<string, { score: number; bonusPoints?: number }>();
      for (let i = 0; i < s.scores.length; i++) {
        const sc = s.scores[i];
        m.set(sc.criterionId, sc);
      }
      return m;
    });

    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (let i = 0; i < subScoresMaps.length; i++) {
        const score = subScoresMaps[i].get(item.id);
        if (score) {
          sum += score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
        }
      }
      const avg = subScoresMaps.length > 0 ? sum / subScoresMaps.length : 0;
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(avg * 10) / 10,
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

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];

  // Pre-index primary criterion average score per candidate to avoid .find inside sort comparator
  const itemPrimaryScores = new Map<string, number>();
  if (primary) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let primaryScore = 0;
      for (let j = 0; j < it.perCriterion.length; j++) {
        if (it.perCriterion[j].criterionId === primary.id) {
          primaryScore = it.perCriterion[j].average;
          break;
        }
      }
      itemPrimaryScores.set(it.candidateId, primaryScore);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = itemPrimaryScores.get(a.candidateId) ?? 0;
    const bv = itemPrimaryScores.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Find top candidate for each criterion with direct object references instead of nested .find calls
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
