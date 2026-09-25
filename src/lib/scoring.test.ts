import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
    { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 20, description: "", maxScore: 100 },
    { id: "fit", name: "태도/조직적합도", weight: 10, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    name: "Alice",
    track: "웹개발",
    studentId: "20260001",
    phone: "010-0000-0001",
    email: "alice@test.com",
    timeslot: { start: "14:00", end: "14:30", room: "A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "c2",
    name: "Bob",
    track: "AI 엔지니어링",
    studentId: "20260002",
    phone: "010-0000-0002",
    email: "bob@test.com",
    timeslot: { start: "14:35", end: "15:05", room: "A" },
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
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:00:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 80, weight: 40, bonusPoints: 2 },
      { criterionId: "problem", criterionName: "문제 해결력", score: 90, weight: 30 },
      { criterionId: "comm", criterionName: "의사소통", score: 85, weight: 20 },
      { criterionId: "fit", criterionName: "태도/조직적합도", score: 95, weight: 10 },
    ],
    totalWeightedScore: 85.5,
  },
  {
    id: "s2",
    candidateId: "c1",
    roomId: "room-a",
    interviewerName: "Interviewer 2",
    submittedAt: "2026-01-01T00:01:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 82, weight: 40 },
      { criterionId: "problem", criterionName: "문제 해결력", score: 88, weight: 30 },
      { criterionId: "comm", criterionName: "의사소통", score: 90, weight: 20 },
      { criterionId: "fit", criterionName: "태도/조직적합도", score: 90, weight: 10 },
    ],
    totalWeightedScore: 86.2,
  },
  {
    id: "s3",
    candidateId: "c2",
    roomId: "room-a",
    interviewerName: "Interviewer 1",
    submittedAt: "2026-01-01T00:02:00Z",
    scores: [
      { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 40 },
      { criterionId: "problem", criterionName: "문제 해결력", score: 80, weight: 30 },
      { criterionId: "comm", criterionName: "의사소통", score: 70, weight: 20 },
      { criterionId: "fit", criterionName: "태도/조직적합도", score: 80, weight: 10 },
    ],
    totalWeightedScore: 82.0,
  },
];

describe("scoring functions", () => {
  it("computes weightedTotal correctly with bonuses", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85
      { criterionId: "problem", score: 100 }, // 100
      { criterionId: "comm", score: 50 }, // 50
      { criterionId: "fit", score: 0 }, // 0
    ];
    // (85 * 40 + 100 * 30 + 50 * 20 + 0 * 10) / 100 = (3400 + 3000 + 1000 + 0) / 100 = 74.0
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(74.0);
  });

  it("aggregates values using different formulas", () => {
    const vals = [10, 20, 30, 40, 50];
    expect(aggregate(vals, "mean")).toBe(30);
    expect(aggregate(vals, "median")).toBe(30);
    expect(aggregate(vals, "trimmed")).toBe(30); // average of [20, 30, 40]

    const twoVals = [10, 20];
    expect(aggregate(twoVals, "trimmed")).toBe(15);
  });

  it("builds leaderboard accurately and identifies top criteria", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    expect(leaderboard.length).toBe(2);

    // Check candidate with higher score is ranked #1
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);

    // c2 should win "기술 역량" topCriteria because c2 tech score average is 90 vs c1 (81 + 82)/2 = 81.5
    expect(leaderboard[1].topCriteria).toContain("기술 역량");
  });

  it("generates CSV string correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,기술 역량(40%),문제 해결력(30%),의사소통(20%),태도/조직적합도(10%)",
    );
    expect(csv).toContain("1,Alice,웹개발,2");
    expect(csv).toContain("2,Bob,AI 엔지니어링,1");
  });
});
