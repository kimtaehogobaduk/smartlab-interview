import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate } from "./scoring";
import type { Candidate, EvaluationSubmission, CriteriaConfig } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "Tech", weight: 40, description: "", maxScore: 100 },
    { id: "c2", name: "Problem", weight: 30, description: "", maxScore: 100 },
    { id: "c3", name: "Comm", weight: 20, description: "", maxScore: 100 },
    { id: "c4", name: "Fit", weight: 10, description: "", maxScore: 100 },
  ],
};

function generateData(candidateCount: number, submissionsPerCandidate: number) {
  const candidates: Candidate[] = [];
  const submissions: EvaluationSubmission[] = [];

  for (let i = 0; i < candidateCount; i++) {
    const cid = `cand-${i}`;
    candidates.push({
      id: cid,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: "Web",
      studentId: `2026${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@example.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "PENDING",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    });

    for (let j = 0; j < submissionsPerCandidate; j++) {
      submissions.push({
        candidateId: cid,
        roomId: "room-1",
        interviewerName: `Interviewer ${j}`,
        scores: [
          { criterionId: "c1", score: 80 + (i % 20), bonusPoints: 2 },
          { criterionId: "c2", score: 75 + (i % 15), bonusPoints: 0 },
          { criterionId: "c3", score: 90 + (i % 10), bonusPoints: 5 },
          { criterionId: "c4", score: 85 + (i % 10), bonusPoints: 0 },
        ],
        totalWeightedScore: 82.5 + (i % 10),
        feedback: "Good",
        submittedAt: new Date().toISOString(),
      });
    }
  }

  return { candidates, submissions };
}

describe("scoring tests", () => {
  test("weightedTotal calculates score with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "c1", score: 100, bonusPoints: 15 }, // bonus capped at 10 (10% of 100) -> 110
      { criterionId: "c2", score: 50, bonusPoints: 2 }, // bonus 2 (capped at 5) -> 52
    ];

    const result = weightedTotal(scores, mockCriteria.items);
    // (110 * 40 / 100) + (52 * 30 / 100) = 44 + 15.6 = 59.6
    expect(result).toBe(59.6);
  });

  test("buildLeaderboard computes ranks and topCriteria correctly", () => {
    const { candidates, submissions } = generateData(10, 3);
    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(10);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[9].rank).toBe(10);
    // Verify perCriterion structure
    expect(leaderboard[0].perCriterion.length).toBe(4);
  });

  test("buildLeaderboard performance benchmark", () => {
    const { candidates, submissions } = generateData(500, 5); // 500 candidates, 2500 submissions
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(
      `10 iterations of buildLeaderboard (500 candidates, 2500 subs): ${duration.toFixed(2)}ms`,
    );
  });
});
