import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
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
    name: "Candidate One",
    track: "Web",
    studentId: "101",
    phone: "",
    email: "",
    timeslot: { start: "10:00", end: "10:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
  },
  {
    id: "c2",
    name: "Candidate Two",
    track: "Web",
    studentId: "102",
    phone: "",
    email: "",
    timeslot: { start: "10:30", end: "11:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "s1",
    candidateId: "c1",
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 84,
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 82,
  },
];

describe("scoring", () => {
  test("weightedTotal correctly calculates weighted score", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 0 },
      { criterionId: "comm", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    // 80 * 0.6 + 90 * 0.4 = 48 + 36 = 84
    expect(total).toBe(84);
  });

  test("weightedTotal respects bonus points up to 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 15 }, // bonus max 8
      { criterionId: "comm", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    // (80 + 8) * 0.6 + 90 * 0.4 = 52.8 + 36 = 88.8
    expect(total).toBe(88.8);
  });

  test("buildLeaderboard calculates ranks and gold badges correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].finalScore).toBe(84);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("의사소통");

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].finalScore).toBe(82);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("기술 역량");
  });

  test("buildLeaderboard breaks ties using primary criterion weight", () => {
    const tiedSubmissions: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "c1",
        roomId: "room-a",
        interviewerName: "I1",
        submittedAt: new Date().toISOString(),
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 60 },
          { criterionId: "comm", criterionName: "의사소통", score: 70, weight: 40 },
        ],
        totalWeightedScore: 82,
      },
      {
        id: "s2",
        candidateId: "c2",
        roomId: "room-a",
        interviewerName: "I1",
        submittedAt: new Date().toISOString(),
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 60 },
          { criterionId: "comm", criterionName: "의사소통", score: 100, weight: 40 },
        ],
        totalWeightedScore: 82,
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, tiedSubmissions, mockCriteria, "weighted");
    expect(leaderboard[0].candidateId).toBe("c1"); // c1 has higher score (90 vs 70) in primary criterion 'tech' (weight 60)
    expect(leaderboard[1].candidateId).toBe("c2");
  });
});
