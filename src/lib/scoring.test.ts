import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "기술", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "소통", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "웹개발",
    studentId: "20260001",
    phone: "010-0000-0001",
    email: "alice@test.com",
    timeslot: { start: "14:00", end: "14:30", room: "A" },
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
    track: "웹개발",
    studentId: "20260002",
    phone: "010-0000-0002",
    email: "bob@test.com",
    timeslot: { start: "14:30", end: "15:00", room: "A" },
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
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 5, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 87,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 82,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("weightedTotal", () => {
  test("calculates weighted total with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // cap = 80*0.1 = 8 => total tech = 88
      { criterionId: "comm", score: 90, bonusPoints: 0 }, // total comm = 90
    ];
    // (88 * 60 + 90 * 40) / 100 = (5280 + 3600) / 100 = 88.8
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(88.8);
  });
});

describe("aggregate", () => {
  test("calculates mean, median, trimmed", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([10, 20, 100], "trimmed")).toBe(20);
  });
});

describe("buildLeaderboard", () => {
  test("builds correct leaderboard items and rankings", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[0].topCriteria).toContain("의사소통");
    expect(leaderboard[1].topCriteria).toContain("기술 역량");
  });
});

describe("toCsv", () => {
  test("generates CSV format correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
