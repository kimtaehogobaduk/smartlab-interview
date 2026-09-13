import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring logic", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "c1", name: "기술", weight: 60, maxScore: 100 },
      { id: "c2", name: "인성", weight: 40, maxScore: 100 },
    ],
  };

  test("weightedTotal correctly computes total with bonus points cap", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "c2", score: 90, bonusPoints: 20 }, // 90 + min(20, 9) = 99
    ];
    // total = (85 * 60 + 99 * 40) / 100 = (5100 + 3960) / 100 = 90.6
    expect(weightedTotal(scores, criteria.items)).toBe(90.6);
  });

  test("aggregate handles trimmed, median, and mean formulas", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([80, 90, 100], "median")).toBe(90);
    expect(aggregate([50, 80, 90, 100], "trimmed")).toBe(85); // mean of 80, 90
  });

  test("buildLeaderboard computes ranks, averages and top criteria correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "웹개발",
        studentId: "20260001",
        phone: "010-0000-0001",
        email: "alice@example.com",
        timeslot: { start: "14:00", end: "14:30", room: "A" },
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
        track: "AI",
        studentId: "20260002",
        phone: "010-0000-0002",
        email: "bob@example.com",
        timeslot: { start: "14:30", end: "15:00", room: "A" },
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
        roomId: "room-1",
        candidateId: "cand-1",
        interviewerName: "Iv1",
        totalWeightedScore: 90,
        scores: [
          { criterionId: "c1", score: 90 },
          { criterionId: "c2", score: 90 },
        ],
        submittedAt: new Date().toISOString(),
      },
      {
        id: "sub-2",
        roomId: "room-1",
        candidateId: "cand-2",
        interviewerName: "Iv1",
        totalWeightedScore: 70,
        scores: [
          { criterionId: "c1", score: 60 },
          { criterionId: "c2", score: 85 },
        ],
        submittedAt: new Date().toISOString(),
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0]?.candidateId).toBe("cand-1");
    expect(leaderboard[0]?.rank).toBe(1);
    expect(leaderboard[0]?.finalScore).toBe(90);
    expect(leaderboard[0]?.topCriteria).toContain("기술");

    expect(leaderboard[1]?.candidateId).toBe("cand-2");
    expect(leaderboard[1]?.rank).toBe(2);
    expect(leaderboard[1]?.finalScore).toBe(70);
  });
});
