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
  // Performance Optimization:
  // 1. Group submissions by candidateId in O(N) to avoid O(N * M) repeated filtering.
  // 2. Pre-index criterion score totals to avoid O(criteria * submissions) array scanning (.find).
  // 3. Store criterion averages in a Map for O(1) tie-breaker and top criteria evaluation.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let candidateSubs = submissionsByCandidate.get(sub.candidateId);
    if (!candidateSubs) {
      candidateSubs = [];
      submissionsByCandidate.set(sub.candidateId, candidateSubs);
    }
    candidateSubs.push(sub);
  }

  const items: LeaderboardItem[] = [];
  const criterionAvgMap = new Map<string, Map<string, number>>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const panelCount = subs.length;

    // Accumulate score totals per criterion and prepare total scores per submission
    const totals: number[] = new Array(panelCount);
    const criterionSums = new Map<string, number>();

    for (let sIdx = 0; sIdx < panelCount; sIdx++) {
      const sub = subs[sIdx];
      if (formula === "mean") {
        let sum = 0;
        for (let scIdx = 0; scIdx < sub.scores.length; scIdx++) {
          const x = sub.scores[scIdx];
          const scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          sum += scoreVal;
          criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + scoreVal);
        }
        totals[sIdx] = sub.scores.length > 0 ? sum / sub.scores.length : 0;
      } else {
        totals[sIdx] = sub.totalWeightedScore;
        for (let scIdx = 0; scIdx < sub.scores.length; scIdx++) {
          const x = sub.scores[scIdx];
          const scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + scoreVal);
        }
      }
    }

    const candCriterionAvgs = new Map<string, number>();
    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      const sum = criterionSums.get(item.id) ?? 0;
      const avg = Math.round((sum / panelCount) * 10) / 10;
      candCriterionAvgs.set(item.id, avg);
      perCriterion[cIdx] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    }
    criterionAvgMap.set(candidate.id, candCriterionAvgs);

    const finalScore = aggregate(totals, formula);
    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = criterionAvgMap.get(a.candidateId)?.get(primaryId) ?? 0;
    const bv = criterionAvgMap.get(b.candidateId)?.get(primaryId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = criterionAvgMap.get(item.candidateId)?.get(criterion.id) ?? 0;
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
