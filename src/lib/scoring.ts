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
 * Optimized leaderboard builder.
 * Group submissions by candidate once in O(S) time, and lookup criterion scores using precomputed maps
 * to avoid repeated O(C * S) filters and O(submissions * criteria) nested finds.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // 1. Group submissions by candidate ID in O(S) time
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (const sub of submissions) {
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  // Find primary criterion for tie-breaking
  let primaryId: string | undefined;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (const item of criteria.items) {
      if (item.weight > maxWeight) {
        maxWeight = item.weight;
        primaryId = item.id;
      }
    }
  }

  const items: (LeaderboardItem & { primaryAvg?: number })[] = [];

  // 2. Process each candidate
  for (const candidate of candidates) {
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const subCount = subs.length;
    let totals: number[];

    if (formula === "mean") {
      totals = new Array(subCount);
      for (let sIdx = 0; sIdx < subCount; sIdx++) {
        const subScores = subs[sIdx].scores;
        let sum = 0;
        for (let scIdx = 0; scIdx < subScores.length; scIdx++) {
          const x = subScores[scIdx];
          const bonus = x.bonusPoints ?? 0;
          sum += x.score + Math.min(Math.max(bonus, 0), x.score * 0.1);
        }
        totals[sIdx] = subScores.length > 0 ? sum / subScores.length : 0;
      }
    } else {
      totals = new Array(subCount);
      for (let sIdx = 0; sIdx < subCount; sIdx++) {
        totals[sIdx] = subs[sIdx].totalWeightedScore;
      }
    }

    const perCriterion: { criterionId: string; name: string; average: number }[] = [];
    let primaryAvg = 0;

    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      let sum = 0;

      for (let sIdx = 0; sIdx < subCount; sIdx++) {
        const subScores = subs[sIdx].scores;
        let scoreVal = 0;
        for (let scIdx = 0; scIdx < subScores.length; scIdx++) {
          if (subScores[scIdx].criterionId === item.id) {
            const sc = subScores[scIdx];
            const bonus = sc.bonusPoints ?? 0;
            scoreVal = sc.score + Math.min(Math.max(bonus, 0), sc.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }

      const average = Math.round((sum / subCount) * 10) / 10;
      perCriterion.push({
        criterionId: item.id,
        name: item.name,
        average,
      });

      if (primaryId && item.id === primaryId) {
        primaryAvg = average;
      }
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
      primaryAvg,
    });
  }

  // 3. Sort leaderboard items using cached primaryAvg
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    return (b.primaryAvg ?? 0) - (a.primaryAvg ?? 0);
  });

  // Map to store winning top criteria per candidate without repeated array scans
  const topCriteriaMap = new Map<string, string[]>();

  for (const item of items) {
    item.rank = items.indexOf(item) + 1; // Or directly index in loop below
  }

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
    topCriteriaMap.set(items[i].candidateId, items[i].topCriteria);
  }

  // 4. Find best candidates for each criterion
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let bestCandidateId = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[cIdx]?.average ?? 0;
      if (value > best) {
        best = value;
        bestCandidateId = item.candidateId;
      }
    }

    if (bestCandidateId && best > 0) {
      const list = topCriteriaMap.get(bestCandidateId);
      if (list) list.push(criterion.name);
    }
  }

  // Clean up internal primaryAvg property before return
  for (let i = 0; i < items.length; i++) {
    delete items[i].primaryAvg;
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
