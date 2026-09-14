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
  // O(S) pre-grouping of submissions by candidate ID
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // Pre-determine primary criterion (highest weight) for O(1) tie-breaking
  let primaryId = "";
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    const item = criteria.items[i];
    if (item.weight > maxWeight) {
      maxWeight = item.weight;
      primaryId = item.id;
    }
  }

  const items: LeaderboardItem[] = [];

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Index score values per submission for O(1) criterion lookup
    const indexedSubmissions = subs.map((s) => {
      const scoreMap = new Map<string, number>();
      for (let i = 0; i < s.scores.length; i++) {
        const x = s.scores[i];
        scoreMap.set(
          x.criterionId,
          x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1),
        );
      }
      return { totalWeightedScore: s.totalWeightedScore, scoreMap };
    });

    const totals = indexedSubmissions.map((s) =>
      formula === "mean" ? mean(Array.from(s.scoreMap.values())) : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => ({
      criterionId: item.id,
      name: item.name,
      average:
        Math.round(mean(indexedSubmissions.map((s) => s.scoreMap.get(item.id) ?? 0)) * 10) / 10,
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

  // Sort items with O(1) tie-breaking
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = a.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    const bv = b.perCriterion.find((c) => c.criterionId === primaryId)?.average ?? 0;
    return bv - av;
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
  });

  // Track winning candidate directly during top criteria calculation
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const value = item.perCriterion.find((c) => c.criterionId === criterion.id)?.average ?? 0;
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
