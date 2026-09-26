import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "기술", weight: 50, description: "", maxScore: 100 },
    { id: "c2", name: "인성", weight: 50, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand1",
    roomId: "room1",
    name: "Alice",
    track: "frontend",
    studentId: "101",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
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
    track: "backend",
    studentId: "102",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "sub1",
    candidateId: "cand1",
    roomId: "room1",
    interviewerName: "Int1",
    submittedAt: "2026-01-01",
    scores: [
      { criterionId: "c1", criterionName: "기술", score: 80, bonusPoints: 0, weight: 50 },
      { criterionId: "c2", criterionName: "인성", score: 90, bonusPoints: 0, weight: 50 },
    ],
    totalWeightedScore: 85,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub2",
    candidateId: "cand2",
    roomId: "room1",
    interviewerName: "Int1",
    submittedAt: "2026-01-01",
    scores: [
      { criterionId: "c1", criterionName: "기술", score: 95, bonusPoints: 0, weight: 50 },
      { criterionId: "c2", criterionName: "인성", score: 70, bonusPoints: 0, weight: 50 },
    ],
    totalWeightedScore: 82.5,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring.ts", () => {
  test("weightedTotal correctly computes weighted score", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(87.5);
  });

  test("aggregate computes formula values", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
    expect(aggregate([10, 20, 30, 100], "trimmed")).toBe(25);
  });

  test("buildLeaderboard returns ordered items with top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("인성");
    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("기술");
  });

  test("benchmark buildLeaderboard with larger dataset", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "mean",
      passCutoff: 70,
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `crit_${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        description: "",
        maxScore: 100,
      })),
    };

    const candidates: Candidate[] = Array.from({ length: 500 }, (_, i) => ({
      id: `cand_${i}`,
      roomId: "room1",
      name: `Candidate ${i}`,
      track: `Track ${i % 5}`,
      studentId: `2026${i}`,
      phone: "",
      email: "",
      timeslot: { start: "", end: "", room: "" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < 500; i++) {
      for (let p = 0; p < 3; p++) {
        submissions.push({
          id: `sub_${i}_${p}`,
          candidateId: `cand_${i}`,
          roomId: "room1",
          interviewerName: `Interviewer ${p}`,
          submittedAt: "2026-01-01",
          scores: Array.from({ length: 10 }, (_, k) => ({
            criterionId: `crit_${k}`,
            criterionName: `Criterion ${k}`,
            score: 70 + ((i + p + k) % 30),
            bonusPoints: 0,
            weight: 10,
          })),
          totalWeightedScore: 80,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const t0 = performance.now();
    for (let run = 0; run < 10; run++) {
      buildLeaderboard(candidates, submissions, criteria, "mean");
    }
    const t1 = performance.now();
    console.log(`Time taken for 10 runs with 500 candidates x 3 subs: ${(t1 - t0).toFixed(2)} ms`);
    expect(t1 - t0).toBeGreaterThan(0);
  });
});
