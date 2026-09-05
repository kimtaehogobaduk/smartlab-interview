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

/** Helper to calculate effective score including bonus points cap (max 10% of score) */
function getEffectiveScore(score: number, bonusPoints?: number): number {
  return score + Math.min(Math.max(bonusPoints ?? 0, 0), score * 0.1);
}

/**
 * Optimized leaderboard aggregation algorithm.
 * Performance improvements:
 * 1. O(S) pre-grouping submissions by candidateId instead of O(N * S) repeated filter array scans.
 * 2. Single-pass score sum per criterion instead of O(C * S * K) nested searches.
 * 3. O(C) max-weight criterion lookup instead of Array sorting/copying.
 * 4. Direct indexing & single-pass winner tracking for tie-breakers and top criteria.
 */
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
  const items: LeaderboardItem[] = [];

  // 1. Group submissions by candidateId in O(S) time
  const subsByCandidate = new Map<string, EvaluationSubmission[]>();
  for (let i = 0; i < submissions.length; i++) {
    const s = submissions[i];
    let list = subsByCandidate.get(s.candidateId);
    if (!list) {
      list = [];
      subsByCandidate.set(s.candidateId, list);
    }
    list.push(s);
  }

  // 2. Identify primary criterion for tie-breaker in O(C) time
  let primary: EvaluationCriterion | undefined;
  for (let i = 0; i < criteria.items.length; i++) {
    const item = criteria.items[i];
    if (!primary || item.weight > primary.weight) {
      primary = item;
    }
  }

  // 3. Process each candidate
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const subs = subsByCandidate.get(candidate.id);
    if (!subs || subs.length === 0) continue;

    // Totals per submission
    const totals = new Array<number>(subs.length);
    if (formula === "mean") {
      for (let j = 0; j < subs.length; j++) {
        const scores = subs[j].scores;
        let sum = 0;
        for (let k = 0; k < scores.length; k++) {
          sum += getEffectiveScore(scores[k].score, scores[k].bonusPoints);
        }
        totals[j] = scores.length > 0 ? sum / scores.length : 0;
      }
    } else {
      for (let j = 0; j < subs.length; j++) {
        totals[j] = subs[j].totalWeightedScore;
      }
    }

    // Accumulate sums per criterion in single pass over scores
    const criterionSums = new Map<string, number>();
    for (let j = 0; j < subs.length; j++) {
      const scores = subs[j].scores;
      for (let k = 0; k < scores.length; k++) {
        const sc = scores[k];
        const eff = getEffectiveScore(sc.score, sc.bonusPoints);
        criterionSums.set(sc.criterionId, (criterionSums.get(sc.criterionId) ?? 0) + eff);
      }
    }

    const perCriterion = new Array<{ criterionId: string; name: string; average: number }>(
      criteria.items.length,
    );
    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      const sum = criterionSums.get(item.id) ?? 0;
      const avg = Math.round((sum / subs.length) * 10) / 10;
      perCriterion[j] = {
        criterionId: item.id,
        name: item.name,
        average: avg,
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

  // 4. Sort leaderboard items (with primary criterion score tie-breaker)
  const primaryId = primary?.id;
  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primaryId) return 0;
    let av = 0;
    let bv = 0;
    for (let i = 0; i < a.perCriterion.length; i++) {
      if (a.perCriterion[i].criterionId === primaryId) {
        av = a.perCriterion[i].average;
        break;
      }
    }
    for (let i = 0; i < b.perCriterion.length; i++) {
      if (b.perCriterion[i].criterionId === primaryId) {
        bv = b.perCriterion[i].average;
        break;
      }
    }
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // 5. Assign topCriteria to top performer per criterion
  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
    let best = -1;
    let winner: LeaderboardItem | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let value = 0;
      if (item.perCriterion[cIdx]?.criterionId === criterion.id) {
        value = item.perCriterion[cIdx].average;
      } else {
        for (let j = 0; j < item.perCriterion.length; j++) {
          if (item.perCriterion[j].criterionId === criterion.id) {
            value = item.perCriterion[j].average;
            break;
          }
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
