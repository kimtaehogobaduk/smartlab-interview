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

// Performance optimization: Pre-group submissions by candidate ID (O(S))
// and optimize nested criterion lookups from O(N * M) to O(1) using Maps.
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Map candidateId -> submissions
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
  // Store criterionId -> Map<candidateId, averageScore> for fast tie-breaking & top criteria lookup
  const scoresByCriterionAndCandidate = new Map<string, Map<string, number>>();
  for (let i = 0; i < criteria.items.length; i++) {
    scoresByCriterionAndCandidate.set(criteria.items[i].id, new Map());
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let j = 0; j < subs.length; j++) {
      const s = subs[j];
      if (formula === "mean") {
        let sum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          const x = s.scores[k];
          sum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[j] = sum / s.scores.length;
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion: { criterionId: string; name: string; average: number }[] = [];
    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      let criterionSum = 0;
      for (let k = 0; k < subs.length; k++) {
        const s = subs[k];
        let scoreVal = 0;
        for (let l = 0; l < s.scores.length; l++) {
          if (s.scores[l].criterionId === item.id) {
            const x = s.scores[l];
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        criterionSum += scoreVal;
      }
      const average = Math.round((criterionSum / subs.length) * 10) / 10;
      perCriterion.push({
        criterionId: item.id,
        name: item.name,
        average,
      });
      scoresByCriterionAndCandidate.get(item.id)?.set(candidate.id, average);
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

  // Find primary criterion with highest weight for tie-breaking
  let primaryId: string | null = null;
  let maxWeight = -1;
  for (let i = 0; i < criteria.items.length; i++) {
    if (criteria.items[i].weight > maxWeight) {
      maxWeight = criteria.items[i].weight;
      primaryId = criteria.items[i].id;
    }
  }

  const primaryMap = primaryId ? scoresByCriterionAndCandidate.get(primaryId) : null;

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryMap) return 0;
    const av = primaryMap.get(a.candidateId) ?? 0;
    const bv = primaryMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // O(1) map lookups to determine top criteria winners per criterion
  const candidateItemMap = new Map<string, LeaderboardItem>();
  for (let i = 0; i < items.length; i++) {
    candidateItemMap.set(items[i].candidateId, items[i]);
  }

  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    const candidateMap = scoresByCriterionAndCandidate.get(criterion.id);
    if (!candidateMap) continue;

    let best = -1;
    let bestId = "";
    for (const [candidateId, val] of candidateMap.entries()) {
      if (val > best) {
        best = val;
        bestId = candidateId;
      }
    }
    if (best > 0 && bestId) {
      const winner = candidateItemMap.get(bestId);
      if (winner) {
        winner.topCriteria.push(criterion.name);
      }
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
