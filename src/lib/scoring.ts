import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates total weighted score for a given submission or set of score inputs.
 * Optimization: Uses Map for O(1) score lookup instead of O(K) `.find()`.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    scoreMap.set(scores[i].criterionId, scores[i]);
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
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
 * Builds candidate leaderboard with per-criterion averages and rankings.
 * Performance optimizations:
 * 1. Submissions grouped by candidateId in O(S) time using Map instead of O(C * S) array filtering.
 * 2. Submission criterion scores indexed into Maps for O(1) score retrieval per candidate submission.
 * 3. Primary criterion average scores cached upfront so sort comparator runs in O(1) instead of O(K) `.find()`.
 * 4. Top criteria winners held by direct reference to avoid redundant O(N) array searches.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time
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

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    const subScoresMapList: Map<string, number>[] = new Array(subs.length);

    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      const scoreMap = new Map<string, number>();

      if (formula === "mean") {
        let scoreSum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          const sc = s.scores[k];
          const val = sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
          scoreMap.set(sc.criterionId, val);
          scoreSum += val;
        }
        totals[j] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[j] = s.totalWeightedScore;
        for (let k = 0; k < s.scores.length; k++) {
          const sc = s.scores[k];
          const val = sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
          scoreMap.set(sc.criterionId, val);
        }
      }
      subScoresMapList[j] = scoreMap;
    }

    const perCriterion = criteria.items.map((item) => {
      const scoresForCriterion = subScoresMapList.map((map) => map.get(item.id) ?? 0);
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(scoresForCriterion) * 10) / 10,
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

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryId = primary?.id;

  // Cache primary criterion score per item for O(1) comparator lookups
  const itemPrimaryAvg = new Map<LeaderboardItem, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let avg = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === primaryId) {
          avg = item.perCriterion[j].average;
          break;
        }
      }
      itemPrimaryAvg.set(item, avg);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = itemPrimaryAvg.get(a) ?? 0;
    const bv = itemPrimaryAvg.get(b) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      let value = 0;
      for (let k = 0; k < item.perCriterion.length; k++) {
        if (item.perCriterion[k].criterionId === criterion.id) {
          value = item.perCriterion[k].average;
          break;
        }
      }
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
