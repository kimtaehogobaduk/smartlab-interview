import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-a",
    name: "Alice",
    track: "Backend",
    studentId: "20260001",
    phone: "010-0000-0001",
    email: "alice@example.com",
    timeslot: { start: "10:00", end: "10:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "cand-2",
    roomId: "room-a",
    name: "Bob",
    track: "Frontend",
    studentId: "20260002",
    phone: "010-0000-0002",
    email: "bob@example.com",
    timeslot: { start: "10:30", end: "11:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "sub-1",
    roomId: "room-a",
    candidateId: "cand-1",
    interviewerName: "Interviewer 1",
    scores: [
      { criterionId: "tech", score: 80, bonusPoints: 5 },
      { criterionId: "comm", score: 90 },
    ],
    totalWeightedScore: 85,
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "sub-2",
    roomId: "room-a",
    candidateId: "cand-1",
    interviewerName: "Interviewer 2",
    scores: [
      { criterionId: "tech", score: 85 },
      { criterionId: "comm", score: 95 },
    ],
    totalWeightedScore: 89,
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "sub-3",
    roomId: "room-a",
    candidateId: "cand-2",
    interviewerName: "Interviewer 1",
    scores: [
      { criterionId: "tech", score: 70 },
      { criterionId: "comm", score: 75 },
    ],
    totalWeightedScore: 72,
    submittedAt: "2026-01-01T00:00:00Z",
  },
];

describe("scoring module", () => {
  describe("weightedTotal", () => {
    test("calculates weighted total score correctly with bonus points cap", () => {
      const scores = [
        { criterionId: "tech", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85
        { criterionId: "comm", score: 90 }, // 90
      ];
      // (85 * 60 / 100) + (90 * 40 / 100) = 51 + 36 = 87
      const result = weightedTotal(scores, mockCriteria.items);
      expect(result).toBe(87);
    });
  });

  describe("aggregate", () => {
    test("aggregates mean correctly", () => {
      expect(aggregate([80, 90, 100], "mean")).toBe(90);
    });

    test("aggregates median correctly", () => {
      expect(aggregate([10, 80, 100], "median")).toBe(80);
    });

    test("aggregates trimmed mean correctly", () => {
      expect(aggregate([10, 80, 85, 90, 100], "trimmed")).toBe(85);
    });
  });

  describe("buildLeaderboard", () => {
    test("ranks candidates accurately and attaches top criteria", () => {
      const leaderboard = buildLeaderboard(
        mockCandidates,
        mockSubmissions,
        mockCriteria,
        "trimmed",
      );

      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0]!.candidateId).toBe("cand-1");
      expect(leaderboard[0]!.rank).toBe(1);
      expect(leaderboard[1]!.candidateId).toBe("cand-2");
      expect(leaderboard[1]!.rank).toBe(2);

      // Verify top criteria assigned correctly
      expect(leaderboard[0]!.topCriteria).toContain("기술 역량");
      expect(leaderboard[0]!.topCriteria).toContain("의사소통");
    });

    test("handles empty submissions gracefully", () => {
      const leaderboard = buildLeaderboard(mockCandidates, [], mockCriteria, "trimmed");
      expect(leaderboard).toEqual([]);
    });
  });
});
