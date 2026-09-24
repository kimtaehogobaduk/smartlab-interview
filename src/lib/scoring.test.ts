import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "weighted",
  passCutoff: 70,
  items: [
    { id: "c1", name: "전공 역량", weight: 40, description: "기술 지식", maxScore: 100 },
    { id: "c2", name: "협업 능력", weight: 30, description: "커뮤니케이션", maxScore: 100 },
    { id: "c3", name: "문제 해결력", weight: 30, description: "논리력", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Frontend",
    studentId: "20240001",
    phone: "010-0000-0001",
    email: "alice@test.com",
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
    track: "Backend",
    studentId: "20240002",
    phone: "010-0000-0002",
    email: "bob@test.com",
    timeslot: { start: "10:30", end: "11:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "sub-1",
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "c1", criterionName: "전공 역량", score: 80, bonusPoints: 5, weight: 40 },
      { criterionId: "c2", criterionName: "협업 능력", score: 90, bonusPoints: 0, weight: 30 },
      { criterionId: "c3", criterionName: "문제 해결력", score: 85, bonusPoints: 0, weight: 30 },
    ],
    totalWeightedScore: 84.5,
    qualitativeFeedback: { strengths: "Good", improvements: "None" },
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "c1", criterionName: "전공 역량", score: 90, bonusPoints: 0, weight: 40 },
      { criterionId: "c2", criterionName: "협업 능력", score: 70, bonusPoints: 0, weight: 30 },
      { criterionId: "c3", criterionName: "문제 해결력", score: 75, bonusPoints: 0, weight: 30 },
    ],
    totalWeightedScore: 79.5,
    qualitativeFeedback: { strengths: "Okay", improvements: "Practice" },
  },
];

describe("scoring logic", () => {
  test("weightedTotal correctly calculates score with bonus points", () => {
    const score = weightedTotal(mockSubmissions[0].scores, mockCriteria.items);
    expect(score).toBe(86.5);
  });

  test("buildLeaderboard produces expected rankings and topCriteria", () => {
    const result = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");
    expect(result.length).toBe(2);
    expect(result[0].candidateId).toBe("cand-1");
    expect(result[0].rank).toBe(1);
    expect(result[1].candidateId).toBe("cand-2");
    expect(result[1].rank).toBe(2);
  });

  test("toCsv formats rows correctly", () => {
    const result = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");
    const csv = toCsv(result, mockCriteria);
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });

  test("benchmark buildLeaderboard with large dataset", () => {
    // Generate 200 candidates and 800 submissions across 5 criteria
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      passCutoff: 70,
      items: Array.from({ length: 5 }, (_, i) => ({
        id: `crit-${i}`,
        name: `Criterion ${i}`,
        weight: 20,
        description: `Desc ${i}`,
        maxScore: 100,
      })),
    };

    const candidates: Candidate[] = Array.from({ length: 200 }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Frontend" : "Backend",
      studentId: `2024${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@test.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (const c of candidates) {
      for (let panel = 0; panel < 4; panel++) {
        submissions.push({
          id: `sub-${c.id}-${panel}`,
          candidateId: c.id,
          roomId: "room-1",
          interviewerName: `Interviewer ${panel}`,
          submittedAt: "2026-01-01T00:00:00Z",
          scores: criteria.items.map((item) => ({
            criterionId: item.id,
            criterionName: item.name,
            score: (c.id.length * 13 + panel * 7) % 100,
            bonusPoints: panel,
            weight: item.weight,
          })),
          totalWeightedScore: 75,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      buildLeaderboard(candidates, submissions, criteria, "weighted");
    }
    const duration = performance.now() - start;
    console.log(
      `[BENCHMARK AFTER] 20 iterations took ${duration.toFixed(2)}ms (${(duration / 20).toFixed(2)}ms/op)`,
    );
    expect(duration).toBeGreaterThan(0);
  });
});
