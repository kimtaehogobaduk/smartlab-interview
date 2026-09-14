import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  const criteria = [
    { id: "tech", name: "기술", weight: 50, description: "", maxScore: 100 },
    { id: "comm", name: "소통", weight: 50, description: "", maxScore: 100 },
  ];

  it("calculates weighted total correctly with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // 10 <= 80 * 0.1 (8) -> capped at 8 -> score 88
      { criterionId: "comm", score: 90, bonusPoints: 5 }, // 5 <= 90 * 0.1 (9) -> 5 -> score 95
    ];
    // (88 * 50) / 100 + (95 * 50) / 100 = 44 + 47.5 = 91.5
    expect(weightedTotal(scores, criteria)).toBe(91.5);
  });

  it("handles missing scores as 0", () => {
    const scores = [{ criterionId: "tech", score: 80, bonusPoints: 0 }];
    // (80 * 50) / 100 + 0 = 40
    expect(weightedTotal(scores, criteria)).toBe(40);
  });
});

describe("aggregate", () => {
  it("calculates mean", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
  });

  it("calculates median", () => {
    expect(aggregate([70, 90, 80], "median")).toBe(80);
    expect(aggregate([70, 80, 90, 100], "median")).toBe(85);
  });

  it("calculates trimmed mean", () => {
    // trims lowest (60) and highest (100), averages [80, 90] -> 85
    expect(aggregate([60, 80, 90, 100], "trimmed")).toBe(85);
    // falls back to mean if less than 3 values
    expect(aggregate([80, 90], "trimmed")).toBe(85);
  });
});

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술", weight: 60, description: "", maxScore: 100 },
      { id: "comm", name: "소통", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "c1",
      roomId: "room-1",
      name: "Alice",
      track: "웹",
      studentId: "1",
      phone: "010-0000-0000",
      email: "a@a.com",
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "c2",
      roomId: "room-1",
      name: "Bob",
      track: "AI",
      studentId: "2",
      phone: "010-0000-0001",
      email: "b@b.com",
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
      id: "s1",
      candidateId: "c1",
      roomId: "room-1",
      interviewerName: "I1",
      submittedAt: "",
      scores: [
        { criterionId: "tech", criterionName: "기술", score: 90, bonusPoints: 0, weight: 60 },
        { criterionId: "comm", criterionName: "소통", score: 80, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 86,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
    {
      id: "s2",
      candidateId: "c2",
      roomId: "room-1",
      interviewerName: "I1",
      submittedAt: "",
      scores: [
        { criterionId: "tech", criterionName: "기술", score: 70, bonusPoints: 0, weight: 60 },
        { criterionId: "comm", criterionName: "소통", score: 95, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 80,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  it("builds leaderboard and assigns rank and top criteria", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술");

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("소통");
  });
});
