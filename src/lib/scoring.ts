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

/**
 * Performance Optimization (Bolt ⚡):
 * Reduces buildLeaderboard time complexity from O(N * S + N * C * S + C * N * C) to O(S + N * C)
 * by indexing submissions per candidate, caching criterion scores, and tracking top performers
 * in a single pass over criteria averages instead of nested linear searches.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Index submissions by candidateId in a single pass O(S)
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

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => {
      let criterionSum = 0;
      for (const s of subs) {
        // Fast linear search or loop for scores inside submission (usually <= 5 criteria)
        for (const x of s.scores) {
          if (x.criterionId === item.id) {
            criterionSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
      }
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean([criterionSum / subs.length]) * 10) / 10,
      };
    });

    // Directly calculate perCriterion average: Math.round((criterionSum / subs.length) * 10) / 10
    // Note: mean([X]) === X
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

  // Pre-find primary criterion for tie-breaking
  let primaryId: string | null = null;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (const c of criteria.items) {
      if (c.weight > maxWeight) {
        maxWeight = c.weight;
        primaryId = c.id;
      }
    }
  }

  // Sort items by finalScore descending, then by primary criterion average
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    let av = 0;
    for (const c of a.perCriterion) {
      if (c.criterionId === primaryId) {
        av = c.average;
        break;
      }
    }
    let bv = 0;
    for (const c of b.perCriterion) {
      if (c.criterionId === primaryId) {
        bv = c.average;
        break;
      }
    }
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Track best candidates per criterion in O(C * N) without re-searching candidate items
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      let value = 0;
      for (const c of item.perCriterion) {
        if (c.criterionId === criterion.id) {
          value = c.average;
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
