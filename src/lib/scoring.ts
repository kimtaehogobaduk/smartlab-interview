import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

function calcEffectiveScore(s: { score: number; bonusPoints?: number }): number {
  return s.score + Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
}

export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  for (const item of items) {
    const found = scores.find((s) => s.criterionId === item.id);
    const score = found ? calcEffectiveScore(found) : 0;
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
  // Optimization 1: Pre-group submissions by candidateId to avoid repeated Array.filter calls O(C * S -> S)
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  type IndexedItem = {
    item: LeaderboardItem;
    primaryAverage: number;
  };

  const indexedItems: IndexedItem[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean" ? mean(s.scores.map(calcEffectiveScore)) : s.totalWeightedScore,
    );

    // Optimization 2: Single pass sum aggregation per criterion
    const criterionSumMap = new Map<string, number>();
    for (const s of subs) {
      for (const score of s.scores) {
        const eff = calcEffectiveScore(score);
        criterionSumMap.set(score.criterionId, (criterionSumMap.get(score.criterionId) ?? 0) + eff);
      }
    }

    let primaryAverage = 0;
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSumMap.get(item.id) ?? 0;
      const average = Math.round((sum / subs.length) * 10) / 10;
      if (item.id === primaryId) {
        primaryAverage = average;
      }
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

    const finalScore = aggregate(totals, formula);
    const item: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    indexedItems.push({ item, primaryAverage });
  }

  // Optimization 3: Pre-computed primaryAverage for O(1) comparison in sort
  indexedItems.sort((a, b) => {
    if (b.item.finalScore !== a.item.finalScore) {
      return b.item.finalScore - a.item.finalScore;
    }
    return b.primaryAverage - a.primaryAverage;
  });

  const items = indexedItems.map((indexed, i) => {
    indexed.item.rank = i + 1;
    return indexed.item;
  });

  // Optimization 4: Direct index access perCriterion[cIdx] and winner reference tracking
  criteria.items.forEach((criterion, cIdx) => {
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
    ...criteria.items.map((_, idx) => r.perCriterion[idx]?.average ?? 0),
  ]);
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
