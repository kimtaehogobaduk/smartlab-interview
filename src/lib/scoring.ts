import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// Optimization: Pre-map scores by criterionId to turn O(I * S) array lookups into O(I + S) Map lookups.
// Expected impact: ~3x faster computation during real-time range slider updates.
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map(scores.map((s) => [s.criterionId, s]));
  let total = 0;
  for (const item of items) {
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

// Optimization: Pre-group submissions by candidate ID into a Map upfront (O(S)) to avoid O(C * S) filtering.
// Pre-parse submission score maps to avoid repeated nested .find() calls.
// Use direct index access [k] and object references to eliminate O(C * I) scans and O(C) candidate lookups.
// Expected impact: ~5x-10x speedup for leaderboard generation with multiple candidates/submissions.
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  const items: LeaderboardItem[] = [];

  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const x of s.scores) {
        const scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        map.set(x.criterionId, scoreVal);
      }
      return map;
    });

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

  const sortedCriteria = [...criteria.items].sort((a, b) => b.weight - a.weight);
  const primaryId = sortedCriteria[0]?.id;
  const primaryIndex = primaryId ? criteria.items.findIndex((item) => item.id === primaryId) : -1;

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

  criteria.items.forEach((criterion, k) => {
    let best = -1;
    let bestWinner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.perCriterion[k]?.average ?? 0;
      if (value > best) {
        best = value;
        bestWinner = item;
      }
    }
    if (bestWinner && best > 0) {
      bestWinner.topCriteria.push(criterion.name);
    }
  });

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
    ...criteria.items.map((_, i) => r.perCriterion[i]?.average ?? 0),
  ]);
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
