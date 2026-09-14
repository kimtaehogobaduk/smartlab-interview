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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time to avoid O(C * S) repeated filter scans
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  // Pre-determine primary criterion ID for tie-breaking
  let primaryCriterionId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -Infinity;
    for (const item of criteria.items) {
      if (item.weight > maxWeight) {
        maxWeight = item.weight;
        primaryCriterionId = item.id;
      }
    }
  }

  // Intermediate structure to store criterion map for O(1) score lookup during tie-break sort
  interface TempItem extends LeaderboardItem {
    perCriterionMap: Map<string, number>;
  }

  const items: TempItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = [];
    for (const s of subs) {
      if (formula === "mean") {
        let sum = 0;
        for (const x of s.scores) {
          sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals.push(s.scores.length > 0 ? sum / s.scores.length : 0);
      } else {
        totals.push(s.totalWeightedScore);
      }
    }

    const perCriterionMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (const s of subs) {
        // Pre-indexed or linear scan over small score arrays (typically 3-10 criteria)
        for (const x of s.scores) {
          if (x.criterionId === item.id) {
            sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
      }
      const avg = Math.round((sum / subs.length) * 10) / 10;
      perCriterionMap.set(item.id, avg);
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
      perCriterionMap,
      rank: 0,
      topCriteria: [],
    });
  }

  // Sort candidates by final score and primary criterion score tie-breaker
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryCriterionId) return 0;
    const av = a.perCriterionMap.get(primaryCriterionId) ?? 0;
    const bv = b.perCriterionMap.get(primaryCriterionId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Calculate top criteria winners directly without O(N) array lookups
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: TempItem | null = null;
    for (const item of items) {
      const value = item.perCriterionMap.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterion.name);
    }
  }

  // Clean up temporary property before returning
  return items.map(({ perCriterionMap, ...item }) => item);
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
