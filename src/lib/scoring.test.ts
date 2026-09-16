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
    track: "Frontend",
    studentId: "101",
    phone: "",
    email: "",
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
    track: "Backend",
    studentId: "102",
    phone: "",
    email: "",
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
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, weight: 40 },
    ],
    totalWeightedScore: 86,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 95, weight: 40 },
    ],
    totalWeightedScore: 80,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("buildLeaderboard", () => {
  test("correctly calculates leaderboard scores and ranks candidates", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(80);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });

  test("returns empty list if candidates have no submissions", () => {
    const leaderboard = buildLeaderboard(mockCandidates, [], mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(0);
  });
});
