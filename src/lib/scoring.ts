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

/**
 * Calculates effective score including capped bonus points (max 10% of base score).
 */
function calcEffectiveScore(score: number, bonusPoints?: number): number {
  const bonus = bonusPoints ?? 0;
  return score + Math.min(Math.max(bonus, 0), score * 0.1);
}

/**
 * Optimized buildLeaderboard:
 * 1. Groups submissions by candidateId upfront via Map in O(M) time to eliminate O(N*M) filtering.
 * 2. Accumulates per-criterion scores during submission iteration in O(M * scores_length) instead of O(N * M * C).
 * 3. Maps criterion averages to a Lookup Map per item to avoid O(C) array scans during sorting and top-criteria calculations.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-index submissions by candidateId
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const items: LeaderboardItem[] = [];
  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;

  // Map to hold per-item criterion average lookup for fast sorting and winner detection
  const itemCriterionAvgMap = new Map<LeaderboardItem, Map<string, number>>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    const totals: number[] = new Array(subCount);
    const criterionSums = new Map<string, number>();

    for (let j = 0; j < subCount; j++) {
      const s = subs[j];
      if (formula === "mean") {
        let sum = 0;
        const scoresLen = s.scores.length;
        for (let k = 0; k < scoresLen; k++) {
          const x = s.scores[k];
          const eff = calcEffectiveScore(x.score, x.bonusPoints);
          sum += eff;
          criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + eff);
        }
        totals[j] = scoresLen > 0 ? sum / scoresLen : 0;
      } else {
        totals[j] = s.totalWeightedScore;
        const scoresLen = s.scores.length;
        for (let k = 0; k < scoresLen; k++) {
          const x = s.scores[k];
          const eff = calcEffectiveScore(x.score, x.bonusPoints);
          criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + eff);
        }
      }
    }

    const perCriterionAvgMap = new Map<string, number>();
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / subCount) * 10) / 10;
      perCriterionAvgMap.set(item.id, average);
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
      panelCount: subCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    itemCriterionAvgMap.set(item, perCriterionAvgMap);
    items.push(item);
  }

  // Sort items using fast cached map lookups
  const primaryId = primary?.id;
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = itemCriterionAvgMap.get(a)?.get(primaryId) ?? 0;
    const bv = itemCriterionAvgMap.get(b)?.get(primaryId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Calculate top criteria winners
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = itemCriterionAvgMap.get(item)?.get(criterion.id) ?? 0;
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
