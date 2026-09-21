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
 * ⚡ Performance Optimization (Bolt):
 * - Submissions are indexed by `candidateId` into a Map in a single O(M) pass, avoiding repeated array filtering (O(N*M)).
 * - Scores and criterion averages per candidate are computed in a single pass without nested `.find()` searches.
 * - Primary criterion and top criteria selections use O(1) index lookups instead of repeated array `.find()` calls in sorting and loops.
 * Overall complexity reduced from O(N * M * K * S) to O(M + N * K + N log N).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-index submissions by candidateId for O(1) lookup
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
    const criterionSums = new Map<string, number>();

    for (let sIndex = 0; sIndex < subs.length; sIndex++) {
      const s = subs[sIndex];
      if (formula === "mean") {
        let scoreSum = 0;
        for (let scIndex = 0; scIndex < s.scores.length; scIndex++) {
          const sc = s.scores[scIndex];
          const effScore = sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
          scoreSum += effScore;
          criterionSums.set(sc.criterionId, (criterionSums.get(sc.criterionId) ?? 0) + effScore);
        }
        totals[sIndex] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[sIndex] = s.totalWeightedScore;
        for (let scIndex = 0; scIndex < s.scores.length; scIndex++) {
          const sc = s.scores[scIndex];
          const effScore = sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
          criterionSums.set(sc.criterionId, (criterionSums.get(sc.criterionId) ?? 0) + effScore);
        }
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let cIndex = 0; cIndex < criteria.items.length; cIndex++) {
      const item = criteria.items[cIndex];
      const sum = criterionSums.get(item.id) ?? 0;
      const avg = sum / subs.length;
      perCriterion[cIndex] = {
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
      panelCount: subs.length,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  // Find primary criterion index (highest weight)
  let primaryIndex = -1;
  let maxWeight = -1;
  for (let cIndex = 0; cIndex < criteria.items.length; cIndex++) {
    if (criteria.items[cIndex].weight > maxWeight) {
      maxWeight = criteria.items[cIndex].weight;
      primaryIndex = cIndex;
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIndex < 0) return 0;
    const av = a.perCriterion[primaryIndex]?.average ?? 0;
    const bv = b.perCriterion[primaryIndex]?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Award top criteria badges to top-performing candidates per criterion
  for (let cIndex = 0; cIndex < criteria.items.length; cIndex++) {
    const criterion = criteria.items[cIndex];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[cIndex]?.average ?? 0;
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
