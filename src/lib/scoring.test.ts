import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const sampleCriteria: CriteriaConfig = {
    formula: "mean",
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "" },
      { id: "c2", name: "Communication", weight: 40, description: "" },
    ],
  };

  const sampleCandidates: Candidate[] = [
    { id: "cand1", name: "Alice", track: "Frontend", status: "submitted" },
    { id: "cand2", name: "Bob", track: "Backend", status: "submitted" },
    { id: "cand3", name: "Charlie", track: "Frontend", status: "submitted" },
  ];

  const sampleSubmissions: EvaluationSubmission[] = [
    {
      id: "s1",
      candidateId: "cand1",
      evaluatorName: "Eval A",
      scores: [
        { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
        { criterionId: "c2", score: 90, bonusPoints: 0 }, // 90
      ],
      totalWeightedScore: 87,
      createdAt: new Date().toISOString(),
    },
    {
      id: "s2",
      candidateId: "cand1",
      evaluatorName: "Eval B",
      scores: [
        { criterionId: "c1", score: 90, bonusPoints: 0 }, // 90
        { criterionId: "c2", score: 100, bonusPoints: 0 }, // 100
      ],
      totalWeightedScore: 94,
      createdAt: new Date().toISOString(),
    },
    {
      id: "s3",
      candidateId: "cand2",
      evaluatorName: "Eval A",
      scores: [
        { criterionId: "c1", score: 70, bonusPoints: 0 }, // 70
        { criterionId: "c2", score: 70, bonusPoints: 0 }, // 70
      ],
      totalWeightedScore: 70,
      createdAt: new Date().toISOString(),
    },
  ];

  test("weightedTotal calculates score with capped bonus points", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 10 }, // bonus capped at 10% of 80 = 8. score = 88. weight 60% = 52.8
      { criterionId: "c2", score: 50, bonusPoints: -2 }, // bonus min 0. score = 50. weight 40% = 20.0
    ];
    // total = 52.8 + 20.0 = 72.8
    expect(weightedTotal(scores, sampleCriteria.items)).toBe(72.8);
  });

  test("aggregate formula implementations", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 90], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40, 100], "trimmed")).toBe(30);
  });

  test("buildLeaderboard produces correct ranks, scores, and topCriteria", () => {
    const leaderboard = buildLeaderboard(
      sampleCandidates,
      sampleSubmissions,
      sampleCriteria,
      "mean",
    );

    expect(leaderboard.length).toBe(2); // Charlie has no submissions

    // Alice should be rank 1
    const alice = leaderboard.find((item) => item.candidateId === "cand1");
    expect(alice).toBeDefined();
    expect(alice?.rank).toBe(1);
    expect(alice?.panelCount).toBe(2);

    // Check topCriteria assignment
    expect(alice?.topCriteria).toContain("Problem Solving");
    expect(alice?.topCriteria).toContain("Communication");

    const bob = leaderboard.find((item) => item.candidateId === "cand2");
    expect(bob).toBeDefined();
    expect(bob?.rank).toBe(2);
  });

  test("buildLeaderboard non-mean formula tiebreaker test", () => {
    const criteria: CriteriaConfig = {
      formula: "weighted",
      items: [
        { id: "c1", name: "Problem Solving", weight: 60, description: "" },
        { id: "c2", name: "Communication", weight: 40, description: "" },
      ],
    };
    const cands: Candidate[] = [
      { id: "c1", name: "Alpha", track: "Dev", status: "submitted" },
      { id: "c2", name: "Beta", track: "Dev", status: "submitted" },
    ];
    const subs: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "c1",
        evaluatorName: "E1",
        scores: [
          { criterionId: "c1", score: 80, bonusPoints: 0 },
          { criterionId: "c2", score: 80, bonusPoints: 0 },
        ],
        totalWeightedScore: 80,
        createdAt: "",
      },
      {
        id: "s2",
        candidateId: "c2",
        evaluatorName: "E1",
        scores: [
          { criterionId: "c1", score: 90, bonusPoints: 0 },
          { criterionId: "c2", score: 70, bonusPoints: 0 },
        ],
        totalWeightedScore: 80, // Tie on finalScore
        createdAt: "",
      },
    ];

    const leaderboard = buildLeaderboard(cands, subs, criteria, "weighted");
    // Beta has primary criterion average 90 vs Alpha's 80, so Beta should be rank 1
    expect(leaderboard[0]?.candidateId).toBe("c2");
    expect(leaderboard[1]?.candidateId).toBe("c1");
  });

  test("toCsv exports correct CSV string", () => {
    const leaderboard = buildLeaderboard(
      sampleCandidates,
      sampleSubmissions,
      sampleCriteria,
      "mean",
    );
    const csv = toCsv(leaderboard, sampleCriteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,Problem Solving(60%),Communication(40%)",
    );
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
