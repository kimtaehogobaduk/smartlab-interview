import { describe, expect, it } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "기술 역량", weight: 60, description: "Tech", maxScore: 100 },
    { id: "c2", name: "의사소통", weight: 40, description: "Comm", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    name: "Alice",
    track: "Backend",
    studentId: "20260001",
    phone: "010-0000-0001",
    email: "alice@example.com",
    timeslot: { start: "14:00", end: "14:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
  },
  {
    id: "cand-2",
    name: "Bob",
    track: "Frontend",
    studentId: "20260002",
    phone: "010-0000-0002",
    email: "bob@example.com",
    timeslot: { start: "14:30", end: "15:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "sub-1",
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-03-30T10:00:00Z",
    scores: [
      { criterionId: "c1", score: 90, criterionName: "기술 역량", weight: 60 },
      { criterionId: "c2", score: 80, criterionName: "의사소통", weight: 40 },
    ],
    totalWeightedScore: 86,
    qualitativeFeedback: { strengths: "", improvements: "", finalVerdict: "PASS" },
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-03-30T10:00:00Z",
    scores: [
      { criterionId: "c1", score: 70, criterionName: "기술 역량", weight: 60 },
      { criterionId: "c2", score: 95, criterionName: "의사소통", weight: 40 },
    ],
    totalWeightedScore: 80,
    qualitativeFeedback: { strengths: "", improvements: "", finalVerdict: "PASS" },
  },
];

describe("scoring", () => {
  it("computes weightedTotal correctly", () => {
    const total = weightedTotal(
      [
        { criterionId: "c1", score: 90 },
        { criterionId: "c2", score: 80 },
      ],
      mockCriteria.items,
    );
    expect(total).toBe(86);
  });

  it("builds leaderboard correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].finalScore).toBe(80);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });

  it("handles tie-breaking with primary criterion", () => {
    const tiedSubmissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "c1", score: 80, criterionName: "기술 역량", weight: 60 },
          { criterionId: "c2", score: 80, criterionName: "의사소통", weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "", finalVerdict: "PASS" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "c1", score: 90, criterionName: "기술 역량", weight: 60 },
          { criterionId: "c2", score: 65, criterionName: "의사소통", weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "", finalVerdict: "PASS" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, tiedSubmissions, mockCriteria, "weighted");

    expect(leaderboard[0].candidateId).toBe("cand-2"); // Higher score on primary criterion c1 (weight 60)
    expect(leaderboard[1].candidateId).toBe("cand-1");
  });
});
