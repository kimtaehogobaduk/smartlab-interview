import { describe, expect, test } from "bun:test";
import { buildLeaderboard, toCsv } from "./scoring";
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

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "Frontend",
    studentId: "1",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
    status: "PENDING",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "c2",
    roomId: "r1",
    name: "Bob",
    track: "Backend",
    studentId: "2",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
    status: "PENDING",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Iv1",
    scores: [
      { criterionId: "tech", score: 80, bonusPoints: 5 },
      { criterionId: "problem", score: 90 },
      { criterionId: "comm", score: 85 },
      { criterionId: "fit", score: 70 },
    ],
    totalWeightedScore: 83.5,
    memo: "",
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Iv2",
    scores: [
      { criterionId: "tech", score: 85 },
      { criterionId: "problem", score: 95 },
      { criterionId: "comm", score: 80 },
      { criterionId: "fit", score: 75 },
    ],
    totalWeightedScore: 86,
    memo: "",
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Iv1",
    scores: [
      { criterionId: "tech", score: 90 },
      { criterionId: "problem", score: 70 },
      { criterionId: "comm", score: 90 },
      { criterionId: "fit", score: 80 },
    ],
    totalWeightedScore: 84,
    memo: "",
    submittedAt: "2026-01-01T00:00:00Z",
  },
];

describe("buildLeaderboard", () => {
  test("calculates leaderboard correctly for mean formula", () => {
    const result = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    expect(result.length).toBe(2);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  test("calculates leaderboard correctly for trimmed formula", () => {
    const result = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    expect(result.length).toBe(2);
  });

  test("exports to CSV correctly", () => {
    const rows = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(rows, mockCriteria);
    expect(csv).toContain("순위,이름,트랙");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
