import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// Performance optimization: Pre-map scores by criterionId to avoid O(C * S) nested linear searches.
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

// Performance optimization: Pre-group submissions by candidateId (O(M)) and map scores per submission
// to avoid repeated O(N * M) filtering, O(N * C * S * P) nested searches, and repeated sort comparisons.
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
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

    // Pre-calculate mapped score objects for each submission of this candidate
    const subScoreMaps = new Array<Map<string, number>>(subs.length);
    const totals = new Array<number>(subs.length);

    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      const scoreMap = new Map<string, number>();

      for (let k = 0; k < s.scores.length; k++) {
        const x = s.scores[k];
        const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        scoreMap.set(x.criterionId, val);
      }
      subScoreMaps[j] = scoreMap;

      totals[j] = formula === "mean" ? mean(Array.from(scoreMap.values())) : s.totalWeightedScore;
    }

    const perCriterion = new Array<{ criterionId: string; name: string; average: number }>(
      criteria.items.length,
    );

    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      let criterionSum = 0;
      for (let k = 0; k < subScoreMaps.length; k++) {
        criterionSum += subScoreMaps[k].get(item.id) ?? 0;
      }
      perCriterion[j] = {
        criterionId: item.id,
        name: item.name,
        average: Math.round((criterionSum / subs.length) * 10) / 10,
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

  // Find primary criterion with highest weight once
  let primaryId: string | undefined;
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    if (criteria.items[i].weight > maxWeight) {
      maxWeight = criteria.items[i].weight;
      primaryId = criteria.items[i].id;
    }
  }

  // Pre-calculate primary average map for O(1) comparison in sort comparator
  const primaryAvgMap = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const p = items[i].perCriterion.find((c) => c.criterionId === primaryId);
      primaryAvgMap.set(items[i].candidateId, p?.average ?? 0);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    return (primaryAvgMap.get(b.candidateId) ?? 0) - (primaryAvgMap.get(a.candidateId) ?? 0);
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Find top performer for each criterion
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
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
