import { describe, expect, it } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    items: [
      { id: "c1", name: "Coding", weight: 60, scaleMax: 10 },
      { id: "c2", name: "Communication", weight: 40, scaleMax: 10 },
    ],
  };

  const candidates: Candidate[] = [
    { id: "cand1", name: "Alice", track: "Frontend", memo: "" },
    { id: "cand2", name: "Bob", track: "Backend", memo: "" },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "s1",
      candidateId: "cand1",
      evaluatorId: "p1",
      evaluatorName: "Panel 1",
      scores: [
        { criterionId: "c1", score: 8, bonusPoints: 0 },
        { criterionId: "c2", score: 9, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 8.4,
      createdAt: "2025-01-01",
    },
    {
      id: "s2",
      candidateId: "cand1",
      evaluatorId: "p2",
      evaluatorName: "Panel 2",
      scores: [
        { criterionId: "c1", score: 10, bonusPoints: 1 },
        { criterionId: "c2", score: 7, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 8.8,
      createdAt: "2025-01-01",
    },
    {
      id: "s3",
      candidateId: "cand2",
      evaluatorId: "p1",
      evaluatorName: "Panel 1",
      scores: [
        { criterionId: "c1", score: 6, bonusPoints: 0 },
        { criterionId: "c2", score: 10, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 7.6,
      createdAt: "2025-01-01",
    },
  ];

  it("calculates leaderboard correctly with weighted total score", () => {
    const result = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(result).toHaveLength(2);

    const alice = result.find((r) => r.candidateId === "cand1");
    const bob = result.find((r) => r.candidateId === "cand2");

    expect(alice).toBeDefined();
    expect(bob).toBeDefined();

    expect(alice?.rank).toBe(1);
    expect(bob?.rank).toBe(2);

    expect(alice?.panelCount).toBe(2);
    expect(bob?.panelCount).toBe(1);

    // Alice c1 average: (8 + 10 + min(1, 1)) / 2 = (8 + 11) / 2 = 9.5
    // Alice c2 average: (9 + 7) / 2 = 8
    const aliceC1 = alice?.perCriterion.find((c) => c.criterionId === "c1");
    const aliceC2 = alice?.perCriterion.find((c) => c.criterionId === "c2");
    expect(aliceC1?.average).toBe(9.5);
    expect(aliceC2?.average).toBe(8);

    expect(alice?.topCriteria).toContain("Coding");
  });

  it("calculates leaderboard correctly with mean formula", () => {
    const result = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(result).toHaveLength(2);
    expect(result[0].candidateId).toBe("cand1");
  });

  it("handles empty submissions gracefully", () => {
    const result = buildLeaderboard(candidates, [], criteria, "weighted");
    expect(result).toEqual([]);
  });

  it("handles candidates with no submissions", () => {
    const candidateNoSub: Candidate = { id: "cand3", name: "Charlie", track: "DevOps", memo: "" };
    const result = buildLeaderboard(
      [...candidates, candidateNoSub],
      submissions,
      criteria,
      "weighted",
    );
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.candidateId === "cand3")).toBeUndefined();
  });

  it("benchmarks buildLeaderboard performance with larger dataset", () => {
    const testCriteria: CriteriaConfig = {
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `crit_${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        scaleMax: 10,
      })),
    };

    const testCandidates: Candidate[] = Array.from({ length: 200 }, (_, i) => ({
      id: `cand_${i}`,
      name: `Candidate ${i}`,
      track: `Track ${i % 5}`,
      memo: "",
    }));

    const testSubmissions: EvaluationSubmission[] = [];
    for (let i = 0; i < 200; i++) {
      for (let p = 0; p < 5; p++) {
        testSubmissions.push({
          id: `sub_${i}_${p}`,
          candidateId: `cand_${i}`,
          evaluatorId: `eval_${p}`,
          evaluatorName: `Evaluator ${p}`,
          scores: testCriteria.items.map((c) => ({
            criterionId: c.id,
            score: 7 + (i % 3),
            bonusPoints: 0.5,
          })),
          comment: "",
          totalWeightedScore: 7.5,
          createdAt: "2025-01-01",
        });
      }
    }

    const start = performance.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      buildLeaderboard(testCandidates, testSubmissions, testCriteria, "weighted");
    }
    const duration = performance.now() - start;
    console.log(
      `[Benchmark] ${iterations} runs completed in ${duration.toFixed(2)} ms (${(duration / iterations).toFixed(3)} ms/op)`,
    );
    expect(duration).toBeGreaterThan(0);
  });
});
