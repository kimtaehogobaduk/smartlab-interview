import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
    { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 20, description: "", maxScore: 100 },
    { id: "fit", name: "태도/조직적합도", weight: 10, description: "", maxScore: 100 },
  ],
};

function generateTestData(numCandidates: number, numSubmissionsPerCandidate: number) {
  const candidates: Candidate[] = [];
  const submissions: EvaluationSubmission[] = [];

  for (let i = 0; i < numCandidates; i++) {
    const candidateId = `cand-${i}`;
    candidates.push({
      id: candidateId,
      roomId: "room-a",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "웹개발" : "AI 엔지니어링",
      studentId: `2026${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@example.com`,
      timeslot: { start: "14:00", end: "14:30", room: "A 면접실" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    });

    for (let j = 0; j < numSubmissionsPerCandidate; j++) {
      submissions.push({
        candidateId,
        roomId: "room-a",
        interviewerName: `Interviewer ${j}`,
        scores: [
          { criterionId: "tech", score: 80 + (i % 20), bonusPoints: 2 },
          { criterionId: "problem", score: 75 + (i % 20), bonusPoints: 0 },
          { criterionId: "comm", score: 85 + (i % 10), bonusPoints: 1 },
          { criterionId: "fit", score: 90, bonusPoints: 0 },
        ],
        totalWeightedScore: 82 + (i % 15),
        submittedAt: new Date().toISOString(),
      });
    }
  }

  return { candidates, submissions };
}

describe("buildLeaderboard", () => {
  test("correctness on small dataset", () => {
    const { candidates, submissions } = generateTestData(3, 2);
    const result = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");

    expect(result.length).toBe(3);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
    expect(result[0].perCriterion.length).toBe(4);
  });

  test("performance benchmark", () => {
    const { candidates, submissions } = generateTestData(500, 5);
    const start = performance.now();
    for (let k = 0; k < 10; k++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(`buildLeaderboard 10 runs for 500 candidates: ${duration.toFixed(2)}ms`);
    expect(duration).toBeGreaterThan(0);
  });
});
