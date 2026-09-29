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
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "웹개발",
    studentId: "20260001",
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
    track: "AI",
    studentId: "20260002",
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
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, weight: 40 },
    ],
    totalWeightedScore: 84,
  },
  {
    id: "sub-2",
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "Interviewer 2",
    submittedAt: "2026-01-01T00:01:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 100, weight: 40 },
    ],
    totalWeightedScore: 94,
  },
  {
    id: "sub-3",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:02:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, weight: 40 },
    ],
    totalWeightedScore: 74,
  },
];

describe("weightedTotal", () => {
  test("calculates weighted total correctly", () => {
    const result = weightedTotal(
      [
        { criterionId: "tech", score: 80, bonusPoints: 0 },
        { criterionId: "comm", score: 90, bonusPoints: 0 },
      ],
      mockCriteria.items,
    );
    // (80 * 0.6) + (90 * 0.4) = 48 + 36 = 84
    expect(result).toBe(84);
  });

  test("handles capped bonus points", () => {
    const result = weightedTotal(
      [
        { criterionId: "tech", score: 80, bonusPoints: 50 }, // max bonus = 80 * 0.1 = 8 => total tech score = 88
        { criterionId: "comm", score: 90, bonusPoints: 0 },
      ],
      mockCriteria.items,
    );
    // (88 * 0.6) + (90 * 0.4) = 52.8 + 36 = 88.8
    expect(result).toBe(88.8);
  });
});

describe("aggregate", () => {
  test("computes mean formula", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
  });

  test("computes median formula", () => {
    expect(aggregate([10, 50, 100], "median")).toBe(50);
  });

  test("computes trimmed mean formula", () => {
    expect(aggregate([10, 80, 90, 100], "trimmed")).toBe(85);
  });
});

describe("buildLeaderboard", () => {
  test("builds correct leaderboard rankings and top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    // Alice has higher totalWeightedScore (avg 89) than Bob (74)
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].panelCount).toBe(2);

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].panelCount).toBe(1);

    // Alice should win top criteria for both tech and comm
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
    expect(leaderboard[0].topCriteria).toContain("의사소통");
  });

  test("returns empty array if no candidates have submissions", () => {
    const leaderboard = buildLeaderboard(mockCandidates, [], mockCriteria, "weighted");
    expect(leaderboard).toEqual([]);
  });
});

describe("toCsv", () => {
  test("formats leaderboard into CSV string correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,웹개발,2");
  });
});
