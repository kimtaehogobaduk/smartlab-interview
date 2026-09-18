import { describe, expect, it } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  it("calculates weighted total correctly with bonus points cap", () => {
    const items = [
      { id: "c1", name: "Tech", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "Comm", weight: 50, description: "", maxScore: 100 },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85
      { criterionId: "c2", score: 90, bonusPoints: 15 }, // 90 + min(15, 9) = 99
    ];
    // (85 * 0.5) + (99 * 0.5) = 42.5 + 49.5 = 92
    expect(weightedTotal(scores, items)).toBe(92);
  });

  it("handles missing criterion scores gracefully", () => {
    const items = [
      { id: "c1", name: "Tech", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "Comm", weight: 50, description: "", maxScore: 100 },
    ];
    const scores = [{ criterionId: "c1", score: 80 }];
    // (80 * 0.5) + 0 = 40
    expect(weightedTotal(scores, items)).toBe(40);
  });
});

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Tech", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Comm", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "r1",
      name: "Alice",
      track: "Backend",
      studentId: "123",
      phone: "010-1",
      email: "a@test.com",
      timeslot: { start: "10:00", end: "10:30", room: "r1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand-2",
      roomId: "r1",
      name: "Bob",
      track: "Frontend",
      studentId: "456",
      phone: "010-2",
      email: "b@test.com",
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
      candidateId: "cand-1",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01",
      scores: [
        { criterionId: "c1", criterionName: "Tech", score: 90, bonusPoints: 0, weight: 60 },
        { criterionId: "c2", criterionName: "Comm", score: 80, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 86,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
    {
      id: "s2",
      candidateId: "cand-2",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: "2026-01-01",
      scores: [
        { criterionId: "c1", criterionName: "Tech", score: 70, bonusPoints: 0, weight: 60 },
        { criterionId: "c2", criterionName: "Comm", score: 60, bonusPoints: 0, weight: 40 },
      ],
      totalWeightedScore: 66,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  it("builds leaderboard and calculates ranks correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("Tech");
    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
  });
});
