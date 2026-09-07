import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  const sampleCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      {
        id: "c1",
        name: "Technical",
        weight: 60,
        description: "Technical skills",
        maxScore: 100,
      },
      {
        id: "c2",
        name: "Communication",
        weight: 40,
        description: "Communication skills",
        maxScore: 100,
      },
    ],
  };

  describe("weightedTotal", () => {
    test("calculates weighted score with bonus points capped at 10%", () => {
      const scores = [
        { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85; 85 * 0.6 = 51
        { criterionId: "c2", score: 90, bonusPoints: 20 }, // bonus capped at 9; 90 + 9 = 99; 99 * 0.4 = 39.6
      ];
      const total = weightedTotal(scores, sampleCriteria.items);
      expect(total).toBe(90.6); // 51 + 39.6
    });

    test("returns 0 when no scores match criteria", () => {
      const total = weightedTotal([], sampleCriteria.items);
      expect(total).toBe(0);
    });
  });

  describe("aggregate", () => {
    test("calculates mean formula correctly", () => {
      expect(aggregate([80, 90, 100], "mean")).toBe(90);
    });

    test("calculates median formula correctly", () => {
      expect(aggregate([10, 50, 100], "median")).toBe(50);
      expect(aggregate([10, 30, 50, 100], "median")).toBe(40);
    });

    test("calculates trimmed formula correctly", () => {
      // trimmed removes min (10) and max (100), leaving mean of [50] = 50
      expect(aggregate([10, 50, 100], "trimmed")).toBe(50);
      // for < 3 items, falls back to mean
      expect(aggregate([20, 40], "trimmed")).toBe(30);
    });
  });

  describe("buildLeaderboard", () => {
    test("builds ranked leaderboard and resolves ties via primary criterion", () => {
      const candidates: Candidate[] = [
        {
          id: "cand-1",
          roomId: "room-1",
          name: "Alice",
          track: "Dev",
          studentId: "001",
          phone: "",
          email: "",
          timeslot: { start: "10:00", end: "10:30", room: "A" },
          status: "PENDING",
          documents: [],
          sttTranscript: [],
          aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
          mindMap: [],
        },
        {
          id: "cand-2",
          roomId: "room-1",
          name: "Bob",
          track: "Dev",
          studentId: "002",
          phone: "",
          email: "",
          timeslot: { start: "10:30", end: "11:00", room: "A" },
          status: "PENDING",
          documents: [],
          sttTranscript: [],
          aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
          mindMap: [],
        },
        {
          id: "cand-3",
          roomId: "room-1",
          name: "Charlie (No Submissions)",
          track: "Dev",
          studentId: "003",
          phone: "",
          email: "",
          timeslot: { start: "11:00", end: "11:30", room: "A" },
          status: "PENDING",
          documents: [],
          sttTranscript: [],
          aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
          mindMap: [],
        },
      ];

      // Give Alice and Bob the same total average score, but Alice higher in primary criterion 'c1' (weight 60)
      const submissions: EvaluationSubmission[] = [
        {
          candidateId: "cand-1",
          roomId: "room-1",
          interviewerName: "Interviewer A",
          scores: [
            { criterionId: "c1", score: 90 }, // Higher technical
            { criterionId: "c2", score: 70 },
          ],
          totalWeightedScore: 82,
          submittedAt: "2026-01-01T00:00:00Z",
        },
        {
          candidateId: "cand-2",
          roomId: "room-1",
          interviewerName: "Interviewer A",
          scores: [
            { criterionId: "c1", score: 70 },
            { criterionId: "c2", score: 90 }, // Higher comms, but lower primary
          ],
          totalWeightedScore: 82,
          submittedAt: "2026-01-01T00:00:00Z",
        },
      ];

      const result = buildLeaderboard(candidates, submissions, sampleCriteria, "mean");

      expect(result).toHaveLength(2);
      expect(result[0].candidateId).toBe("cand-1");
      expect(result[0].rank).toBe(1);
      expect(result[0].topCriteria).toContain("Technical");

      expect(result[1].candidateId).toBe("cand-2");
      expect(result[1].rank).toBe(2);
      expect(result[1].topCriteria).toContain("Communication");
    });
  });
});
