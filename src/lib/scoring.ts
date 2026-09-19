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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Performance optimization: Pre-group submissions by candidateId in O(M) time,
  // replacing repeated O(N*M) submissions.filter(...) calls.
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

    // Performance optimization: Single pass over submissions per candidate
    // to accumulate total formula scores and criterion sums in O(subs * scores) time.
    const totals: number[] = new Array(subs.length);
    const criterionSums = new Map<string, number>();

    for (let sIdx = 0; sIdx < subs.length; sIdx++) {
      const s = subs[sIdx];
      const scores = s.scores;

      for (let scIdx = 0; scIdx < scores.length; scIdx++) {
        const x = scores[scIdx];
        const scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        criterionSums.set(x.criterionId, (criterionSums.get(x.criterionId) ?? 0) + scoreVal);
      }

      if (formula === "mean") {
        let scoreSum = 0;
        for (let scIdx = 0; scIdx < scores.length; scIdx++) {
          const x = scores[scIdx];
          scoreSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[sIdx] = scores.length === 0 ? 0 : scoreSum / scores.length;
      } else {
        totals[sIdx] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      const sum = criterionSums.get(item.id) ?? 0;
      perCriterion[cIdx] = {
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

  // Performance optimization: Find primary criterion index beforehand for O(1) tie-breaking during sorting.
  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const primaryIndex = primary ? criteria.items.findIndex((c) => c.id === primary.id) : -1;

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

  // Performance optimization: Direct winner object reference and positional index lookup for top criteria
  // eliminating O(K * N * (K + N)) nested find calls.
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[cIdx]?.average ?? 0;
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
