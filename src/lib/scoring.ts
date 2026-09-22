import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

/**
 * Calculates weighted score using Map O(1) lookup per criterion instead of O(N) array search.
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
 * Builds the leaderboard items for candidates.
 * Performance Optimizations:
 * - Groups submissions by candidateId via Map: O(M) upfront vs O(N * M) nested filtering.
 * - Pre-maps primary criterion averages prior to sorting: avoids O(C) array searches inside comparator.
 * - Retains direct reference to best candidate item: avoids O(N) array lookup per criterion winner.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Group submissions by candidate ID for O(1) candidate lookup
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    const list = subsByCandidate.get(sub.candidateId);
    if (list) {
      list.push(sub);
    } else {
      subsByCandidate.set(sub.candidateId, [sub]);
    }
  }

  const items: LeaderboardItem[] = [];

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

    const perCriterion = new Array(criteria.items.length);
    for (let c = 0; c < criteria.items.length; c++) {
      const item = criteria.items[c];
      let sum = 0;
      for (let j = 0; j < subs.length; j++) {
        const scores = subs[j].scores;
        let scoreVal = 0;
        for (let k = 0; k < scores.length; k++) {
          if (scores[k].criterionId === item.id) {
            const x = scores[k];
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }
      perCriterion[c] = {
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

  // Find primary criterion (highest weight) without sorting the criteria array
  let primary: EvaluationCriterion | undefined;
  if (criteria.items.length > 0) {
    primary = criteria.items[0];
    for (let i = 1; i < criteria.items.length; i++) {
      if (criteria.items[i].weight > primary.weight) {
        primary = criteria.items[i];
      }
    }
  }

  // Precompute primary criterion averages to keep sort comparator O(1)
  const primaryId = primary?.id;
  const primaryAvgMap = new Map<string, number>();
  if (primaryId) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let avg = 0;
      for (let c = 0; c < item.perCriterion.length; c++) {
        if (item.perCriterion[c].criterionId === primaryId) {
          avg = item.perCriterion[c].average;
          break;
        }
      }
      primaryAvgMap.set(item.candidateId, avg);
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    const av = primaryAvgMap.get(a.candidateId) ?? 0;
    const bv = primaryAvgMap.get(b.candidateId) ?? 0;
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Top criteria calculation keeping direct reference to winning item
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winnerItem: LeaderboardItem | null = null;

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
        winnerItem = item;
      }
    }

    if (winnerItem && best > 0) {
      winnerItem.topCriteria.push(criterion.name);
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
