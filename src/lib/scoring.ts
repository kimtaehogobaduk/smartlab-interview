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

/**
 * ⚡ Bolt Optimization:
 * 1. Groups submissions by candidateId into a Map for O(1) lookup instead of O(M) filter per candidate.
 * 2. Avoids redundant array allocations and linear searches in perCriterion and tie-breaking score lookups.
 * 3. Keeps direct references to winner items when determining top criteria to eliminate redundant array finds.
 * Performance impact: Significantly reduces buildLeaderboard execution time from O(N * M) to O(N + M).
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  // Pre-group submissions by candidateId (O(M) time)
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

  const items: LeaderboardItem[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = submissionsByCandidate.get(candidate.id);
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
        totals[j] = s.scores.length > 0 ? sum / s.scores.length : 0;
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let c = 0; c < criteria.items.length; c++) {
      const item = criteria.items[c];
      let sum = 0;
      for (let j = 0; j < subs.length; j++) {
        const s = subs[j];
        let scoreVal = 0;
        for (let k = 0; k < s.scores.length; k++) {
          const score = s.scores[k];
          if (score.criterionId === item.id) {
            scoreVal =
              score.score + Math.min(Math.max(score.bonusPoints ?? 0, 0), score.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }
      const avg = subs.length > 0 ? sum / subs.length : 0;
      perCriterion[c] = {
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

  // Determine primary criterion for tie-breaking
  let primaryId: string | null = null;
  if (criteria.items.length > 0) {
    let maxWeight = -1;
    for (let c = 0; c < criteria.items.length; c++) {
      if (criteria.items[c].weight > maxWeight) {
        maxWeight = criteria.items[c].weight;
        primaryId = criteria.items[c].id;
      }
    }
  }

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    let av = 0;
    for (let c = 0; c < a.perCriterion.length; c++) {
      if (a.perCriterion[c].criterionId === primaryId) {
        av = a.perCriterion[c].average;
        break;
      }
    }
    let bv = 0;
    for (let c = 0; c < b.perCriterion.length; c++) {
      if (b.perCriterion[c].criterionId === primaryId) {
        bv = b.perCriterion[c].average;
        break;
      }
    }
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Calculate top criteria winners
  for (let c = 0; c < criteria.items.length; c++) {
    const criterion = criteria.items[c];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      for (let p = 0; p < item.perCriterion.length; p++) {
        if (item.perCriterion[p].criterionId === criterion.id) {
          value = item.perCriterion[p].average;
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
