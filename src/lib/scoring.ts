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
  // ⚡ Optimization: Pre-group submissions by candidateId to reduce O(N * S) filtering to O(S + N) lookup
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    const list = subsByCandidate.get(s.candidateId);
    if (list) {
      list.push(s);
    } else {
      subsByCandidate.set(s.candidateId, [s]);
    }
  }

  const primaryCriterion =
    criteria.items.length > 0 ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0] : null;
  const primaryId = primaryCriterion?.id;

  type InternalItem = LeaderboardItem & {
    criterionMap?: Map<string, number>;
    primaryAvg?: number;
  };

  const items: InternalItem[] = [];

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

    // ⚡ Optimization: Cache criterion averages in a Map for O(1) lookups during tie-breaker sort and top criteria calculation
    const criterionMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const avg =
        Math.round(
          mean(
            subs.map((s) => {
              const score = s.scores.find((x) => x.criterionId === item.id);
              return score
                ? score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1)
                : 0;
            }),
          ) * 10,
        ) / 10;
      criterionMap.set(item.id, avg);
      return {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    });

    const finalScore = aggregate(totals, formula);
    const primaryAvg = primaryId ? (criterionMap.get(primaryId) ?? 0) : 0;

    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
      criterionMap,
      primaryAvg,
    });
  }

  // ⚡ Optimization: O(1) tie-breaker comparisons using cached primaryAvg instead of repeated Array.prototype.find
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return (b.primaryAvg ?? 0) - (a.primaryAvg ?? 0);
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // ⚡ Optimization: Keep direct reference to winner LeaderboardItem instead of secondary O(N) Array.prototype.find lookup
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (const item of items) {
      const value = item.criterionMap?.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) winner.topCriteria.push(criterion.name);
  }

  // Remove temporary cached properties before returning
  for (const item of items) {
    delete item.criterionMap;
    delete item.primaryAvg;
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
