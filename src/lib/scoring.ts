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
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (const s of scores) {
    scoreMap.set(s.criterionId, s);
  }
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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Index submissions by candidateId for O(1) candidate submissions lookup
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // Pre-determine primary criterion ID (highest weight)
  let primaryId: string | null = null;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (const item of criteria.items) {
      if (item.weight > maxWeight) {
        maxWeight = item.weight;
        primaryId = item.id;
      }
    }
  }

  type InternalItem = LeaderboardItem & { _primaryAvg: number };
  const items: InternalItem[] = [];

  for (const candidate of candidates) {
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) => {
      if (formula === "mean") {
        let sum = 0;
        for (const x of s.scores) {
          sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        return s.scores.length > 0 ? sum / s.scores.length : 0;
      }
      return s.totalWeightedScore;
    });

    const criterionSums = new Map<string, number>();
    for (const s of subs) {
      for (const x of s.scores) {
        const score = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + score);
      }
    }

    let primaryAvg = 0;
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      if (primaryId && item.id === primaryId) {
        primaryAvg = average;
      }
      return {
        criterionId: item.id,
        name: item.name,
        average,
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
      _primaryAvg: primaryAvg,
    });
  }

  // O(N log N) sort using pre-calculated primaryAverage tie-breaker
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b._primaryAvg - a._primaryAvg;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Calculate top criteria per candidate without linear array searches
  for (let cIndex = 0; cIndex < criteria.items.length; cIndex++) {
    const criterionName = criteria.items[cIndex].name;
    let best = -1;
    let winner: InternalItem | null = null;
    for (const item of items) {
      const value = item.perCriterion[cIndex]?.average ?? 0;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterionName);
    }
  }

  // Remove internal property and return clean LeaderboardItem array
  return items.map(({ _primaryAvg, ...item }) => item);
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
