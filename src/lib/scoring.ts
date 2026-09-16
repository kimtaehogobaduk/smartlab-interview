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

/** Helper to compute adjusted score including bounded bonus points [0, score * 0.1]. */
function getAdjustedScore(score: number, bonusPoints?: number): number {
  return score + Math.min(Math.max(bonusPoints ?? 0, 0), score * 0.1);
}

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Performance optimization: Pre-group submissions by candidate ID into a Map.
  // Reduces lookup complexity from O(N * S) to O(S + N).
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(s.scores.map((x) => getAdjustedScore(x.score, x.bonusPoints)))
        : s.totalWeightedScore,
    );

    // Performance optimization: Pre-map submission scores for O(1) criterion lookup.
    const mappedSubs = subs.map((s) => {
      const scoreMap = new Map<string, number>();
      for (const x of s.scores) {
        scoreMap.set(x.criterionId, getAdjustedScore(x.score, x.bonusPoints));
      }
      return scoreMap;
    });

    const perCriterion = criteria.items.map((item) => {
      const avg = mean(mappedSubs.map((scoreMap) => scoreMap.get(item.id) ?? 0));
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

  // Find the primary criterion (highest weight) index in criteria.items.
  let primaryIndex = -1;
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    const c = criteria.items[i];
    if (c && c.weight > maxWeight) {
      maxWeight = c.weight;
      primaryIndex = i;
    }
  }

  // Performance optimization: Direct O(1) index access for primary criterion average during sort,
  // replacing repeated O(C) .find(...) calls during O(N log N) comparisons.
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIndex === -1) return 0;
    const av = a.perCriterion[primaryIndex]?.average ?? 0;
    const bv = b.perCriterion[primaryIndex]?.average ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Performance optimization: Direct index access for criterion average and direct winner reference
  // replaces O(C * N * C) find operations with O(C * N).
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    if (!criterion) continue;

    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (const item of items) {
      const value = item.perCriterion[cIdx]?.average ?? 0;
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
