import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  test("weightedTotal correctly computes weighted sum and bonus cap", () => {
    const items = [
      { id: "c1", name: "Criterion 1", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Criterion 2", weight: 40, description: "", maxScore: 100 },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85
      { criterionId: "c2", score: 90, bonusPoints: 15 }, // 90 + min(15, 9) = 99
    ];

    const result = weightedTotal(scores, items);
    // (85 * 0.6) + (99 * 0.4) = 51 + 39.6 = 90.6
    expect(result).toBe(90.6);
  });

  test("aggregate handles mean, median, and trimmed formulas", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([10, 50, 60, 100], "trimmed")).toBe(55); // mean of 50 and 60
  });

  test("buildLeaderboard aggregates submissions, calculates rank, tie-breaking, and top criteria", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Frontend",
        studentId: "1",
        phone: "",
        email: "",
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
        studentId: "2",
        phone: "",
        email: "",
        timeslot: { start: "10:30", end: "11:00", room: "A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      items: [
        { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
        { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          { criterionId: "c1", criterionName: "Problem Solving", score: 90, weight: 60 },
          { criterionId: "c2", criterionName: "Communication", score: 80, weight: 40 },
        ],
        totalWeightedScore: 86,
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          { criterionId: "c1", criterionName: "Problem Solving", score: 70, weight: 60 },
          { criterionId: "c2", criterionName: "Communication", score: 90, weight: 40 },
        ],
        totalWeightedScore: 78,
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
    expect(leaderboard[1].topCriteria).toContain("Communication");
  });
});
