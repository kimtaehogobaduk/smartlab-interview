import { expect, test, describe } from "bun:test";
import { weightedTotal, aggregate, buildLeaderboard, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring.ts", () => {
  const criteria: CriteriaConfig = {
    formula: "mean",
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "PS", maxScore: 10 },
      { id: "c2", name: "Communication", weight: 40, description: "Comm", maxScore: 10 },
    ],
  };

  const candidates: Candidate[] = [
    { id: "cand1", name: "Alice", track: "Backend", note: "" },
    { id: "cand2", name: "Bob", track: "Frontend", note: "" },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "sub1",
      candidateId: "cand1",
      evaluatorName: "Eval 1",
      evaluatorRole: "Senior",
      scores: [
        { criterionId: "c1", score: 8, bonusPoints: 0 },
        { criterionId: "c2", score: 6, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 7.2,
      createdAt: "2025-01-01",
    },
    {
      id: "sub2",
      candidateId: "cand1",
      evaluatorName: "Eval 2",
      evaluatorRole: "Lead",
      scores: [
        { criterionId: "c1", score: 10, bonusPoints: 1 }, // bonus 1 <= 10*0.1=1
        { criterionId: "c2", score: 8, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 9.8,
      createdAt: "2025-01-01",
    },
    {
      id: "sub3",
      candidateId: "cand2",
      evaluatorName: "Eval 1",
      evaluatorRole: "Senior",
      scores: [
        { criterionId: "c1", score: 5, bonusPoints: 0 },
        { criterionId: "c2", score: 5, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 5.0,
      createdAt: "2025-01-01",
    },
  ];

  test("weightedTotal calculates score correctly with bonus points cap", () => {
    const total = weightedTotal(
      [
        { criterionId: "c1", score: 10, bonusPoints: 5 }, // capped at 1.0 (10*0.1), score becomes 11
        { criterionId: "c2", score: 5, bonusPoints: 0 },  // score 5
      ],
      criteria.items,
    );
    // (11 * 60 / 100) + (5 * 40 / 100) = 6.6 + 2.0 = 8.6
    expect(total).toBe(8.6);
  });

  test("aggregate formula options", () => {
    expect(aggregate([1, 2, 9], "mean")).toBe(4);
    expect(aggregate([1, 2, 9], "median")).toBe(2);
    expect(aggregate([1, 2, 9], "trimmed")).toBe(2);
  });

  test("buildLeaderboard computes correct scores and ranking", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);

    const alice = leaderboard.find((item) => item.candidateId === "cand1");
    expect(alice).toBeDefined();
    expect(alice?.rank).toBe(1);
    expect(alice?.panelCount).toBe(2);

    // Alice sub1 scores: c1=8, c2=6 (mean = 7)
    // Alice sub2 scores: c1=11 (10+1), c2=8 (mean = 9.5)
    // Mean of totals: (7 + 9.5) / 2 = 8.25 -> rounded to 8.3
    expect(alice?.finalScore).toBe(8.3);

    const bob = leaderboard.find((item) => item.candidateId === "cand2");
    expect(bob).toBeDefined();
    expect(bob?.rank).toBe(2);
  });

  test("toCsv exports leaderboard to CSV format", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
