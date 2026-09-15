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
  // Performance optimization: Group submissions by candidateId in O(S) time instead of O(C * S)
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const s of submissions) {
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // Pre-find primary criterion ID for O(1) tie-breaking comparisons
  let primaryId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (const item of criteria.items) {
      if (item.weight > maxWeight) {
        maxWeight = item.weight;
        primaryId = item.id;
      }
    }
  }

  const items: LeaderboardItem[] = [];
  // Candidate ID -> (Criterion ID -> average score) for O(1) lookups
  const candidateCriterionAvgMap = new Map<string, Map<string, number>>();
  // Candidate ID -> primary criterion average score for O(1) sort comparator lookups
  const candidatePrimaryAvgMap = new Map<string, number>();
  // Candidate ID -> LeaderboardItem for O(1) winner lookup
  const candidateItemMap = new Map<string, LeaderboardItem>();

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Convert scores to maps once per submission for O(1) criterion lookup
    const subScoreMaps = subs.map((s) => {
      const map = new Map<string, number>();
      for (const x of s.scores) {
        const score = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        map.set(x.criterionId, score);
      }
      return { totalWeightedScore: s.totalWeightedScore, scoreMap: map };
    });

    const totals = subScoreMaps.map(({ totalWeightedScore, scoreMap }) => {
      if (formula === "mean") {
        if (scoreMap.size === 0) return 0;
        let sum = 0;
        for (const val of scoreMap.values()) {
          sum += val;
        }
        return sum / scoreMap.size;
      }
      return totalWeightedScore;
    });

    const critAvgMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const avg =
        Math.round(mean(subScoreMaps.map(({ scoreMap }) => scoreMap.get(item.id) ?? 0)) * 10) / 10;
      critAvgMap.set(item.id, avg);
      return {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    });

    candidateCriterionAvgMap.set(candidate.id, critAvgMap);
    if (primaryId) {
      candidatePrimaryAvgMap.set(candidate.id, critAvgMap.get(primaryId) ?? 0);
    }

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

    items.push(item);
    candidateItemMap.set(candidate.id, item);
  }

  // O(1) lookup during sort
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const av = candidatePrimaryAvgMap.get(a.candidateId) ?? 0;
    const bv = candidatePrimaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // O(1) lookups during topCriteria calculation
  for (const criterion of criteria.items) {
    let best = -1;
    let bestId = "";
    for (const item of items) {
      const critMap = candidateCriterionAvgMap.get(item.candidateId);
      const value = critMap?.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestId = item.candidateId;
      }
    }
    const winner = candidateItemMap.get(bestId);
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
