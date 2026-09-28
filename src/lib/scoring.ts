import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates total weighted score for a set of criterion scores.
 * Optimized with Map score lookup to avoid O(N*M) nested array searches.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  let total = 0;
  const scoreMap = new Map<string, number>();
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const bonus = s.bonusPoints ?? 0;
    const scoreVal = s.score + Math.min(Math.max(bonus, 0), s.score * 0.1);
    scoreMap.set(s.criterionId, scoreVal);
  }
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
 * Builds the leaderboard rows for candidates based on submissions and scoring criteria config.
 * Performance Optimizations:
 * - Pre-groups submissions by `candidateId` into Map in O(S) to avoid O(C*S) array filtering per candidate.
 * - Single-pass loops for criterion average calculations to avoid repeated array allocations & .find() lookups.
 * - Pre-caches primary criterion average scores in Map to prevent repeated .find() inside O(N log N) sort comparator.
 * - Tracks direct item references during top criteria evaluation to eliminate O(N) items.find lookups.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // 1. Group submissions by candidate ID in O(S) time
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

  const items: LeaderboardItem[] = [];

  // 2. Compute candidate scores
  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (formula === "mean") {
        let scoreSum = 0;
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          const bonus = x.bonusPoints ?? 0;
          scoreSum += x.score + Math.min(Math.max(bonus, 0), x.score * 0.1);
        }
        totals[i] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let k = 0; k < criteria.items.length; k++) {
      const item = criteria.items[k];
      let sum = 0;
      for (let i = 0; i < subs.length; i++) {
        const scores = subs[i].scores;
        for (let j = 0; j < scores.length; j++) {
          if (scores[j].criterionId === item.id) {
            const x = scores[j];
            const bonus = x.bonusPoints ?? 0;
            sum += x.score + Math.min(Math.max(bonus, 0), x.score * 0.1);
            break;
          }
        }
      }
      perCriterion[k] = {
        criterionId: item.id,
        name: item.name,
        average: Math.round((sum / subs.length) * 10) / 10,
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

  // 3. Find primary criterion and pre-cache primary criterion score per candidate
  let primaryId: string | null = null;
  if (criteria.items.length > 0) {
    let highestWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > highestWeight) {
        highestWeight = criteria.items[i].weight;
        primaryId = criteria.items[i].id;
      }
    }
  }

  const primaryScoreMap = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === primaryId) {
          primaryScoreMap.set(item.candidateId, item.perCriterion[j].average);
          break;
        }
      }
    }
  }

  // 4. Sort leaderboard items using cached scores
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryScoreMap.get(a.candidateId) ?? 0;
    const bv = primaryScoreMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // 5. Determine top criteria winners using direct item references
  for (let k = 0; k < criteria.items.length; k++) {
    const criterion = criteria.items[k];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      for (let j = 0; j < item.perCriterion.length; j++) {
        if (item.perCriterion[j].criterionId === criterion.id) {
          value = item.perCriterion[j].average;
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
