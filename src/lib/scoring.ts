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
 * Optimized Leaderboard Builder
 * Reduces complexity from O(N * S + N * K^2 * M) to O(S + N * K + N log N):
 * - Groups submissions by candidateId using a Map (O(S))
 * - Single-pass accumulator for per-criterion scores & totals
 * - Pre-computes primary criterion scores for O(1) tie-breaking during sorting
 * - Tracks top criteria winners directly without redundant array lookups
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId in O(S) time
  const submissionsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = submissionsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      submissionsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  const primary = [...criteria.items].sort((a, b) => b.weight - a.weight)[0];
  const items: (LeaderboardItem & { primaryScore?: number })[] = [];

  for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
    const candidate = candidates[cIdx];
    const subs = submissionsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    const panelCount = subs.length;
    const totals: number[] = new Array(panelCount);
    const criterionSums = new Map<string, number>();

    // Single pass over submissions for candidate
    for (let i = 0; i < panelCount; i++) {
      const s = subs[i];
      if (formula === "mean") {
        let sumScore = 0;
        for (let j = 0; j < s.scores.length; j++) {
          const x = s.scores[j];
          const bonus = x.bonusPoints ?? 0;
          const adjustedBonus = Math.min(Math.max(bonus, 0), x.score * 0.1);
          sumScore += x.score + adjustedBonus;
        }
        totals[i] = s.scores.length > 0 ? sumScore / s.scores.length : 0;
      } else {
        totals[i] = s.totalWeightedScore;
      }

      for (let j = 0; j < s.scores.length; j++) {
        const scoreObj = s.scores[j];
        const bonus = scoreObj.bonusPoints ?? 0;
        const adjustedBonus = Math.min(Math.max(bonus, 0), scoreObj.score * 0.1);
        const scoreVal = scoreObj.score + adjustedBonus;
        criterionSums.set(
          scoreObj.criterionId,
          (criterionSums.get(scoreObj.criterionId) ?? 0) + scoreVal,
        );
      }
    }

    let primaryScore = 0;
    const perCriterion = criteria.items.map((item) => {
      const sum = criterionSums.get(item.id) ?? 0;
      const average = Math.round((sum / panelCount) * 10) / 10;
      if (primary && item.id === primary.id) {
        primaryScore = average;
      }
      return {
        criterionId: item.id,
        name: item.name,
        average,
      };
    });

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
      primaryScore,
    });
  }

  // Fast tie-breaking sort with precomputed primary score
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return (b.primaryScore ?? 0) - (a.primaryScore ?? 0);
  });

  items.forEach((item, i) => {
    item.rank = i + 1;
    delete item.primaryScore;
  });

  // Top criteria badges in single pass
  for (let i = 0; i < criteria.items.length; i++) {
    const criterion = criteria.items[i];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      for (let k = 0; k < item.perCriterion.length; k++) {
        const c = item.perCriterion[k];
        if (c.criterionId === criterion.id) {
          if (c.average > best) {
            best = c.average;
            winner = item;
          }
          break;
        }
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
