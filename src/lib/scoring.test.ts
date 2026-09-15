import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring algorithms", () => {
  test("weightedTotal correctly weights scores and caps bonus points at 10% of score", () => {
    const items = [
      { id: "c1", name: "Technical", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ];

    // Score: 80 (+15 bonus -> capped at 8), score 90 (+5 bonus -> 5)
    // Effective c1: 88, c2: 95
    // Total: (88 * 60 + 95 * 40) / 100 = (5280 + 3800) / 100 = 90.8
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 15 },
      { criterionId: "c2", score: 90, bonusPoints: 5 },
    ];

    expect(weightedTotal(scores, items)).toBe(90.8);
  });

  test("aggregate calculates mean, median, and trimmed correctly", () => {
    const values = [70, 80, 90, 100, 60];

    // Mean: (70+80+90+100+60)/5 = 80
    expect(aggregate(values, "mean")).toBe(80);

    // Median: sorted [60, 70, 80, 90, 100] -> 80
    expect(aggregate(values, "median")).toBe(80);

    // Trimmed: sorted [60, 70, 80, 90, 100] -> trimmed slice [70, 80, 90] -> mean 80
    expect(aggregate(values, "trimmed")).toBe(80);
  });

  test("buildLeaderboard computes scores, rankings, tie-breakers, and top criteria accurately", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Frontend",
        studentId: "101",
        phone: "01011112222",
        email: "alice@example.com",
        timeslot: { start: "14:00", end: "14:30", room: "Room A" },
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
        phone: "01033334444",
        email: "bob@example.com",
        timeslot: { start: "14:30", end: "15:00", room: "Room A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-3",
        roomId: "room-1",
        name: "Charlie (No Submissions)",
        track: "Frontend",
        studentId: "103",
        phone: "01055556666",
        email: "charlie@example.com",
        timeslot: { start: "15:00", end: "15:30", room: "Room A" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      items: [
        { id: "c-tech", name: "Tech Skill", weight: 60, description: "", maxScore: 100 },
        { id: "c-comm", name: "Communication", weight: 40, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-03-01T00:00:00Z",
        scores: [
          { criterionId: "c-tech", criterionName: "Tech Skill", score: 90, weight: 60 },
          { criterionId: "c-comm", criterionName: "Communication", score: 70, weight: 40 },
        ],
        totalWeightedScore: 82, // 90*0.6 + 70*0.4
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-03-01T00:00:00Z",
        scores: [
          { criterionId: "c-tech", criterionName: "Tech Skill", score: 70, weight: 60 },
          { criterionId: "c-comm", criterionName: "Communication", score: 100, weight: 40 },
        ],
        totalWeightedScore: 82, // 70*0.6 + 100*0.4
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    // Only Alice and Bob should be included
    expect(leaderboard.length).toBe(2);

    // Both have finalScore = 82
    expect(leaderboard[0].finalScore).toBe(82);
    expect(leaderboard[1].finalScore).toBe(82);

    // Primary criterion is c-tech (weight 60 vs 40)
    // Alice's c-tech score = 90, Bob's c-tech score = 70
    // Alice wins tie-breaker and gets rank 1
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);

    // Top criteria:
    // Alice is highest in Tech Skill (90 vs 70)
    // Bob is highest in Communication (100 vs 70)
    expect(leaderboard[0].topCriteria).toContain("Tech Skill");
    expect(leaderboard[1].topCriteria).toContain("Communication");
  });
});
