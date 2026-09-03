import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  it("calculates weighted total score correctly", () => {
    const items = [
      { id: "c1", name: "Problem Solving", weight: 60, maxScore: 100, description: "" },
      { id: "c2", name: "Communication", weight: 40, maxScore: 100, description: "" },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 0 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ];
    // (80 * 60 / 100) + (90 * 40 / 100) = 48 + 36 = 84
    expect(weightedTotal(scores, items)).toBe(84);
  });

  it("handles bonus points capped at 10% of score", () => {
    const items = [
      { id: "c1", name: "Problem Solving", weight: 100, maxScore: 100, description: "" },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 20 }, // 10% capped bonus is 8
    ];
    // (80 + 8) * 100 / 100 = 88
    expect(weightedTotal(scores, items)).toBe(88);
  });
});

describe("aggregate", () => {
  const values = [70, 80, 90, 100];

  it("calculates mean", () => {
    expect(aggregate(values, "mean")).toBe(85);
  });

  it("calculates median", () => {
    expect(aggregate(values, "median")).toBe(85);
  });

  it("calculates trimmed mean", () => {
    // trims 70 and 100 -> mean(80, 90) = 85
    expect(aggregate(values, "trimmed")).toBe(85);
  });
});

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    formula: "mean",
    isConfirmed: true,
    items: [
      { id: "crit-1", name: "Tech", weight: 60, maxScore: 100, description: "" },
      { id: "crit-2", name: "Soft Skills", weight: 40, maxScore: 100, description: "" },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "Alice",
      track: "Frontend",
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
      interviewerId: "int-1",
      interviewerName: "Interviewer 1",
      scores: [
        { criterionId: "crit-1", score: 90 },
        { criterionId: "crit-2", score: 80 },
      ],
      totalWeightedScore: 86,
      submittedAt: new Date().toISOString(),
    },
    {
      id: "sub-2",
      candidateId: "cand-2",
      interviewerId: "int-1",
      interviewerName: "Interviewer 1",
      scores: [
        { criterionId: "crit-1", score: 70 },
        { criterionId: "crit-2", score: 95 },
      ],
      totalWeightedScore: 80,
      submittedAt: new Date().toISOString(),
    },
  ];

  it("builds and ranks leaderboard correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);

    expect(leaderboard[0]!.candidateId).toBe("cand-1");
    expect(leaderboard[0]!.rank).toBe(1);
    expect(leaderboard[0]!.topCriteria).toContain("Tech");

    expect(leaderboard[1]!.candidateId).toBe("cand-2");
    expect(leaderboard[1]!.rank).toBe(2);
    expect(leaderboard[1]!.topCriteria).toContain("Soft Skills");
  });

  it("handles empty submissions safely", () => {
    const leaderboard = buildLeaderboard(candidates, [], criteria, "mean");
    expect(leaderboard.length).toBe(0);
  });
});
