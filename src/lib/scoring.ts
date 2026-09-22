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

export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Optimization 1: Pre-group submissions by candidateId into a Map in O(S) time
  // to eliminate repeated O(S) array filtering inside the candidate loop.
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    const list = submissionsByCandidate.get(sub.candidateId);
    if (list) {
      list.push(sub);
    } else {
      submissionsByCandidate.set(sub.candidateId, [sub]);
    }
  }

  const items: LeaderboardItem[] = [];
  const criteriaItems = criteria.items;
  const numCriteria = criteriaItems.length;

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const panelCount = subs.length;

    // Calculate total scores per submission & accumulate criterion scores in one pass
    const totals: number[] = new Array(panelCount);
    const criterionSums = new Float64Array(numCriteria);

    for (let s = 0; s < panelCount; s++) {
      const sub = subs[s];
      if (formula === "mean") {
        let sum = 0;
        const scores = sub.scores;
        for (let k = 0; k < scores.length; k++) {
          const x = scores[k];
          const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          sum += val;

          // match criterion index
          for (let ci = 0; ci < numCriteria; ci++) {
            if (criteriaItems[ci].id === x.criterionId) {
              criterionSums[ci] += val;
              break;
            }
          }
        }
        totals[s] = scores.length > 0 ? sum / scores.length : 0;
      } else {
        totals[s] = sub.totalWeightedScore;
        const scores = sub.scores;
        for (let k = 0; k < scores.length; k++) {
          const x = scores[k];
          const val = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
          for (let ci = 0; ci < numCriteria; ci++) {
            if (criteriaItems[ci].id === x.criterionId) {
              criterionSums[ci] += val;
              break;
            }
          }
        }
      }
    }

    const perCriterion = new Array(numCriteria);
    for (let ci = 0; ci < numCriteria; ci++) {
      perCriterion[ci] = {
        criterionId: criteriaItems[ci].id,
        name: criteriaItems[ci].name,
        average: Math.round((criterionSums[ci] / panelCount) * 10) / 10,
      };
    }

    const finalScore = aggregate(totals, formula);
    items.push({
      candidateId: candidate.id,
      name: candidate.name,
      track: candidate.track,
      panelCount,
      finalScore,
      perCriterion,
      rank: 0,
      topCriteria: [],
    });
  }

  // Find primary criterion
  let primaryIdx = -1;
  let maxWeight = -1;
  for (let ci = 0; ci < numCriteria; ci++) {
    if (criteriaItems[ci].weight > maxWeight) {
      maxWeight = criteriaItems[ci].weight;
      primaryIdx = ci;
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIdx === -1) return 0;
    const av = a.perCriterion[primaryIdx]?.average ?? 0;
    const bv = b.perCriterion[primaryIdx]?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Top criteria selection
  for (let ci = 0; ci < numCriteria; ci++) {
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[ci].average;
      if (value > best) {
        best = value;
        winner = item;
      }
    }

    if (winner && best > 0) {
      winner.topCriteria.push(criteriaItems[ci].name);
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
