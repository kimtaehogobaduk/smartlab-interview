import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// Optimization: Index scores in a Map to reduce lookups from O(N * M) to O(N + M)
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

// Optimization: Pre-group submissions by candidateId and pre-map scores per submission.
// Reduces algorithmic complexity from quadratic O(C * S * K * M) to linear O(S * (K + M) + C * K).
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId in O(S) time
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

    // Pre-index scores per submission for O(1) criterion lookup
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const score of s.scores) {
        const effectiveScore =
          score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
        map.set(score.criterionId, effectiveScore);
      }
      return { submission: s, scoreMap: map };
    });

    const totals = subScoreMaps.map(({ submission, scoreMap }) => {
      if (formula === "mean") {
        const scores = Array.from(scoreMap.values());
        return mean(scores);
      }
      return submission.totalWeightedScore;
    });

    const perCriterion = criteria.items.map((item) => {
      const scoresForItem = subScoreMaps.map(({ scoreMap }) => scoreMap.get(item.id) ?? 0);
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(scoresForItem) * 10) / 10,
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

  // Fast tie-breaking using primary criterion lookup
  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  if (primary) {
    items.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      const av = a.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
      const bv = b.perCriterion.find((c) => c.criterionId === primary.id)?.average ?? 0;
      return bv - av;
    });
  } else {
    items.sort((a, b) => b.finalScore - a.finalScore);
  }

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Map candidateId -> item for O(1) winner assignment
  const itemMap = new Map<string, LeaderboardItem>(items.map((item) => [item.candidateId, item]));

  for (const criterion of criteria.items) {
    let best = -1;
    let bestId = "";
    for (const item of items) {
      const criterionAvg =
        item.perCriterion.find((c) => c.criterionId === criterion.id)?.average ?? 0;
      if (criterionAvg > best) {
        best = criterionAvg;
        bestId = item.candidateId;
      }
    }
    const winner = itemMap.get(bestId);
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
