import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for an evaluation submission.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let score = 0;
    for (let j = 0; j < scores.length; j++) {
      if (scores[j].criterionId === item.id) {
        const found = scores[j];
        score = found.score + Math.min(Math.max(found.bonusPoints ?? 0, 0), found.score * 0.1);
        break;
      }
    }
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
 * Builds and ranks leaderboard items for candidates based on panel evaluations.
 * Optimization:
 * 1. Pre-groups submissions by candidate ID in O(S) time to avoid O(C * S) filtering.
 * 2. Uses direct index loops instead of extra Map object allocations per submission.
 * 3. Pre-caches primary criterion averages before sorting to prevent repeated searches in sort comparator.
 * 4. Direct reference tracking for criteria winners to avoid O(N) linear lookups.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // 1. Group submissions by candidate ID in O(S) time
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

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    const totals: number[] = new Array(subCount);

    if (formula === "mean") {
      for (let s = 0; s < subCount; s++) {
        const scores = subs[s].scores;
        let scoreSum = 0;
        for (let i = 0; i < scores.length; i++) {
          const x = scores[i];
          scoreSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[s] = scores.length > 0 ? scoreSum / scores.length : 0;
      }
    } else {
      for (let s = 0; s < subCount; s++) {
        totals[s] = subs[s].totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let i = 0; i < criteria.items.length; i++) {
      const crit = criteria.items[i];
      let criterionSum = 0;
      for (let s = 0; s < subCount; s++) {
        const scores = subs[s].scores;
        let foundScore = 0;
        for (let k = 0; k < scores.length; k++) {
          if (scores[k].criterionId === crit.id) {
            const x = scores[k];
            foundScore = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        criterionSum += foundScore;
      }
      perCriterion[i] = {
        criterionId: crit.id,
        name: crit.name,
        average: Math.round((criterionSum / subCount) * 10) / 10,
      };
    }

    const finalScore = aggregate(totals, formula);
    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: subCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  // 2. Identify primary criterion for tie-breaker
  let primaryId = "";
  if (criteria.items.length > 0) {
    let primary = criteria.items[0];
    for (let i = 1; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > primary.weight) {
        primary = criteria.items[i];
      }
    }
    primaryId = primary.id;
  }

  // Pre-cache primary average score on array
  const primaryAvg = new Float64Array(items.length);
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const perCrit = items[i].perCriterion;
      for (let j = 0; j < perCrit.length; j++) {
        if (perCrit[j].criterionId === primaryId) {
          primaryAvg[i] = perCrit[j].average;
          break;
        }
      }
    }
  }

  // Map candidateId to index for fast lookup during sort
  const itemIndexMap = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    itemIndexMap.set(items[i].candidateId, i);
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const ai = itemIndexMap.get(a.candidateId)!;
    const bi = itemIndexMap.get(b.candidateId)!;
    return primaryAvg[bi] - primaryAvg[ai];
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // 3. Identify top criteria winners per criterion without linear candidate searches
  for (let c = 0; c < criteria.items.length; c++) {
    const crit = criteria.items[c];
    let best = -1;
    let winner: LeaderboardItem | undefined;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const perCrit = item.perCriterion;
      let val = 0;
      for (let j = 0; j < perCrit.length; j++) {
        if (perCrit[j].criterionId === crit.id) {
          val = perCrit[j].average;
          break;
        }
      }
      if (val > best) {
        best = val;
        winner = item;
      }
    }

    if (winner && best > 0) {
      winner.topCriteria.push(crit.name);
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
    ...criteria.items.map((c) => {
      for (let i = 0; i < r.perCriterion.length; i++) {
        if (r.perCriterion[i].criterionId === c.id) {
          return r.perCriterion[i].average;
        }
      }
      return 0;
    }),
  ]);

  return [header, ...body].map((line) => line.join(",")).join("\n");
}
