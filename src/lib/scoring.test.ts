import { describe, expect, it } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "mean",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-a",
    name: "Alice",
    track: "Frontend",
    studentId: "101",
    phone: "010-0000-0001",
    email: "alice@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "cand-2",
    roomId: "room-a",
    name: "Bob",
    track: "Backend",
    studentId: "102",
    phone: "010-0000-0002",
    email: "bob@test.com",
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
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 84,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 95, bonusPoints: 5, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 85,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring logic", () => {
  it("calculates weighted total correctly", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 0 },
      { criterionId: "comm", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    // (80 * 60 / 100) + (90 * 40 / 100) = 48 + 36 = 84
    expect(total).toBe(84);
  });

  it("calculates weighted total with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 20 }, // 20 bonus points capped at 80 * 0.1 = 8 => score = 88
      { criterionId: "comm", score: 90, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    // (88 * 60 / 100) + (90 * 40 / 100) = 52.8 + 36 = 88.8
    expect(total).toBe(88.8);
  });

  it("builds leaderboard correctly", () => {
    const leaderboard = buildLeaderboard(
      mockCandidates,
      mockSubmissions,
      mockCriteria,
      mockCriteria.formula,
    );

    expect(leaderboard.length).toBe(2);
    // Bob should be ranked 1st due to higher mean score (90 vs 85)
    expect(leaderboard[0].candidateId).toBe("cand-2");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("cand-1");
    expect(leaderboard[1].rank).toBe(2);
  });

  it("exports CSV correctly", () => {
    const leaderboard = buildLeaderboard(
      mockCandidates,
      mockSubmissions,
      mockCriteria,
      mockCriteria.formula,
    );
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("Bob");
    expect(csv).toContain("Alice");
  });
});
