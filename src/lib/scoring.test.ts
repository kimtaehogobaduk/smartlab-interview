import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring functions", () => {
  const mockCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal correctly computes weighted score with bonus points", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 },
      { criterionId: "c2", score: 90, bonusPoints: 2 },
    ];
    // c1: 80 + 5 = 85. 85 * 0.6 = 51
    // c2: 90 + 2 = 92. 92 * 0.4 = 36.8
    // total: 87.8
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(87.8);
  });

  test("weightedTotal caps bonusPoints at 10% of base score", () => {
    const scores = [
      { criterionId: "c1", score: 50, bonusPoints: 20 }, // 10% of 50 is 5, bonus clamped to 5 -> 55
      { criterionId: "c2", score: 50, bonusPoints: 0 },
    ];
    // c1: 55 * 0.6 = 33
    // c2: 50 * 0.4 = 20
    // total: 53
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(53);
  });

  test("aggregate calculates mean, median, trimmed", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40, 100], "trimmed")).toBe(30);
  });

  test("buildLeaderboard produces correct ranks and top criteria", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Frontend",
        studentId: "1001",
        phone: "010-1",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "Room A" },
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
        studentId: "1002",
        phone: "010-2",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "Room A" },
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
        interviewerName: "Interviewer A",
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
        qualitativeFeedback: { strengths: "Good", improvements: "None" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer A",
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
        qualitativeFeedback: { strengths: "Okay", improvements: "None" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "mean");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("Problem Solving");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("Communication");

    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
