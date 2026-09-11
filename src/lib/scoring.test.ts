import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "Web",
    studentId: "101",
    phone: "010-1",
    email: "a@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "r1" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "c2",
    roomId: "r1",
    name: "Bob",
    track: "AI",
    studentId: "102",
    phone: "010-2",
    email: "b@test.com",
    timeslot: { start: "10:30", end: "11:00", room: "r1" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "s1",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Judge1",
    scores: [
      { criterionId: "tech", score: 90 },
      { criterionId: "comm", score: 80 },
    ],
    totalWeightedScore: 86,
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Judge1",
    scores: [
      { criterionId: "tech", score: 70 },
      { criterionId: "comm", score: 95 },
    ],
    totalWeightedScore: 80,
    submittedAt: "2026-01-01T00:00:00Z",
  },
];

describe("buildLeaderboard", () => {
  test("calculates ranks and scores correctly", () => {
    const result = buildLeaderboard(
      mockCandidates,
      mockSubmissions,
      mockCriteria,
      mockCriteria.formula,
    );

    expect(result.length).toBe(2);
    expect(result[0].candidateId).toBe("c1");
    expect(result[0].rank).toBe(1);
    expect(result[0].topCriteria).toContain("기술 역량");
    expect(result[1].candidateId).toBe("c2");
    expect(result[1].rank).toBe(2);
    expect(result[1].topCriteria).toContain("의사소통");
  });
});
