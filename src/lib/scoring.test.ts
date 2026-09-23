import { describe, expect, test } from "bun:test";
import { weightedTotal, aggregate, buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring algorithm optimizations", () => {
  const criteria: CriteriaConfig = {
    items: [
      { id: "c1", name: "Criteria 1", weight: 40 },
      { id: "c2", name: "Criteria 2", weight: 60 },
    ],
  };

  const candidates: Candidate[] = Array.from({ length: 50 }, (_, i) => ({
    id: `cand-${i}`,
    name: `Candidate ${i}`,
    track: "Frontend",
    email: `cand${i}@example.com`,
  }));

  const submissions: EvaluationSubmission[] = [];
  for (const cand of candidates) {
    for (let p = 0; p < 5; p++) {
      submissions.push({
        id: `sub-${cand.id}-${p}`,
        roomId: "room-1",
        candidateId: cand.id,
        evaluatorId: `eval-${p}`,
        scores: [
          { criterionId: "c1", score: 80, bonusPoints: 5 },
          { criterionId: "c2", score: 90, bonusPoints: 0 },
        ],
        totalWeightedScore: 86,
        createdAt: new Date().toISOString(),
      });
    }
  }

  test("weightedTotal returns correct value", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, criteria.items);
    // c1: 80 + min(5, 8) = 85. 85 * 0.40 = 34
    // c2: 90 + 0 = 90. 90 * 0.60 = 54
    // Total = 88
    expect(total).toBe(88);
  });

  test("buildLeaderboard produces expected structure and ranks", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(leaderboard.length).toBe(50);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria.length).toBeGreaterThan(0);
  });
});
