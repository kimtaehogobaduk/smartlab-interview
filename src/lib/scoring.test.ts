import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "기술", weight: 60, description: "", maxScore: 100 },
    { id: "c2", name: "인성", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Dev",
    studentId: "1001",
    phone: "010-0000-0001",
    email: "alice@example.com",
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
    track: "Dev",
    studentId: "1002",
    phone: "010-0000-0002",
    email: "bob@example.com",
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
    submittedAt: "2026-01-01T00:00:00.000Z",
    scores: [
      { criterionId: "c1", criterionName: "기술", score: 90, bonusPoints: 5, weight: 60 },
      { criterionId: "c2", criterionName: "인성", score: 80, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 89,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00.000Z",
    scores: [
      { criterionId: "c1", criterionName: "기술", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "c2", criterionName: "인성", score: 95, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 80,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("weightedTotal", () => {
  test("calculates weighted total with capped bonus points", () => {
    const scores = [
      { criterionId: "c1", score: 90, bonusPoints: 5 }, // 90 + 5 = 95 -> 95 * 0.6 = 57
      { criterionId: "c2", score: 80, bonusPoints: 10 }, // bonus capped at 80 * 0.1 = 8 -> 88 -> 88 * 0.4 = 35.2
    ];
    // Total = 57 + 35.2 = 92.2
    expect(weightedTotal(scores, mockCriteria.items)).toBe(92.2);
  });
});

describe("aggregate", () => {
  test("calculates mean, median, and trimmed mean", () => {
    const values = [10, 20, 30, 40, 100];
    expect(aggregate(values, "mean")).toBe(40);
    expect(aggregate(values, "median")).toBe(30);
    expect(aggregate(values, "trimmed")).toBe(30); // trimmed removes 10 and 100, mean(20, 30, 40) = 30
  });
});

describe("buildLeaderboard", () => {
  test("builds correct leaderboard items, ranks, and top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    expect(leaderboard).toHaveLength(2);

    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("인성");
  });
});

describe("toCsv", () => {
  test("exports leaderboard rows to CSV string", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술(60%),인성(40%)");
    expect(csv).toContain("1,Alice,Dev,1");
  });
});
