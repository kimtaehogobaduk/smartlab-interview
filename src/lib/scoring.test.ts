import { describe, expect, it } from "bun:test";
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
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Web",
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
    track: "AI",
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
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 86,
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 95, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 80,
  },
];

describe("buildLeaderboard", () => {
  it("calculates leaderboard correctly and ranks candidates", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });
});
