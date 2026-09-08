import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
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
    track: "Backend",
    studentId: "101",
    phone: "010-0000-0001",
    email: "alice@test.com",
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
    track: "Frontend",
    studentId: "102",
    phone: "010-0000-0002",
    email: "bob@test.com",
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
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, weight: 60, bonusPoints: 5 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, weight: 40, bonusPoints: 0 },
    ],
    totalWeightedScore: 85,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s2",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Interviewer 2",
    submittedAt: "2026-01-01T00:05:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 60, bonusPoints: 0 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, weight: 40, bonusPoints: 0 },
    ],
    totalWeightedScore: 82,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s3",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:10:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 60, bonusPoints: 0 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, weight: 40, bonusPoints: 0 },
    ],
    totalWeightedScore: 74,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring functions", () => {
  test("weightedTotal correctly caps bonus points to 10% of score", () => {
    // Score 80, bonus 15 -> bonus capped at 8 (10% of 80). Score becomes 88.
    // 88 * 0.6 = 52.8
    // Score 90, bonus 0 -> 90 * 0.4 = 36.
    // Total = 88.8
    const total = weightedTotal(
      [
        { criterionId: "tech", score: 80, bonusPoints: 15 },
        { criterionId: "comm", score: 90, bonusPoints: 0 },
      ],
      mockCriteria.items,
    );
    expect(total).toBe(88.8);
  });

  test("aggregate calculates mean, median, and trimmed values", () => {
    const values = [10, 20, 90];
    expect(aggregate(values, "mean")).toBe(40);
    expect(aggregate(values, "median")).toBe(20);
    expect(aggregate(values, "trimmed")).toBe(20);
  });

  test("buildLeaderboard calculates scores, ranking, and top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");

    expect(leaderboard.length).toBe(2);
    // Alice should be rank 1
    const alice = leaderboard.find((item) => item.candidateId === "c1");
    expect(alice).toBeDefined();
    expect(alice?.rank).toBe(1);
    expect(alice?.panelCount).toBe(2);

    // Bob should be rank 2
    const bob = leaderboard.find((item) => item.candidateId === "c2");
    expect(bob).toBeDefined();
    expect(bob?.rank).toBe(2);

    // Alice should win "기술 역량" and "의사소통" as top criteria
    expect(alice?.topCriteria).toContain("기술 역량");
    expect(alice?.topCriteria).toContain("의사소통");
  });

  test("toCsv converts leaderboard items to CSV format", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
