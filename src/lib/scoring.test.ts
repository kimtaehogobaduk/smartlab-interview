import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring.ts", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Tech", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Comm", weight: 40, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal calculates score with bonus points capped at 10% of base score", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "c2", score: 90, bonusPoints: 20 }, // 90 + min(20, 9) = 99
    ];
    // 85 * 0.6 + 99 * 0.4 = 51 + 39.6 = 90.6
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(90.6);
  });

  test("aggregate handles mean, median, trimmed formulas", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([80, 90, 100], "median")).toBe(90);
    expect(aggregate([80, 90, 100], "trimmed")).toBe(90);
    expect(aggregate([10, 80, 90, 100, 200], "trimmed")).toBe(90);
  });

  test("buildLeaderboard aggregates scores and computes rankings correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "r1",
        name: "Alice",
        track: "Web",
        studentId: "1",
        phone: "123",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "A" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-2",
        roomId: "r1",
        name: "Bob",
        track: "Web",
        studentId: "2",
        phone: "456",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "A" },
        status: "PENDING",
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
        interviewerName: "Iv1",
        roomId: "r1",
        scores: [
          { criterionId: "c1", score: 90 },
          { criterionId: "c2", score: 80 },
        ],
        totalWeightedScore: 86,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        interviewerName: "Iv1",
        roomId: "r1",
        scores: [
          { criterionId: "c1", score: 70 },
          { criterionId: "c2", score: 60 },
        ],
        totalWeightedScore: 66,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("Tech");
    expect(leaderboard[0].topCriteria).toContain("Comm");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);

    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,Tech(60%),Comm(40%)");
    expect(csv).toContain("1,Alice,Web,1,85,90,80");
  });
});
