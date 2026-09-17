import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a single evaluation.
 * Optimization: Uses a Map for O(1) criterion lookup instead of O(N * M) Array.find.
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
 * Builds candidate leaderboard with aggregate scores and top criteria.
 * Optimization: Replaces O(C * S) submission filtering, O(K^2) nested criterion scans,
 * and O(C^2) winner lookups with O(S) Map grouping and O(1) cached index lookups.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time instead of O(C * S)
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

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    // Single-pass accumulation of scores per criterion across candidate's submissions
    const criterionTotals = new Map<string, number>();
    for (let j = 0; j < subs.length; j++) {
      const scores = subs[j].scores;
      for (let k = 0; k < scores.length; k++) {
        const scoreObj = scores[k];
        const effScore =
          scoreObj.score + Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
        criterionTotals.set(
          scoreObj.criterionId,
          (criterionTotals.get(scoreObj.criterionId) ?? 0) + effScore,
        );
      }
    }

    const perCriterion = criteria.items.map((item) => ({
      criterionId: item.id,
      name: item.name,
      average: Math.round(((criterionTotals.get(item.id) ?? 0) / subs.length) * 10) / 10,
    }));

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
  const primaryId = primary?.id;

  // Cache primary criterion averages for fast sort comparisons
  const primaryAvgMap = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === primaryId) {
          primaryAvgMap.set(item.candidateId, item.perCriterion[j].average);
          break;
        }
      }
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAvgMap.get(a.candidateId) ?? 0;
    const bv = primaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Determine winner per criterion without nested linear item searches
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let winner: LeaderboardItem | undefined = undefined;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      let value = 0;
      for (let k = 0; k < item.perCriterion.length; k++) {
        if (item.perCriterion[k].criterionId === criterion.id) {
          value = item.perCriterion[k].average;
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
