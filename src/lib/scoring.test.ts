import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring - buildLeaderboard", () => {
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
      name: "Cand 1",
      track: "Web",
      studentId: "1",
      phone: "1",
      email: "1@a.com",
      timeslot: { start: "10:00", end: "10:30", room: "r1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "c2",
      roomId: "r1",
      name: "Cand 2",
      track: "Web",
      studentId: "2",
      phone: "2",
      email: "2@a.com",
      timeslot: { start: "10:30", end: "11:00", room: "r1" },
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
      roomId: "r1",
      candidateId: "c1",
      interviewerName: "Iv 1",
      totalWeightedScore: 80,
      scores: [
        { criterionId: "tech", score: 80, bonusPoints: 0 },
        { criterionId: "comm", score: 80, bonusPoints: 0 },
      ],
      submittedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "s2",
      roomId: "r1",
      candidateId: "c2",
      interviewerName: "Iv 1",
      totalWeightedScore: 90,
      scores: [
        { criterionId: "tech", score: 90, bonusPoints: 0 },
        { criterionId: "comm", score: 90, bonusPoints: 0 },
      ],
      submittedAt: "2026-01-01T00:00:00Z",
    },
  ];

  test("correctly calculates leaderboard ranks and top criteria", () => {
    const result = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    expect(result).toHaveLength(2);
    expect(result[0].candidateId).toBe("c2");
    expect(result[0].rank).toBe(1);
    expect(result[0].finalScore).toBe(90);
    expect(result[0].topCriteria).toEqual(["기술 역량", "의사소통"]);

    expect(result[1].candidateId).toBe("c1");
    expect(result[1].rank).toBe(2);
    expect(result[1].finalScore).toBe(80);
  });
});
