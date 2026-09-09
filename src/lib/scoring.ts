import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score total for a given submission.
 * Uses a Map lookup for O(1) criterion matching.
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
 * Builds and ranks leaderboard items for candidates.
 * Optimized with Map-based indexing to reduce complexity from O(N*S*K^2) to O(S*K + N*K).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId for O(1) lookup
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

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    // Pre-index scores per submission for O(1) score lookup per criterion
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (let j = 0; j < s.scores.length; j++) {
        const x = s.scores[j];
        const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        map.set(x.criterionId, val);
      }
      return map;
    });

    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (let j = 0; j < subScoreMaps.length; j++) {
        sum += subScoreMaps[j].get(item.id) ?? 0;
      }
      const avg = Math.round((sum / subs.length) * 10) / 10;
      return {
        criterionId: item.id,
        name: item.name,
        average: avg,
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

  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;

  if (primary) {
    // Pre-calculate primary criterion average per candidate for O(1) comparator lookups
    const primaryAverages = new Map<string, number>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const primaryEntry = item.perCriterion.find((c) => c.criterionId === primary.id);
      primaryAverages.set(item.candidateId, primaryEntry?.average ?? 0);
    }

    items.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      const av = primaryAverages.get(a.candidateId) ?? 0;
      const bv = primaryAverages.get(b.candidateId) ?? 0;
      return bv - av;
    });
  } else {
    items.sort((a, b) => b.finalScore - a.finalScore);
  }

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Optimize top criteria determination using Map lookups
  const itemCriterionMaps = items.map((item) => {
    const map = new Map<string, number>();
    for (let j = 0; j < item.perCriterion.length; j++) {
      map.set(item.perCriterion[j].criterionId, item.perCriterion[j].average);
    }
    return map;
  });

  const itemById = new Map<string, LeaderboardItem>();
  for (let i = 0; i < items.length; i++) {
    itemById.set(items[i].candidateId, items[i]);
  }

  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let bestId = "";
    for (let j = 0; j < items.length; j++) {
      const value = itemCriterionMaps[j].get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestId = items[j].candidateId;
      }
    }
    const winner = itemById.get(bestId);
    if (winner && best > 0) winner.topCriteria.push(criterion.name);
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
