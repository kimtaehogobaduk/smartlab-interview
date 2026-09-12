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

// Performance Optimization (Bolt): Pre-group submissions by candidateId and replace nested searches
// with index lookups to reduce buildLeaderboard complexity from O(N*M + C*N*C) to O(M + N*C).
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  const items: LeaderboardItem[] = [];

  // Pre-group submissions by candidateId into a Map for O(1) lookups
  const subsMap = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    const list = subsMap.get(s.candidateId);
    if (list) {
      list.push(s);
    } else {
      subsMap.set(s.candidateId, [s]);
    }
  }

  for (const candidate of candidates) {
    const subs = subsMap.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => {
      let sum = 0;
      for (const s of subs) {
        const score = s.scores.find((x) => x.criterionId === item.id);
        if (score) {
          sum += score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
        }
      }
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round((sum / subs.length) * 10) / 10,
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
  const primaryIdx = primary ? criteria.items.findIndex((c) => c.id === primary.id) : -1;
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIdx === -1) return 0;
    const av = a.perCriterion[primaryIdx]?.average ?? 0;
    const bv = b.perCriterion[primaryIdx]?.average ?? 0;
    return bv - av;
  });
  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    if (!criterion) continue;
    let best = -1;
    let winner: LeaderboardItem | undefined;
    for (const item of items) {
      const value = item.perCriterion[cIdx]?.average ?? 0;
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
