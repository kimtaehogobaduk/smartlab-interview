import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  const criteria = [
    { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
    { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
  ];

  it("calculates total weighted score correctly without bonus points", () => {
    const scores = [
      { criterionId: "c1", score: 80 },
      { criterionId: "c2", score: 90 },
    ];
    // 80 * 0.6 + 90 * 0.4 = 48 + 36 = 84
    expect(weightedTotal(scores, criteria)).toBe(84);
  });

  it("caps bonus points at 10% of score", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 15 }, // bonus max = 8 (80 * 0.1) -> total 88
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // bonus = 5 -> total 95
    ];
    // 88 * 0.6 + 95 * 0.4 = 52.8 + 38 = 90.8
    expect(weightedTotal(scores, criteria)).toBe(90.8);
  });
});

describe("aggregate", () => {
  it("calculates mean, median, and trimmed mean", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([80, 90, 100], "median")).toBe(90);
    expect(aggregate([10, 80, 90, 100, 200], "trimmed")).toBe(90);
  });
});

describe("buildLeaderboard", () => {
  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "Alice",
      track: "Frontend",
      studentId: "123",
      phone: "010-1",
      email: "a@test.com",
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
      studentId: "456",
      phone: "010-2",
      email: "b@test.com",
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
    confirmedAt: "",
    confirmedBy: "",
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
      interviewerName: "Interviewer A",
      submittedAt: "2025-01-01T00:00:00Z",
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
      interviewerName: "Interviewer A",
      submittedAt: "2025-01-01T00:00:00Z",
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
          score: 85,
          bonusPoints: 0,
          weight: 40,
        },
      ],
      totalWeightedScore: 76,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  it("builds leaderboard and assigns ranks correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(76);
  });

  it("identifies top criteria correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    const alice = leaderboard.find((item) => item.candidateId === "cand-1");
    const bob = leaderboard.find((item) => item.candidateId === "cand-2");

    expect(alice?.topCriteria).toContain("Problem Solving");
    expect(bob?.topCriteria).toContain("Communication");
  });

  it("exports leaderboard to CSV correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,Problem Solving(60%),Communication(40%)",
    );
    expect(csv).toContain("1,Alice,Frontend,1,86,90,80");
  });
});
