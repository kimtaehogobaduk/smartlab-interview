import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  test("weightedTotal correctly calculates weighted score with bonus point cap", () => {
    const items = [
      { id: "c1", name: "Crit 1", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Crit 2", weight: 40, description: "", maxScore: 100 },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 20 }, // bonus capped at 8 (80 * 0.1) -> 88
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // bonus capped at 5 -> 95
    ];
    // total = (88 * 60 / 100) + (95 * 40 / 100) = 52.8 + 38 = 90.8
    expect(weightedTotal(scores, items)).toBe(90.8);
  });

  test("aggregate handles mean, median, and trimmed formulas", () => {
    const values = [70, 80, 90, 100, 100];
    expect(aggregate(values, "mean")).toBe(88);
    expect(aggregate(values, "median")).toBe(90);
    expect(aggregate(values, "trimmed")).toBe(90); // trimmed removes 70 and 100, mean of [80, 90, 100] = 90
  });

  test("buildLeaderboard ranks candidates and assigns top criteria accurately", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Frontend",
        studentId: "101",
        phone: "010-1",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "Room A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand2",
        roomId: "room1",
        name: "Bob",
        track: "Backend",
        studentId: "102",
        phone: "010-2",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "Room A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      formula: "weighted",
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "Admin",
      items: [
        { id: "c1", name: "Coding", weight: 60, description: "", maxScore: 100 },
        { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub1",
        candidateId: "cand1",
        interviewerId: "i1",
        interviewerName: "Interviewer 1",
        scores: [
          { criterionId: "c1", score: 90, bonusPoints: 0 },
          { criterionId: "c2", score: 70, bonusPoints: 0 },
        ],
        comments: {},
        overallNote: "",
        submittedAt: new Date().toISOString(),
        totalWeightedScore: 82,
      },
      {
        id: "sub2",
        candidateId: "cand2",
        interviewerId: "i1",
        interviewerName: "Interviewer 1",
        scores: [
          { criterionId: "c1", score: 70, bonusPoints: 0 },
          { criterionId: "c2", score: 95, bonusPoints: 0 },
        ],
        comments: {},
        overallNote: "",
        submittedAt: new Date().toISOString(),
        totalWeightedScore: 80,
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0]!.name).toBe("Alice");
    expect(leaderboard[0]!.rank).toBe(1);
    expect(leaderboard[0]!.topCriteria).toContain("Coding");

    expect(leaderboard[1]!.name).toBe("Bob");
    expect(leaderboard[1]!.rank).toBe(2);
    expect(leaderboard[1]!.topCriteria).toContain("Communication");
  });
});
