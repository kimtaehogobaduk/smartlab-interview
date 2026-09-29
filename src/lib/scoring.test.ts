import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    {
      id: "tech",
      name: "기술 역량",
      weight: 60,
      description: "기술",
      maxScore: 100,
    },
    {
      id: "comm",
      name: "의사소통",
      weight: 40,
      description: "소통",
      maxScore: 100,
    },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Backend",
    studentId: "1001",
    phone: "010-0000-0001",
    email: "alice@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
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
    track: "Frontend",
    studentId: "1002",
    phone: "010-0000-0002",
    email: "bob@test.com",
    timeslot: { start: "10:30", end: "11:00", room: "Room 1" },
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
    interviewerName: "Interviewer A",
    submittedAt: "2026-01-01T10:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 5, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 87,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer A",
    submittedAt: "2026-01-01T10:30:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 95, bonusPoints: 2, weight: 40 },
    ],
    totalWeightedScore: 80,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("weightedTotal", () => {
  test("calculates weighted score with bonus point capping", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // 10 bonus max is 80 * 0.1 = 8 -> effective score = 88
      { criterionId: "comm", score: 90, bonusPoints: 0 },
    ];
    // (88 * 60 / 100) + (90 * 40 / 100) = 52.8 + 36 = 88.8
    expect(weightedTotal(scores, mockCriteria.items)).toBe(88.8);
  });
});

describe("aggregate", () => {
  test("computes mean, median, and trimmed mean", () => {
    const vals = [10, 20, 30, 40, 100];
    expect(aggregate(vals, "mean")).toBe(40);
    expect(aggregate(vals, "median")).toBe(30);
    expect(aggregate(vals, "trimmed")).toBe(30); // mean of [20, 30, 40] = 30
  });
});

describe("buildLeaderboard", () => {
  test("builds correct leaderboard ranks and perCriterion averages", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    expect(leaderboard.length).toBe(2);

    const first = leaderboard[0];
    expect(first.candidateId).toBe("cand-1");
    expect(first.rank).toBe(1);
    expect(first.topCriteria).toContain("기술 역량");

    const second = leaderboard[1];
    expect(second.candidateId).toBe("cand-2");
    expect(second.rank).toBe(2);
    expect(second.topCriteria).toContain("의사소통");
  });

  test("returns empty list if candidates have no submissions", () => {
    const leaderboard = buildLeaderboard(mockCandidates, [], mockCriteria, "mean");
    expect(leaderboard.length).toBe(0);
  });
});
