import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring & leaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "weighted",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal calculates score with capped bonus points correctly", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 10 }, // 80 + min(10, 8) = 88 -> 88 * 0.6 = 52.8
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // 90 + min(5, 9) = 95 -> 95 * 0.4 = 38
    ];
    // Total = 52.8 + 38 = 90.8
    expect(weightedTotal(scores, criteria.items)).toBe(90.8);
  });

  test("buildLeaderboard computes scores, top criteria, and ranks candidates", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Frontend",
        studentId: "123",
        phone: "010-0000-0000",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-2",
        roomId: "room-1",
        name: "Bob",
        track: "Backend",
        studentId: "456",
        phone: "010-1111-1111",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "c1",
            criterionName: "Problem Solving",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          {
            criterionId: "c2",
            criterionName: "Communication",
            score: 80,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 86,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "c1",
            criterionName: "Problem Solving",
            score: 70,
            bonusPoints: 0,
            weight: 60,
          },
          {
            criterionId: "c2",
            criterionName: "Communication",
            score: 95,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].topCriteria).toContain("Problem Solving");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(80);
    expect(leaderboard[1].topCriteria).toContain("Communication");
  });
});
