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
 * Helper to calculate normalized score including bonus points.
 * Bonus points are capped between 0 and 10% of base score.
 */
function getEffectiveScore(scoreObj?: { score: number; bonusPoints?: number }): number {
  if (!scoreObj) return 0;
  const bonus = Math.min(Math.max(scoreObj.bonusPoints ?? 0, 0), scoreObj.score * 0.1);
  return scoreObj.score + bonus;
}

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Optimization: Pre-group submissions by candidateId in O(N) time
  // to avoid repeated Array.prototype.filter calls inside the candidate loop.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  const items: LeaderboardItem[] = [];

  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Compute total score per submission
    const totals: number[] = new Array(subs.length);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (formula === "mean") {
        let sum = 0;
        for (let j = 0; j < s.scores.length; j++) {
          sum += getEffectiveScore(s.scores[j]);
        }
        totals[i] = sum / (s.scores.length || 1);
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    // Compute average score per criterion for this candidate
    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      let criterionSum = 0;
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const scores = subs[sIdx].scores;
        // Optimization: Linear search in small scores array or lookup
        let foundScore: { score: number; bonusPoints?: number } | undefined;
        for (let k = 0; k < scores.length; k++) {
          if (scores[k].criterionId === item.id) {
            foundScore = scores[k];
            break;
          }
        }
        criterionSum += getEffectiveScore(foundScore);
      }
      const criterionAvg = Math.round((criterionSum / subs.length) * 10) / 10;
      perCriterion[cIdx] = {
        criterionId: item.id,
        name: item.name,
        average: criterionAvg,
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

  // Sort criteria by weight descending to find primary criterion for tie-breaking
  let primaryCriterionId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let i = 0; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > maxWeight) {
        maxWeight = criteria.items[i].weight;
        primaryCriterionId = criteria.items[i].id;
      }
    }
  }

  // Pre-index primary criterion value per item to optimize tie-breaker comparison in sorting
  const primaryValues = new Map<string, number>();
  if (primaryCriterionId) {
    for (const item of items) {
      let val = 0;
      for (let i = 0; i < item.perCriterion.length; i++) {
        if (item.perCriterion[i].criterionId === primaryCriterionId) {
          val = item.perCriterion[i].average;
          break;
        }
      }
      primaryValues.set(item.candidateId, val);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryCriterionId) return 0;
    const av = primaryValues.get(a.candidateId) ?? 0;
    const bv = primaryValues.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Determine top criteria winner per criterion in O(Criteria * Items) without nested array find
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winnerItem: LeaderboardItem | undefined;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      for (let pIdx = 0; pIdx < item.perCriterion.length; pIdx++) {
        if (item.perCriterion[pIdx].criterionId === criterion.id) {
          value = item.perCriterion[pIdx].average;
          break;
        }
      }
      if (value > best) {
        best = value;
        winnerItem = item;
      }
    }

    if (winnerItem && best > 0) {
      winnerItem.topCriteria.push(criterion.name);
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
