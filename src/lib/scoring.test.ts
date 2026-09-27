import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술", weight: 40, description: "", maxScore: 100 },
    { id: "problem", name: "문제", weight: 30, description: "", maxScore: 100 },
    { id: "comm", name: "소통", weight: 20, description: "", maxScore: 100 },
    { id: "fit", name: "태도", weight: 10, description: "", maxScore: 100 },
  ],
};

function generateTestData(numCandidates: number, subsPerCandidate: number) {
  const candidates: Candidate[] = [];
  const submissions: EvaluationSubmission[] = [];

  for (let i = 0; i < numCandidates; i++) {
    const candidateId = `cand-${i}`;
    candidates.push({
      id: candidateId,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: "웹개발",
      studentId: `202600${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@example.com`,
      timeslot: { start: "14:00", end: "14:30", room: "A" },
      status: "PENDING",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    });

    for (let j = 0; j < subsPerCandidate; j++) {
      submissions.push({
        candidateId,
        interviewerName: `Interviewer ${j}`,
        roomId: "room-1",
        scores: [
          { criterionId: "tech", score: 80 + (i % 20), bonusPoints: j },
          { criterionId: "problem", score: 70 + (i % 25), bonusPoints: 0 },
          { criterionId: "comm", score: 85 + (i % 10), bonusPoints: 1 },
          { criterionId: "fit", score: 90, bonusPoints: 0 },
        ],
        comment: "Good",
        submittedAt: new Date().toISOString(),
        totalWeightedScore: 80,
      });
    }
  }

  return { candidates, submissions };
}

describe("scoring buildLeaderboard", () => {
  test("calculates ranks and top criteria correctly", () => {
    const { candidates, submissions } = generateTestData(10, 3);
    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(10);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[9].rank).toBe(10);
  });

  test("benchmark buildLeaderboard", () => {
    const { candidates, submissions } = generateTestData(500, 10);
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(
      `Execution time for 20 calls (500 candidates, 5000 submissions): ${duration.toFixed(2)}ms`,
    );
  });
});
