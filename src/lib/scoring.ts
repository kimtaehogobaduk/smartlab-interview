import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  EvaluationSubmission,
  Formula,
} from "./types";

// PERFORMANCE OPTIMIZATION: Index scores by criterionId using a Map for O(1) lookups instead of O(N) array search.
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

// PERFORMANCE OPTIMIZATION:
// 1. Group submissions by candidateId into a Map in O(S) time to eliminate O(C * S) nested filtering.
// 2. Compute criteria averages with direct loop lookups to eliminate O(C * K * S * M) searches.
// 3. Cache primary criterion ID to avoid O(C log C * K) sort comparator lookups.
// 4. Eliminate redundant items.find in top criteria winner selection by keeping direct reference to the winning item.
export function buildLeaderboard(
  candidates: Candidate[],
  submissions: EvaluationSubmission[],
  criteria: CriteriaConfig,
  formula: Formula,
): LeaderboardItem[] {
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
        totals[j] = sum / (s.scores.length || 1);
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let j = 0; j < criteria.items.length; j++) {
      const item = criteria.items[j];
      let sum = 0;
      for (let k = 0; k < subs.length; k++) {
        const s = subs[k];
        let scoreVal = 0;
        for (let p = 0; p < s.scores.length; p++) {
          if (s.scores[p].criterionId === item.id) {
            const x = s.scores[p];
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }
      perCriterion[j] = {
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

  const primary =
    criteria.items.length > 0
      ? [...criteria.items].sort((a, b) => b.weight - a.weight)[0]
      : undefined;
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

  for (let j = 0; j < criteria.items.length; j++) {
    const criterion = criteria.items[j];
    let best = -1;
    let winner: LeaderboardItem | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
