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

// Helper to calculate effective score including bonus points capped at 10%
function getEffectiveScore(x: { score: number; bonusPoints?: number }): number {
  return x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
}

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Optimization: Group submissions by candidateId in O(N) time instead of repeated array filtering
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
  const criteriaItems = criteria.items;
  const numCriteria = criteriaItems.length;

  // Map criterionId -> index for O(1) score accumulator lookup
  const criterionIndexMap = new Map<string, number>();
  for (let i = 0; i < numCriteria; i++) {
    criterionIndexMap.set(criteriaItems[i].id, i);
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const numSubs = subs.length;
    const totals: number[] = new Array(numSubs);
    const criterionSums = new Float64Array(numCriteria);

    for (let j = 0; j < numSubs; j++) {
      const s = subs[j];

      if (formula === "mean") {
        let sum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          sum += getEffectiveScore(s.scores[k]);
        }
        totals[j] = s.scores.length > 0 ? sum / s.scores.length : 0;
      } else {
        totals[j] = s.totalWeightedScore;
      }

      for (let k = 0; k < s.scores.length; k++) {
        const sc = s.scores[k];
        const cIdx = criterionIndexMap.get(sc.criterionId);
        if (cIdx !== undefined) {
          criterionSums[cIdx] += getEffectiveScore(sc);
        }
      }
    }

    const perCriterion = new Array<{ criterionId: string; name: string; average: number }>(
      numCriteria,
    );
    for (let cIdx = 0; cIdx < numCriteria; cIdx++) {
      const item = criteriaItems[cIdx];
      const avg = numSubs > 0 ? criterionSums[cIdx] / numSubs : 0;
      perCriterion[cIdx] = {
        criterionId: item.id,
        name: item.name,
        average: Math.round(avg * 10) / 10,
      };
    }

    const finalScore = aggregate(totals, formula);
    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount: numSubs,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  if (items.length === 0) return items;

  // Find primary criterion with highest weight for tie-breaking
  let primaryId = "";
  let maxWeight = -1;
  for (let i = 0; i < numCriteria; i++) {
    if (criteriaItems[i].weight > maxWeight) {
      maxWeight = criteriaItems[i].weight;
      primaryId = criteriaItems[i].id;
    }
  }

  // Pre-extract primary criterion average per candidate for O(1) comparator lookup
  const primaryAvgMap = new Map<string, number>();
  if (primaryId) {
    const primaryIdx = criterionIndexMap.get(primaryId);
    if (primaryIdx !== undefined) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        primaryAvgMap.set(item.candidateId, item.perCriterion[primaryIdx]?.average ?? 0);
      }
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAvgMap.get(a.candidateId) ?? 0;
    const bv = primaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  const itemByCandidateId = new Map<string, LeaderboardItem>();
  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
    itemByCandidateId.set(items[i].candidateId, items[i]);
  }

  // Determine top candidates for each criterion (perCriterion indices directly match criteriaItems)
  for (let cIdx = 0; cIdx < numCriteria; cIdx++) {
    const criterion = criteriaItems[cIdx];
    let best = -1;
    let bestId = "";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[cIdx]?.average ?? 0;
      if (value > best) {
        best = value;
        bestId = item.candidateId;
      }
    }
    if (bestId && best > 0) {
      const winner = itemByCandidateId.get(bestId);
      if (winner) winner.topCriteria.push(criterion.name);
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
  const body = rows.map((r) => {
    const map = new Map(r.perCriterion.map((p) => [p.criterionId, p.average]));
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => map.get(c.id) ?? 0),
    ];
  });
  return [header, ...body].map((line) => line.join(",")).join("\n");
}
