import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// Helper to calculate score with bonus capped at 10%
function calcEffectiveScore(score: number, bonusPoints?: number): number {
  return score + Math.min(Math.max(bonusPoints ?? 0, 0), score * 0.1);
}

export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  // Performance optimization: Pre-index scores by criterionId for O(1) lookup
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (const s of scores) {
    scoreMap.set(s.criterionId, s);
  }

  let total = 0;
  for (const item of items) {
    const found = scoreMap.get(item.id);
    const score = found ? calcEffectiveScore(found.score, found.bonusPoints) : 0;
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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Performance optimization: Pre-group submissions by candidateId in O(M) time
  // to avoid O(N * M) repeated array filtering for each candidate.
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Pre-map scores per submission for fast O(1) criterion lookup
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const x of s.scores) {
        map.set(x.criterionId, calcEffectiveScore(x.score, x.bonusPoints));
      }
      return map;
    });

    const totals = subs.map((s, idx) =>
      formula === "mean" ? mean(Array.from(subScoreMaps[idx]!.values())) : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => ({
      criterionId: item.id,
      name: item.name,
      average: Math.round(mean(subScoreMaps.map((map) => map.get(item.id) ?? 0)) * 10) / 10,
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

  // Performance optimization: Pre-index primary criterion averages before sorting
  // to avoid calling `find` inside the sort comparator for every comparison.
  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;
  const primaryAvgMap = new Map<string, number>();
  if (primaryId) {
    for (const item of items) {
      const found = item.perCriterion.find((c) => c.criterionId === primaryId);
      primaryAvgMap.set(item.candidateId, found?.average ?? 0);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAvgMap.get(a.candidateId) ?? 0;
    const bv = primaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Performance optimization: Track winning item directly to eliminate O(N) `items.find`
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterion.find((c) => c.criterionId === criterion.id)?.average ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
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
