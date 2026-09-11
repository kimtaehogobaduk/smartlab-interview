import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    items: [
      { id: "tech", name: "기술", weight: 60, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "c1",
      roomId: "r1",
      name: "Alice",
      track: "Web",
      studentId: "101",
      phone: "",
      email: "",
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
      name: "Bob",
      track: "AI",
      studentId: "102",
      phone: "",
      email: "",
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
      candidateId: "c1",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01T00:00:00Z",
      scores: [
        { criterionId: "tech", criterionName: "기술", score: 80, bonusPoints: 2, weight: 60 },
        { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 85.2,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
    {
      id: "s2",
      candidateId: "c2",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01T00:00:00Z",
      scores: [
        { criterionId: "tech", criterionName: "기술", score: 95, bonusPoints: 5, weight: 60 },
        { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 85,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  it("calculates weightedTotal correctly with bonus cap", () => {
    // bonus capped at score * 0.1
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 2 }, // 82 * 0.6 = 49.2
      { criterionId: "comm", score: 90, bonusPoints: 0 }, // 90 * 0.4 = 36.0
    ];
    expect(weightedTotal(scores, criteria.items)).toBe(85.2);
  });

  it("aggregates mean, median, trimmed values", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40, 100], "trimmed")).toBe(30);
  });

  it("builds leaderboard correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);
    // Alice's mean is (82 + 90)/2 = 86
    // Bob's mean is (100 + 70)/2 = 85
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[0].topCriteria).toContain("의사소통");
    expect(leaderboard[1].topCriteria).toContain("기술");
  });

  it("generates csv format", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain("순위,이름,트랙");
    expect(csv).toContain("Bob");
    expect(csv).toContain("Alice");
  });
});
