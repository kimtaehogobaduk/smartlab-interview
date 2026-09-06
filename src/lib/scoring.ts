import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

function getEffectiveScore(score: number, bonusPoints?: number): number {
  return score + Math.min(Math.max(bonusPoints ?? 0, 0), score * 0.1);
}

export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  for (const item of items) {
    const found = scores.find((s) => s.criterionId === item.id);
    const score = found ? getEffectiveScore(found.score, found.bonusPoints) : 0;
    total += (score * item.weight) / 100;
  }
  return Math.round(total * 10) / 10;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
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
  // Pre-group submissions by candidateId to eliminate repeated filter scans: O(S)
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let list = subsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];
  const candidateItemMap = new Map<string, LeaderboardItem>();
  // Store map of criterionId -> average for quick tie-break and top-criteria lookup
  const candidateCriterionAvgMap = new Map<string, Map<string, number>>();

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    const totals: number[] = new Array(subCount);

    // Pre-calculate mapped scores per submission for efficient criterion averaging
    const subScoreMaps: Map<string, number>[] = new Array(subCount);

    for (let i = 0; i < subCount; i++) {
      const s = subs[i];
      const scoreMap = new Map<string, number>();
      let sumScores = 0;

      for (let j = 0; j < s.scores.length; j++) {
        const x = s.scores[j];
        const eff = getEffectiveScore(x.score, x.bonusPoints);
        scoreMap.set(x.criterionId, eff);
        sumScores += eff;
      }
      subScoreMaps[i] = scoreMap;

      if (formula === "mean") {
        totals[i] = s.scores.length > 0 ? sumScores / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    const perCriterionList: { criterionId: string; name: string; average: number }[] = new Array(
      criteria.items.length,
    );
    const avgMap = new Map<string, number>();

    for (let k = 0; k < criteria.items.length; k++) {
      const item = criteria.items[k];
      let criterionSum = 0;

      for (let i = 0; i < subCount; i++) {
        criterionSum += subScoreMaps[i].get(item.id) ?? 0;
      }

      const average = Math.round((criterionSum / subCount) * 10) / 10;
      perCriterionList[k] = {
        criterionId: item.id,
        name: item.name,
        average,
      };
      avgMap.set(item.id, average);
    }

    const finalScore = aggregate(totals, formula);
    const item: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subCount,
      finalScore,
      perCriterion: perCriterionList,
      rank: 0,
      topCriteria: [],
    };

    items.push(item);
    candidateItemMap.set(candidate.id, item);
    candidateCriterionAvgMap.set(candidate.id, avgMap);
  }

  // Find primary criterion with highest weight without full array copy + sort
  let primaryCriterion = criteria.items[0] ?? null;
  for (let k = 1; k < criteria.items.length; k++) {
    if (criteria.items[k].weight > (primaryCriterion?.weight ?? -1)) {
      primaryCriterion = criteria.items[k];
    }
  }

  // Sort leaderboard items by finalScore, then by primary criterion score
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryCriterion) return 0;
    const av = candidateCriterionAvgMap.get(a.candidateId)?.get(primaryCriterion.id) ?? 0;
    const bv = candidateCriterionAvgMap.get(b.candidateId)?.get(primaryCriterion.id) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Determine top criteria winner for each criterion using O(1) candidate lookup
  for (let k = 0; k < criteria.items.length; k++) {
    const criterion = criteria.items[k];
    let best = -1;
    let bestId = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = candidateCriterionAvgMap.get(item.candidateId)?.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestId = item.candidateId;
      }
    }

    if (best > 0 && bestId) {
      const winner = candidateItemMap.get(bestId);
      if (winner) {
        winner.topCriteria.push(criterion.name);
      }
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
