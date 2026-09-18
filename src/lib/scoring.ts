import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score with bonus points capped at 10% per criterion.
 * Optimized with Map lookup to improve performance from O(N*M) to O(N + M).
 */
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
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.length === 1 ? values : [...values].sort((a, b) => a - b);
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
 * Builds candidate leaderboard with aggregated scores across interview criteria.
 * Optimized:
 * 1. Pre-groups submissions by candidateId in O(S) Map lookup instead of O(C * S) array filters.
 * 2. Uses criterion score sum direct aggregation for O(1) criterion average calculation.
 * 3. Uses Map lookups for primary criterion tie-breaking and top criteria candidate matching.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId: O(S)
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
  const itemCriterionAveragesMap = new Map<LeaderboardItem, Map<string, number>>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      if (formula === "mean") {
        let scoreSum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          const x = s.scores[k];
          scoreSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[j] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion: { criterionId: string; name: string; average: number }[] = [];
    const critAvgMap = new Map<string, number>();

    for (let c = 0; c < criteria.items.length; c++) {
      const item = criteria.items[c];
      let sum = 0;
      for (let s = 0; s < subs.length; s++) {
        const subScores = subs[s].scores;
        let scoreVal = 0;
        for (let k = 0; k < subScores.length; k++) {
          if (subScores[k].criterionId === item.id) {
            const x = subScores[k];
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }
      const average = Math.round((sum / subs.length) * 10) / 10;
      perCriterion.push({ criterionId: item.id, name: item.name, average });
      critAvgMap.set(item.id, average);
    }

    const finalScore = aggregate(totals, formula);
    const leaderboardItem: LeaderboardItem = {
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    };

    items.push(leaderboardItem);
    itemCriterionAveragesMap.set(leaderboardItem, critAvgMap);
  }

  // Determine primary criterion for tie-breaking
  let primary: EvaluationCriterion | undefined;
  if (criteria.items.length > 0) {
    primary = criteria.items[0];
    for (let i = 1; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > primary.weight) {
        primary = criteria.items[i];
      }
    }
  }

  // Sort leaderboard items: O(C log C) with O(1) tie-breaker lookups
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = itemCriterionAveragesMap.get(a)?.get(primary.id) ?? 0;
    const bv = itemCriterionAveragesMap.get(b)?.get(primary.id) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Identify top candidates per criterion
  const candidateMap = new Map<string, LeaderboardItem>();
  for (let i = 0; i < items.length; i++) {
    candidateMap.set(items[i].candidateId, items[i]);
  }

  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let bestId = "";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = itemCriterionAveragesMap.get(item)?.get(criterion.id) ?? 0;
      if (value > best) {
        best = value;
        bestId = item.candidateId;
      }
    }
    const winner = candidateMap.get(bestId);
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
