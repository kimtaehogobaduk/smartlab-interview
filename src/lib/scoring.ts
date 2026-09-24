import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Performance-optimized weighted total calculation.
 * Uses a Map for O(1) score lookups instead of O(N) array scans per criterion item.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, number>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const bonus = Math.min(Math.max(s.bonusPoints ?? 0, 0), s.score * 0.1);
    scoreMap.set(s.criterionId, s.score + bonus);
  }

  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreMap.get(item.id) ?? 0;
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
 * Performance-optimized leaderboard aggregation.
 * - Groups submissions by candidateId in O(S) time to eliminate O(C * S) candidate filtering.
 * - Precomputes adjusted criterion scores in a Map for fast average score computation.
 * - Eliminates redundant `.find()` calls when evaluating tie-breakers and top criteria winners.
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

    // Map each submission's score array to a criterion Map for O(1) score lookup
    const subScoreMaps: Map<string, number>[] = new Array(subs.length);
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      const map = new Map<string, number>();
      for (let k = 0; k < s.scores.length; k++) {
        const scoreItem = s.scores[k];
        const bonus = Math.min(Math.max(scoreItem.bonusPoints ?? 0, 0), scoreItem.score * 0.1);
        map.set(scoreItem.criterionId, scoreItem.score + bonus);
      }
      subScoreMaps[j] = map;
    }

    const totals = new Array<number>(subs.length);
    for (let j = 0; j < subs.length; j++) {
      if (formula === "mean") {
        let scoreSum = 0;
        const map = subScoreMaps[j];
        for (const scoreVal of map.values()) {
          scoreSum += scoreVal;
        }
        totals[j] = map.size > 0 ? scoreSum / map.size : 0;
      } else {
        totals[j] = subs[j].totalWeightedScore;
      }
    }

    const perCriterion = new Array<{ criterionId: string; name: string; average: number }>(
      criteria.items.length,
    );
    for (let c = 0; c < criteria.items.length; c++) {
      const item = criteria.items[c];
      let sum = 0;
      for (let j = 0; j < subScoreMaps.length; j++) {
        sum += subScoreMaps[j].get(item.id) ?? 0;
      }
      const average = subScoreMaps.length > 0 ? sum / subScoreMaps.length : 0;
      perCriterion[c] = {
        criterionId: item.id,
        name: item.name,
        average: Math.round(average * 10) / 10,
      };
    }

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

  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    let av = 0;
    let bv = 0;
    for (let i = 0; i < a.perCriterion.length; i++) {
      if (a.perCriterion[i].criterionId === primary.id) {
        av = a.perCriterion[i].average;
        break;
      }
    }
    for (let i = 0; i < b.perCriterion.length; i++) {
      if (b.perCriterion[i].criterionId === primary.id) {
        bv = b.perCriterion[i].average;
        break;
      }
    }
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Find winner per criterion without redundant array.find lookups
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
  const body = rows.map((r) => {
    const scoreMap = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => scoreMap.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
