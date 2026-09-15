import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "c1",
      roomId: "r1",
      name: "Alice",
      track: "Web",
      studentId: "1",
      phone: "010-0000-0001",
      email: "alice@test.com",
      timeslot: { start: "14:00", end: "14:30", room: "Room 1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "c2",
      roomId: "r1",
      name: "Bob",
      track: "Web",
      studentId: "2",
      phone: "010-0000-0002",
      email: "bob@test.com",
      timeslot: { start: "14:30", end: "15:00", room: "Room 1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "s1",
      candidateId: "c1",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01T00:00:00Z",
      scores: [
        { criterionId: "tech", score: 90, bonusPoints: 0 },
        { criterionId: "comm", score: 80, bonusPoints: 0 },
      ],
      totalWeightedScore: 86,
      comments: "Great",
    },
    {
      id: "s2",
      candidateId: "c2",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01T00:00:00Z",
      scores: [
        { criterionId: "tech", score: 70, bonusPoints: 0 },
        { criterionId: "comm", score: 75, bonusPoints: 0 },
      ],
      totalWeightedScore: 72,
      comments: "Good",
    },
  ];

  test("correctly calculates leaderboard ranks, scores and top criteria", () => {
    const result = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(result).toHaveLength(2);

    expect(result[0]?.candidateId).toBe("c1");
    expect(result[0]?.rank).toBe(1);
    expect(result[0]?.finalScore).toBe(86);
    expect(result[0]?.topCriteria).toContain("기술 역량");
    expect(result[0]?.topCriteria).toContain("의사소통");

    expect(result[1]?.candidateId).toBe("c2");
    expect(result[1]?.rank).toBe(2);
    expect(result[1]?.finalScore).toBe(72);
  });

  test("skips candidates without submissions", () => {
    const result = buildLeaderboard(candidates, [submissions[0]!], criteria, "weighted");
    expect(result).toHaveLength(1);
    expect(result[0]?.candidateId).toBe("c1");
  });
});
