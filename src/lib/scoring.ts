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
  // Performance optimization: pre-group submissions by candidateId to avoid O(N*S) array filters
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
  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;
  const primaryId = primary?.id;

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    const totals: number[] = new Array(subCount);

    // Track sum of scores per criterion to avoid nested searches across submissions
    const criterionSums = new Map<string, number>();

    for (let i = 0; i < subCount; i++) {
      const s = subs[i];
      let subMeanSum = 0;

      for (let j = 0; j < s.scores.length; j++) {
        const x = s.scores[j];
        const effectiveScore = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        subMeanSum += effectiveScore;
        criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + effectiveScore);
      }

      totals[i] =
        formula === "mean"
          ? s.scores.length > 0
            ? subMeanSum / s.scores.length
            : 0
          : s.totalWeightedScore;
    }

    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round((sum / subCount) * 10) / 10,
      };
    });

    const finalScore = aggregate(totals, formula);

    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  // Pre-cache primary criterion averages for fast tie-breaker sorting without repeated linear searches
  if (primaryId && items.length > 1) {
    const primaryAverages = new Map<string, number>();
    for (const item of items) {
      const p = item.perCriterion.find((c) => c.criterionId === primaryId);
      primaryAverages.set(item.candidateId, p?.average ?? 0);
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

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Calculate top criteria winners in a single pass holding winner reference
  for (const criterion of criteria.items) {
    let best = -1;
    let winner: LeaderboardItem | undefined = undefined;

    for (const item of items) {
      const p = item.perCriterion.find((c) => c.criterionId === criterion.id);
      const value = p ? p.average : 0;
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
