import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "mean",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 50, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 30, description: "", maxScore: 100 },
    { id: "fit", name: "태도", weight: 20, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "김철수",
    track: "웹개발",
    studentId: "20260001",
    phone: "010-0000-0001",
    email: "chulsoo@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "cand-2",
    roomId: "room-1",
    name: "이영희",
    track: "웹개발",
    studentId: "20260002",
    phone: "010-0000-0002",
    email: "younghee@test.com",
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
    roomId: "room-1",
    interviewerName: "면접관A",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 5, weight: 50 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 30 },
      { criterionId: "fit", criterionName: "태도", score: 70, bonusPoints: 0, weight: 20 },
    ],
    totalWeightedScore: 81,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-2",
    candidateId: "cand-1",
    roomId: "room-1",
    interviewerName: "면접관B",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 50 },
      { criterionId: "comm", criterionName: "의사소통", score: 85, bonusPoints: 0, weight: 30 },
      { criterionId: "fit", criterionName: "태도", score: 75, bonusPoints: 0, weight: 20 },
    ],
    totalWeightedScore: 85.5,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
  {
    id: "sub-3",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "면접관A",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 95, bonusPoints: 0, weight: 50 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 30 },
      { criterionId: "fit", criterionName: "태도", score: 80, bonusPoints: 0, weight: 20 },
    ],
    totalWeightedScore: 84.5,
    qualitativeFeedback: { strengths: "", improvements: "" },
  },
];

describe("weightedTotal", () => {
  it("calculates correct weighted total with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 12 }, // cap at 80 * 0.1 = 8 -> effective score 88
      { criterionId: "comm", score: 90, bonusPoints: 0 },
      { criterionId: "fit", score: 70, bonusPoints: -5 }, // negative bonus ignored -> 0 -> 70
    ];
    // 88 * 0.5 + 90 * 0.3 + 70 * 0.2 = 44 + 27 + 14 = 85
    expect(weightedTotal(scores, mockCriteria.items)).toBe(85);
  });
});

describe("aggregate", () => {
  it("calculates mean correctly", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
  });

  it("calculates median correctly", () => {
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
  });

  it("calculates trimmed mean correctly", () => {
    expect(aggregate([10, 20, 100], "trimmed")).toBe(20);
    expect(aggregate([10, 20], "trimmed")).toBe(15);
  });
});

describe("buildLeaderboard", () => {
  it("builds leaderboard items and calculates ranks and top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");

    expect(leaderboard.length).toBe(2);

    // Cand-2 has mean of scores across criteria = mean(95, 70, 80) = 81.67 => 81.7
    // Cand-1 sub1 mean = mean(85, 90, 70) = 81.67, sub2 mean = mean(90, 85, 75) = 83.33 => aggregate = 82.5
    const top = leaderboard[0];
    expect(top.rank).toBe(1);
    expect(top.candidateId).toBe("cand-1");
    expect(top.finalScore).toBe(82.5);

    const second = leaderboard[1];
    expect(second.rank).toBe(2);
    expect(second.candidateId).toBe("cand-2");
  });
});

describe("toCsv", () => {
  it("exports leaderboard to CSV correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수");
    expect(csv).toContain("김철수");
    expect(csv).toContain("이영희");
  });
});
