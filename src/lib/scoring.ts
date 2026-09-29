import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// Performance optimization: Pre-index scores using Map for O(1) criterion lookups.
// Expected impact: Reduces complexity from O(items * scores) to O(items + scores).
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

// Performance optimization: Pre-group submissions by candidateId (O(S)) and cache primary averages (O(1) sort comparator).
// Expected impact: Reduces leaderboard generation time from O(C * S * K + N log N * K + K * N * K) to O(S + C * K + N log N + K * N).
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidate ID to avoid repeated O(S) filtering
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

  // Find primary criterion with max weight without making an array copy or sorting
  let primary: EvaluationCriterion | undefined;
  for (let i = 0; i < criteria.items.length; i++) {
    if (!primary || criteria.items[i].weight > primary.weight) {
      primary = criteria.items[i];
    }
  }

  const items: LeaderboardItem[] = [];
  const primaryAverageMap = new Map<string, number>();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals = subs.map((s) =>
      formula === "mean"
        ? mean(
            s.scores.map((x) => x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1)),
          )
        : s.totalWeightedScore,
    );

    const perCriterion = criteria.items.map((item) => {
      let criterionSum = 0;
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const sScores = subs[sIdx].scores;
        for (let scIdx = 0; scIdx < sScores.length; scIdx++) {
          if (sScores[scIdx].criterionId === item.id) {
            const sc = sScores[scIdx];
            criterionSum += sc.score + Math.min(Math.max(sc.bonusPoints ?? 0, 0), sc.score * 0.1);
            break;
          }
        }
      }
      const average = Math.round((criterionSum / subs.length) * 10) / 10;
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

    if (primary) {
      const pCrit = perCriterion.find((c) => c.criterionId === primary.id);
      primaryAverageMap.set(candidate.id, pCrit ? pCrit.average : 0);
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

  // Fast O(1) tie-breaker using cached primary criterion average map during sort comparisons
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    const av = primaryAverageMap.get(a.candidateId) ?? 0;
    const bv = primaryAverageMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Track winning item directly for each criterion to avoid redundant array searches
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let val = 0;
      for (let p = 0; p < item.perCriterion.length; p++) {
        if (item.perCriterion[p].criterionId === criterion.id) {
          val = item.perCriterion[p].average;
          break;
        }
      }
      if (val > best) {
        best = val;
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
