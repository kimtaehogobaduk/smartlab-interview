import { describe, expect, it } from "bun:test";
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
    track: "Frontend",
    studentId: "1",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
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
    studentId: "2",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
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
    interviewerName: "Iv1",
    submittedAt: "",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 5, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 84, // (80+5)*0.6 + 90*0.4 = 51 + 36 = 87
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "s2",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Iv1",
    submittedAt: "",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 82,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("scoring lib", () => {
  it("weightedTotal calculates score with capped bonus points", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // bonus capped at min(10, 80 * 0.1) = 8 -> 88 * 0.6 = 52.8
      { criterionId: "comm", score: 50, bonusPoints: -5 }, // bonus capped at max(-5, 0) = 0 -> 50 * 0.4 = 20
    ];
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(72.8);
  });

  it("aggregate computes mean, median, trimmed averages", () => {
    expect(aggregate([10, 20, 30, 40, 50], "mean")).toBe(30);
    expect(aggregate([10, 20, 30, 40, 50], "median")).toBe(30);
    expect(aggregate([10, 20, 30, 40, 100], "trimmed")).toBe(30); // mean of [20, 30, 40]
  });

  it("buildLeaderboard computes scores, ranks and top criteria correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(2);

    // Alice has tech: 85 (80 + 5), comm: 90. totalWeightedScore in s1 is 84.
    // Bob has tech: 90, comm: 70. totalWeightedScore in s2 is 82.
    const alice = leaderboard.find((item) => item.candidateId === "c1");
    const bob = leaderboard.find((item) => item.candidateId === "c2");

    expect(alice).toBeDefined();
    expect(bob).toBeDefined();

    expect(alice?.rank).toBe(1);
    expect(bob?.rank).toBe(2);

    expect(alice?.topCriteria).toContain("의사소통");
    expect(bob?.topCriteria).toContain("기술 역량");
  });

  it("toCsv exports leaderboard to CSV format", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
