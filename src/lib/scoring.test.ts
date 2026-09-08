import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
    { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 20, description: "", maxScore: 100 },
    { id: "fit", name: "태도/조직적합도", weight: 10, description: "", maxScore: 100 },
  ],
};

describe("scoring logic", () => {
  test("weightedTotal calculates score with bonus points correctly", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "problem", score: 90, bonusPoints: 0 }, // 90
      { criterionId: "comm", score: 70, bonusPoints: 10 }, // bonus capped at 70 * 0.1 = 7, so 77
      { criterionId: "fit", score: 60, bonusPoints: 2 }, // 62
    ];
    // 85*0.4 + 90*0.3 + 77*0.2 + 62*0.1 = 34 + 27 + 15.4 + 6.2 = 82.6
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(82.6);
  });

  test("aggregate calculates mean, median, trimmed averages", () => {
    const values = [10, 20, 30, 40, 100];
    expect(aggregate(values, "mean")).toBe(40);
    expect(aggregate(values, "median")).toBe(30);
    // trimmed removes min(10) and max(100), avg(20, 30, 40) = 30
    expect(aggregate(values, "trimmed")).toBe(30);
  });

  test("buildLeaderboard ranks candidates correctly and calculates top criteria", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Web",
        studentId: "1",
        phone: "",
        email: "",
        timeslot: { start: "10:00", end: "10:30", room: "A" },
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
        studentId: "2",
        phone: "",
        email: "",
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
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Judge1",
        submittedAt: "2026-01-01T00:00:00Z",
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 40 },
          { criterionId: "problem", criterionName: "문제 해결력", score: 80, weight: 30 },
          { criterionId: "comm", criterionName: "의사소통", score: 70, weight: 20 },
          { criterionId: "fit", criterionName: "태도/조직적합도", score: 60, weight: 10 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Judge1",
        submittedAt: "2026-01-01T00:00:00Z",
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 40 },
          { criterionId: "problem", criterionName: "문제 해결력", score: 95, weight: 30 },
          { criterionId: "comm", criterionName: "의사소통", score: 85, weight: 20 },
          { criterionId: "fit", criterionName: "태도/조직적합도", score: 90, weight: 10 },
        ],
        totalWeightedScore: 82.5,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "mean");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0]?.candidateId).toBe("cand-2");
    expect(leaderboard[0]?.rank).toBe(1);
    expect(leaderboard[1]?.candidateId).toBe("cand-1");
    expect(leaderboard[1]?.rank).toBe(2);
    expect(leaderboard[0]?.topCriteria).toContain("문제 해결력");
    expect(leaderboard[1]?.topCriteria).toContain("기술 역량");
  });

  test("buildLeaderboard performance benchmark on large dataset", () => {
    const candidateCount = 100;
    const submissionCount = 500;

    const candidates: Candidate[] = Array.from({ length: candidateCount }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Web" : "AI",
      studentId: `${i}`,
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = Array.from({ length: submissionCount }, (_, i) => {
      const candId = `cand-${i % candidateCount}`;
      return {
        id: `sub-${i}`,
        candidateId: candId,
        roomId: "room-1",
        interviewerName: `Judge-${i % 5}`,
        submittedAt: "2026-01-01T00:00:00Z",
        scores: mockCriteria.items.map((item) => ({
          criterionId: item.id,
          criterionName: item.name,
          score: (i * 13 + 50) % 100,
          bonusPoints: i % 3,
          weight: item.weight,
        })),
        totalWeightedScore: (i * 7 + 40) % 100,
        qualitativeFeedback: { strengths: "", improvements: "" },
      };
    });

    const start = performance.now();
    for (let iter = 0; iter < 100; iter++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const elapsed = performance.now() - start;
    console.log(`100 leaderboard recalculations took: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
