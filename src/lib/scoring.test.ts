import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "Criterion 1", weight: 60, description: "Desc 1", maxScore: 100 },
    { id: "c2", name: "Criterion 2", weight: 40, description: "Desc 2", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Frontend",
    studentId: "101",
    phone: "010-1111-1111",
    email: "alice@example.com",
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
    studentId: "102",
    phone: "010-2222-2222",
    email: "bob@example.com",
    timeslot: { start: "10:30", end: "11:00", room: "Room A" },
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
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "Interviewer A",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "c1", criterionName: "Criterion 1", score: 80, bonusPoints: 5, weight: 60 },
      { criterionId: "c2", criterionName: "Criterion 2", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 87,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-2",
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "Interviewer B",
    submittedAt: "2026-01-01T00:05:00Z",
    scores: [
      { criterionId: "c1", criterionName: "Criterion 1", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "c2", criterionName: "Criterion 2", score: 100, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 94,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-3",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer A",
    submittedAt: "2026-01-01T00:10:00Z",
    scores: [
      { criterionId: "c1", criterionName: "Criterion 1", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "c2", criterionName: "Criterion 2", score: 60, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 66,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring", () => {
  it("computes weightedTotal accurately with bonus points capped at 10%", () => {
    // c1: score 80 + bonus 5 = 85. Weight 60 -> 85 * 0.6 = 51
    // c2: score 90 + bonus 0 = 90. Weight 40 -> 90 * 0.4 = 36
    // total = 87
    const result = weightedTotal(
      [
        { criterionId: "c1", score: 80, bonusPoints: 5 },
        { criterionId: "c2", score: 90, bonusPoints: 0 },
      ],
      mockCriteria.items,
    );
    expect(result).toBe(87);
  });

  it("handles bonus points larger than 10% cap", () => {
    // c1: score 80 + bonus 20 (capped at 80 * 0.1 = 8) = 88. Weight 60 -> 88 * 0.6 = 52.8
    // c2: score 50 + bonus 0 = 50. Weight 40 -> 50 * 0.4 = 20
    // total = 72.8
    const result = weightedTotal(
      [
        { criterionId: "c1", score: 80, bonusPoints: 20 },
        { criterionId: "c2", score: 50, bonusPoints: 0 },
      ],
      mockCriteria.items,
    );
    expect(result).toBe(72.8);
  });

  it("aggregates values according to specified formula", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 30], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
    expect(aggregate([10, 80, 90, 100], "trimmed")).toBe(85);
  });

  it("builds leaderboard correctly and ranks candidates", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(90.5); // mean of 87 and 94

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(66);
  });

  it("exports CSV formatted string", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,Criterion 1(60%),Criterion 2(40%)");
    expect(csv).toContain("1,Alice,Frontend,2,90.5,87.5,95");
  });
});
