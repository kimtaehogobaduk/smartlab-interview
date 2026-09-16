import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  describe("weightedTotal", () => {
    test("calculates weighted total score correctly", () => {
      const criteria = [
        { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
        { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
      ];
      const scores = [
        { criterionId: "c1", score: 80 },
        { criterionId: "c2", score: 90 },
      ];
      expect(weightedTotal(scores, criteria)).toBe(84);
    });

    test("includes bonus points clamped at 10%", () => {
      const criteria = [
        { id: "c1", name: "Problem Solving", weight: 100, description: "", maxScore: 100 },
      ];
      const scores = [{ criterionId: "c1", score: 80, bonusPoints: 15 }];
      expect(weightedTotal(scores, criteria)).toBe(88);
    });
  });

  describe("aggregate", () => {
    test("calculates mean correctly", () => {
      expect(aggregate([80, 90, 100], "mean")).toBe(90);
    });

    test("calculates median correctly", () => {
      expect(aggregate([10, 80, 100], "median")).toBe(80);
    });

    test("calculates trimmed mean correctly", () => {
      expect(aggregate([10, 80, 90, 100], "trimmed")).toBe(85);
    });
  });

  describe("buildLeaderboard", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Frontend",
        studentId: "20240001",
        phone: "010-0000-0001",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "Room A" },
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
        studentId: "20240002",
        phone: "010-0000-0002",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "Room A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "Admin",
      formula: "mean",
      items: [
        { id: "c1", name: "Coding", weight: 60, description: "", maxScore: 100 },
        { id: "c2", name: "System Architecture", weight: 40, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub1",
        candidateId: "cand1",
        interviewerId: "p1",
        interviewerName: "Panel 1",
        scores: [
          { criterionId: "c1", score: 90 },
          { criterionId: "c2", score: 70 },
        ],
        totalWeightedScore: 82,
        notes: "Good candidate",
        submittedAt: new Date().toISOString(),
      },
      {
        id: "sub2",
        candidateId: "cand2",
        interviewerId: "p1",
        interviewerName: "Panel 1",
        scores: [
          { criterionId: "c1", score: 70 },
          { criterionId: "c2", score: 80 },
        ],
        totalWeightedScore: 74,
        notes: "Solid candidate",
        submittedAt: new Date().toISOString(),
      },
    ];

    test("ranks candidates correctly and assigns top criteria", () => {
      const result = buildLeaderboard(candidates, submissions, criteria, "mean");
      expect(result).toHaveLength(2);

      expect(result[0]?.candidateId).toBe("cand1");
      expect(result[0]?.rank).toBe(1);
      expect(result[0]?.finalScore).toBe(80);
      expect(result[0]?.topCriteria).toContain("Coding");

      expect(result[1]?.candidateId).toBe("cand2");
      expect(result[1]?.rank).toBe(2);
      expect(result[1]?.finalScore).toBe(75);
      expect(result[1]?.topCriteria).toContain("System Architecture");
    });
  });
});
