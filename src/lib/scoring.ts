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
  const items: LeaderboardItem[] = [];

  // Optimization: Group submissions by candidateId in a Map to reduce filtering from O(N*S) to O(S).
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    let list = submissionsByCandidate.get(sub.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(sub.candidateId, list);
    }
    list.push(sub);
  }

  for (let c = 0; c < candidates.length; c++) {
    const candidate = candidates[c];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const totals: number[] = new Array(subs.length);
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (formula === "mean") {
        const scoreVals: number[] = new Array(s.scores.length);
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          scoreVals[j] = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[i] = mean(scoreVals);
      } else {
        totals[i] = s.totalWeightedScore;
      }
    }

    const perCriterion = criteria.items.map((item) => {
      const criterionScores: number[] = new Array(subs.length);
      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        let scoreVal = 0;
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          if (x.criterionId === item.id) {
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        criterionScores[i] = scoreVal;
      }
      return {
        criterionId: item.id,
        name: item.name,
        average: Math.round(mean(criterionScores) * 10) / 10,
      };
    });

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

  // Find primary criterion index for fast tie-breaker sorting without .find() inside sort
  let primaryIdx = -1;
  let maxWeight = -Infinity;
  for (let i = 0; i < criteria.items.length; i++) {
    if (criteria.items[i].weight > maxWeight) {
      maxWeight = criteria.items[i].weight;
      primaryIdx = i;
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (primaryIdx < 0) return 0;
    const av = a.perCriterion[primaryIdx]?.average ?? 0;
    const bv = b.perCriterion[primaryIdx]?.average ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  for (let critIdx = 0; critIdx < criteria.items.length; critIdx++) {
    const criterion = criteria.items[critIdx];
    let best = -1;
    let winner: LeaderboardItem | undefined = undefined;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const value = item.perCriterion[critIdx]?.average ?? 0;
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
