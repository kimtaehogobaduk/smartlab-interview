import { expect, test } from "bun:test";
import { buildLeaderboard, aggregate, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "mean",
  passCutoff: 70,
  items: [
    { id: "c1", name: "Criteria 1", weight: 60, description: "", maxScore: 100 },
    { id: "c2", name: "Criteria 2", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Dev",
    studentId: "101",
    phone: "",
    email: "",
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
    track: "Design",
    studentId: "102",
    phone: "",
    email: "",
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
    roomId: "room-1",
    candidateId: "cand-1",
    interviewerName: "Interviewer 1",
    scores: [
      { criterionId: "c1", score: 80, bonusPoints: 5 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ],
    totalWeightedScore: 84,
    submittedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "sub-2",
    roomId: "room-1",
    candidateId: "cand-2",
    interviewerName: "Interviewer 1",
    scores: [
      { criterionId: "c1", score: 70, bonusPoints: 0 },
      { criterionId: "c2", score: 75, bonusPoints: 0 },
    ],
    totalWeightedScore: 72,
    submittedAt: "2026-01-01T00:00:00Z",
  },
];

test("buildLeaderboard computes scores correctly and ranks candidates", () => {
  const result = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
  expect(result.length).toBe(2);
  expect(result[0].candidateId).toBe("cand-1");
  expect(result[0].rank).toBe(1);
  expect(result[1].candidateId).toBe("cand-2");
  expect(result[1].rank).toBe(2);
  expect(result[0].topCriteria).toContain("Criteria 1");
  expect(result[0].topCriteria).toContain("Criteria 2");
});
