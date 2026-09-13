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
  // Performance optimization: Group submissions by candidateId in O(M) time
  // avoids repeatedly filtering the submissions array O(N * M) for N candidates and M submissions.
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
        let scoreSum = 0;
        for (let k = 0; k < s.scores.length; k++) {
          const x = s.scores[k];
          scoreSum += x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
        }
        totals[j] = s.scores.length > 0 ? scoreSum / s.scores.length : 0;
      } else {
        totals[j] = s.totalWeightedScore;
      }
    }

    const perCriterion = new Array(criteria.items.length);
    for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
      const item = criteria.items[cIdx];
      let sum = 0;
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const s = subs[sIdx];
        let scoreVal = 0;
        for (let k = 0; k < s.scores.length; k++) {
          if (s.scores[k].criterionId === item.id) {
            const x = s.scores[k];
            scoreVal = x.score + Math.min(Math.max(x.bonusPoints ?? 0, 0), x.score * 0.1);
            break;
          }
        }
        sum += scoreVal;
      }
      perCriterion[cIdx] = {
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

  items.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (!primary) return 0;
    let av = 0;
    for (let k = 0; k < a.perCriterion.length; k++) {
      if (a.perCriterion[k].criterionId === primary.id) {
        av = a.perCriterion[k].average;
        break;
      }
    }
    let bv = 0;
    for (let k = 0; k < b.perCriterion.length; k++) {
      if (b.perCriterion[k].criterionId === primary.id) {
        bv = b.perCriterion[k].average;
        break;
      }
    }
    return bv - av;
  });

  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  for (let cIdx = 0; cIdx < criteria.items.length; cIdx++) {
    const criterion = criteria.items[cIdx];
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
