import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    confirmedAt: "2026-01-01",
    confirmedBy: "admin",
    formula: "weighted",
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, maxScore: 100, description: "" },
      { id: "c2", name: "Communication", weight: 40, maxScore: 100, description: "" },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand1",
      roomId: "room1",
      name: "Alice",
      track: "Frontend",
      timeslot: { start: "10:00", end: "10:30" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand2",
      roomId: "room1",
      name: "Bob",
      track: "Backend",
      timeslot: { start: "10:30", end: "11:00" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "sub1",
      roomId: "room1",
      candidateId: "cand1",
      interviewerId: "int1",
      interviewerName: "Interviewer 1",
      scores: [
        { criterionId: "c1", score: 80, bonusPoints: 0 },
        { criterionId: "c2", score: 90, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 84,
      submittedAt: "2026-01-01T10:30:00Z",
    },
    {
      id: "sub2",
      roomId: "room1",
      candidateId: "cand2",
      interviewerId: "int1",
      interviewerName: "Interviewer 1",
      scores: [
        { criterionId: "c1", score: 90, bonusPoints: 0 },
        { criterionId: "c2", score: 70, bonusPoints: 0 },
      ],
      comment: "",
      totalWeightedScore: 82,
      submittedAt: "2026-01-01T11:00:00Z",
    },
  ];

  test("calculates scores and ranks correctly", () => {
    const result = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(result).toHaveLength(2);
    expect(result[0].candidateId).toBe("cand1");
    expect(result[0].rank).toBe(1);
    expect(result[0].finalScore).toBe(84);
    expect(result[1].candidateId).toBe("cand2");
    expect(result[1].rank).toBe(2);
    expect(result[1].finalScore).toBe(82);
  });
});
