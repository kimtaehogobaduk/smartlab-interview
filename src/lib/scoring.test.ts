import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  test("weightedTotal correctly weights criteria and adds bonus points up to 10%", () => {
    const items = [
      { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "c2", score: 90, bonusPoints: 20 }, // 90 + min(20, 9) = 99
    ];
    // Weighted score: (85 * 60 / 100) + (99 * 40 / 100) = 51 + 39.6 = 90.6
    expect(weightedTotal(scores, items)).toBe(90.6);
  });

  test("aggregate calculates mean, median, and trimmed mean", () => {
    const values = [70, 80, 90, 100];
    expect(aggregate(values, "mean")).toBe(85);
    expect(aggregate(values, "median")).toBe(85);
    expect(aggregate(values, "trimmed")).toBe(85); // mean of 80, 90 = 85
  });

  test("buildLeaderboard aggregates submissions, calculates rank and top criteria efficiently", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Frontend",
        timeslot: { start: "10:00", end: "10:30" },
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
        timeslot: { start: "10:30", end: "11:00" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      formula: "mean",
      isConfirmed: true,
      items: [
        { id: "c1", name: "Coding", weight: 70, description: "", maxScore: 100 },
        { id: "c2", name: "System Design", weight: 30, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub1",
        candidateId: "cand1",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: "2025-01-01T00:00:00Z",
        scores: [
          { criterionId: "c1", criterionName: "Coding", score: 90, bonusPoints: 0, weight: 70 },
          {
            criterionId: "c2",
            criterionName: "System Design",
            score: 80,
            bonusPoints: 0,
            weight: 30,
          },
        ],
        totalWeightedScore: 87,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub2",
        candidateId: "cand2",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: "2025-01-01T00:00:00Z",
        scores: [
          { criterionId: "c1", criterionName: "Coding", score: 70, bonusPoints: 0, weight: 70 },
          {
            criterionId: "c2",
            criterionName: "System Design",
            score: 95,
            bonusPoints: 0,
            weight: 30,
          },
        ],
        totalWeightedScore: 77.5,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("Coding");
    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("System Design");
  });

  test("toCsv exports leaderboard correctly", () => {
    const criteria: CriteriaConfig = {
      formula: "mean",
      isConfirmed: true,
      items: [{ id: "c1", name: "Coding", weight: 100, description: "", maxScore: 100 }],
    };
    const rows = [
      {
        candidateId: "cand1",
        name: "Alice",
        track: "Frontend",
        panelCount: 1,
        finalScore: 90,
        perCriterion: [{ criterionId: "c1", name: "Coding", average: 90 }],
        rank: 1,
        topCriteria: ["Coding"],
      },
    ];
    const csv = toCsv(rows, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,Coding(100%)");
    expect(csv).toContain("1,Alice,Frontend,1,90,90");
  });
});
