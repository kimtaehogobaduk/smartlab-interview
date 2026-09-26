import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted total score for a candidate's evaluation scores.
 * Optimization: Uses a Map lookup for score retrieval ($O(N)$ time) to prevent repeated linear scans.
 */
export function weightedTotal(
  scores: { criterionId: string; score: number; bonusPoints?: number }[],
  items: EvaluationCriterion[],
): number {
  const scoreMap = new Map<string, { score: number; bonusPoints?: number }>();
  for (let i = 0; i < scores.length; i++) {
    scoreMap.set(scores[i].criterionId, scores[i]);
  }

  let total = 0;
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

interface InternalLeaderboardItem extends LeaderboardItem {
  primaryAvg: number;
}

/**
 * Builds the leaderboard items for candidates based on submissions and criteria.
 * Performance Optimizations:
 * 1. Groups submissions by candidateId into a Map ($O(M)$ time) to eliminate $O(N \cdot M)$ filter scans.
 * 2. Maps criterion IDs to index for $O(1)$ lookup during per-candidate submission scoring.
 * 3. Pre-calculates primary criterion score averages to allow $O(1)$ sort tie-breaking.
 * 4. Index-based criteria evaluation for top-criteria calculation ($O(C \cdot N)$ vs $O(C^2 \cdot N)$).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidateId
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

  // Pre-index criterion IDs for O(1) position lookup
  const criterionIndexMap = new Map<string, number>();
  let primaryIndex = -1;
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    const item = criteria.items[i];
    criterionIndexMap.set(item.id, i);
    if (item.weight > maxWeight) {
      maxWeight = item.weight;
      primaryIndex = i;
    }
  }

  const items: InternalLeaderboardItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const panelCount = subs.length;
    const criterionSums = new Float64Array(criteria.items.length);
    const totals = new Array<number>(panelCount);

    for (let sIdx = 0; sIdx < panelCount; sIdx++) {
      const sub = subs[sIdx];

      if (formula === "mean") {
        let subMeanSum = 0;
        for (let scIdx = 0; scIdx < sub.scores.length; scIdx++) {
          const x = sub.scores[scIdx];
          subMeanSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[sIdx] = sub.scores.length > 0 ? subMeanSum / sub.scores.length : 0;
      } else {
        totals[sIdx] = sub.totalWeightedScore;
      }

      for (let scIdx = 0; scIdx < sub.scores.length; scIdx++) {
        const x = sub.scores[scIdx];
        const cIdx = criterionIndexMap.get(x.criterionId);
        if (cIdx !== undefined) {
          criterionSums[cIdx] += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
      }
    }

    const perCriterion = new Array<{ criterionId: string; name: string; average: number }>(
      criteria.items.length,
    );
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      const avg = Math.round((criterionSums[cIdx] / panelCount) * 10) / 10;
      perCriterion[cIdx] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
      };
    }

    const finalScore = aggregate(totals, formula);
    const primaryAvg = primaryIndex !== -1 ? perCriterion[primaryIndex].average : 0;

    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
      primaryAvg,
    });
  }

  // Sort by finalScore desc, then primary criterion average desc
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b.primaryAvg - a.primaryAvg;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Determine top criteria winner for each criterion
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterionName = criteria.items[cIdx].name;
    let best = -1;
    let winner: InternalLeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[cIdx].average;
      if (value > best) {
        best = value;
        winner = item;
      }
    }
    if (winner && best > 0) {
      winner.topCriteria.push(criterionName);
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
    const critMap = new Map<string, number>();
    for (let i = 0; i < r.perCriterion.length; i++) {
      critMap.set(r.perCriterion[i].criterionId, r.perCriterion[i].average);
    }
    return [
      r.rank,
      r.name,
      r.track,
      r.panelCount,
      r.finalScore,
      ...criteria.items.map((c) => critMap.get(c.id) ?? 0),
    ];
  });

  return [header, ...body].map((line) => line.join(",")).join("\n");
}
