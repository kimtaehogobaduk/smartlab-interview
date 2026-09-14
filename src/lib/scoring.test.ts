import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate } from "./scoring";
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
    track: "웹개발",
    studentId: "111",
    phone: "",
    email: "",
    timeslot: { start: "10:00", end: "10:30", room: "A" },
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
    track: "백엔드",
    studentId: "222",
    phone: "",
    email: "",
    timeslot: { start: "10:30", end: "11:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "c3",
    roomId: "r1",
    name: "Charlie",
    track: "웹개발",
    studentId: "333",
    phone: "",
    email: "",
    timeslot: { start: "11:00", end: "11:30", room: "A" },
    status: "PENDING",
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
    interviewerName: "Iv1",
    submittedAt: "2026-01-01",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 86,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Iv1",
    submittedAt: "2026-01-01",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 95, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 80,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring lib", () => {
  test("weightedTotal calculates score correctly", () => {
    const scores = [
      { criterionId: "tech", score: 90 },
      { criterionId: "comm", score: 80 },
    ];
    expect(weightedTotal(scores, mockCriteria.items)).toBe(86);
  });

  test("buildLeaderboard computes ranks and filters out candidates without submissions", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(80);
  });

  test("buildLeaderboard assigns topCriteria correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "weighted");

    // Alice (c1) has higher tech (90 vs 70), Bob (c2) has higher comm (95 vs 80)
    const alice = leaderboard.find((item) => item.candidateId === "c1");
    const bob = leaderboard.find((item) => item.candidateId === "c2");

    expect(alice?.topCriteria).toContain("기술 역량");
    expect(bob?.topCriteria).toContain("의사소통");
  });

  test("buildLeaderboard handles tie-breaking with primary criterion", () => {
    const tiedSubmissions: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "c1",
        roomId: "r1",
        interviewerName: "Iv1",
        submittedAt: "2026-01-01",
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "s2",
        candidateId: "c2",
        roomId: "r1",
        interviewerName: "Iv1",
        submittedAt: "2026-01-01",
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 80,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 85, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, tiedSubmissions, mockCriteria, "weighted");

    // Both have finalScore = 82. Alice (c1) has tech = 90, Bob (c2) has tech = 80.
    // Primary criterion is tech (weight 60 > 40), so Alice should rank #1.
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[1].candidateId).toBe("c2");
  });
});
