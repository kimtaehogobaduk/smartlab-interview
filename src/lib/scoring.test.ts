import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Backend",
    studentId: "101",
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
    studentId: "102",
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
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", score: 90 },
      { criterionId: "comm", score: 80 },
    ],
    totalWeightedScore: 86,
    comment: "Great",
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", score: 70 },
      { criterionId: "comm", score: 90 },
    ],
    totalWeightedScore: 78,
    comment: "Good",
  },
];

describe("buildLeaderboard", () => {
  test("ranks candidates correctly based on final scores", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
  });

  test("assigns topCriteria to winners", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");

    const alice = leaderboard.find((item) => item.candidateId === "cand-1");
    const bob = leaderboard.find((item) => item.candidateId === "cand-2");

    expect(alice?.topCriteria).toContain("기술 역량");
    expect(bob?.topCriteria).toContain("의사소통");
  });
});
