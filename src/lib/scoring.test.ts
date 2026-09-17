import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const sampleCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, maxScore: 100 },
  ],
};

const sampleCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "웹개발",
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
    track: "웹개발",
    timeslot: { start: "10:30", end: "11:00", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const sampleSubmissions: EvaluationSubmission[] = [
  {
    id: "s1",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, bonusPoints: 5, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 87, // 85 * 0.6 + 90 * 0.4 = 51 + 36 = 87
  },
  {
    id: "s2",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Interviewer 2",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 15, weight: 60 }, // capped at 90 * 0.1 = 9 => 99
      { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 87.4, // 99 * 0.6 + 70 * 0.4 = 59.4 + 28 = 87.4
  },
  {
    id: "s3",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Interviewer 1",
    submittedAt: new Date().toISOString(),
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 60 },
      { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 40 },
    ],
    totalWeightedScore: 74,
  },
];

describe("weightedTotal", () => {
  it("calculates weighted score and caps bonus points at 10% of base score", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 12 }, // 80 * 0.1 = 8 max bonus -> 88
      { criterionId: "comm", score: 50, bonusPoints: 2 }, // 50 + 2 = 52
    ];
    // 88 * 0.6 + 52 * 0.4 = 52.8 + 20.8 = 73.6
    expect(weightedTotal(scores, sampleCriteria.items)).toBe(73.6);
  });
});

describe("aggregate", () => {
  it("calculates mean formula correctly", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
  });

  it("calculates median formula correctly", () => {
    expect(aggregate([10, 80, 100], "median")).toBe(80);
    expect(aggregate([10, 80, 90, 100], "median")).toBe(85);
  });

  it("calculates trimmed mean formula correctly", () => {
    // trims min (10) and max (100), leaves 80 -> mean is 80
    expect(aggregate([10, 80, 100], "trimmed")).toBe(80);
    // for < 3 values, returns mean
    expect(aggregate([80, 90], "trimmed")).toBe(85);
  });
});

describe("buildLeaderboard", () => {
  it("builds leaderboard items and ranks candidates", () => {
    const leaderboard = buildLeaderboard(
      sampleCandidates,
      sampleSubmissions,
      sampleCriteria,
      "mean",
    );

    expect(leaderboard.length).toBe(2);

    // Alice (c1) should be rank 1
    const alice = leaderboard.find((item) => item.candidateId === "c1");
    expect(alice).toBeDefined();
    expect(alice?.rank).toBe(1);
    expect(alice?.panelCount).toBe(2);

    // Bob (c2) should be rank 2
    const bob = leaderboard.find((item) => item.candidateId === "c2");
    expect(bob).toBeDefined();
    expect(bob?.rank).toBe(2);
    expect(bob?.panelCount).toBe(1);

    // Check topCriteria assignment
    expect(alice?.topCriteria).toContain("기술 역량");
    expect(alice?.topCriteria).toContain("의사소통");
  });
});

describe("toCsv", () => {
  it("exports leaderboard items to CSV format", () => {
    const leaderboard = buildLeaderboard(
      sampleCandidates,
      sampleSubmissions,
      sampleCriteria,
      "mean",
    );
    const csv = toCsv(leaderboard, sampleCriteria);

    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,웹개발,2,");
    expect(csv).toContain("2,Bob,웹개발,1,");
  });
});
