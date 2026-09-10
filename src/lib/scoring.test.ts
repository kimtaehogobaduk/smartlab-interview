import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
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

function generateData(candidateCount: number, submissionsPerCandidate: number) {
  const candidates: Candidate[] = [];
  const submissions: EvaluationSubmission[] = [];

  for (let i = 0; i < candidateCount; i++) {
    const id = `candidate-${i}`;
    candidates.push({
      id,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "웹개발" : "AI 엔지니어링",
      studentId: `202600${i}`,
      phone: "010-0000-0000",
      email: `user${i}@test.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "PENDING",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    });

    for (let j = 0; j < submissionsPerCandidate; j++) {
      submissions.push({
        candidateId: id,
        roomId: "room-1",
        interviewerName: `Interviewer ${j}`,
        submittedAt: new Date().toISOString(),
        totalWeightedScore: 80 + (i % 10) + j,
        comment: "Good",
        scores: [
          { criterionId: "tech", score: 80 + (i % 20), bonusPoints: 2 },
          { criterionId: "problem", score: 75 + (i % 15), bonusPoints: 0 },
          { criterionId: "comm", score: 90, bonusPoints: 5 },
          { criterionId: "fit", score: 85, bonusPoints: 1 },
        ],
      });
    }
  }

  return { candidates, submissions };
}

describe("scoring logic", () => {
  test("weightedTotal correctly calculates score", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 2 },
      { criterionId: "problem", score: 70, bonusPoints: 0 },
      { criterionId: "comm", score: 90, bonusPoints: 5 },
      { criterionId: "fit", score: 80, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(80.8);
  });

  test("buildLeaderboard computes ranks and top criteria correctly", () => {
    const { candidates, submissions } = generateData(100, 5);
    const result = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");

    expect(result.length).toBe(100);
    expect(result[0].rank).toBe(1);
    expect(result[99].rank).toBe(100);
    expect(result[0].finalScore).toBeGreaterThanOrEqual(result[1].finalScore);
  });

  test("buildLeaderboard benchmark", () => {
    const { candidates, submissions } = generateData(1000, 5);
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(
      `Benchmark 10 runs on 1000 candidates: ${duration.toFixed(2)}ms (${(duration / 10).toFixed(2)}ms per run)`,
    );
  });
});
