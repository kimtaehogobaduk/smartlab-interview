import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
    { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 20, description: "", maxScore: 100 },
    { id: "fit", name: "태도", weight: 10, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "Web",
    studentId: "101",
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
    track: "AI",
    studentId: "102",
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
    roomId: "r1",
    candidateId: "c1",
    interviewerName: "I1",
    submittedAt: "",
    totalWeightedScore: 85,
    scores: [
      { criterionId: "tech", score: 90, bonusPoints: 2 },
      { criterionId: "problem", score: 80, bonusPoints: 0 },
      { criterionId: "comm", score: 85, bonusPoints: 0 },
      { criterionId: "fit", score: 80, bonusPoints: 0 },
    ],
  },
  {
    id: "s2",
    roomId: "r1",
    candidateId: "c1",
    interviewerName: "I2",
    submittedAt: "",
    totalWeightedScore: 89,
    scores: [
      { criterionId: "tech", score: 95, bonusPoints: 0 },
      { criterionId: "problem", score: 85, bonusPoints: 0 },
      { criterionId: "comm", score: 90, bonusPoints: 0 },
      { criterionId: "fit", score: 85, bonusPoints: 0 },
    ],
  },
  {
    id: "s3",
    roomId: "r1",
    candidateId: "c2",
    interviewerName: "I1",
    submittedAt: "",
    totalWeightedScore: 75,
    scores: [
      { criterionId: "tech", score: 70, bonusPoints: 0 },
      { criterionId: "problem", score: 75, bonusPoints: 0 },
      { criterionId: "comm", score: 80, bonusPoints: 0 },
      { criterionId: "fit", score: 80, bonusPoints: 0 },
    ],
  },
];

describe("scoring lib tests", () => {
  test("buildLeaderboard computes ranks and top criteria correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].name).toBe("Alice");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].name).toBe("Bob");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
  });

  test("toCsv converts leaderboard items to CSV", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙");
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });

  test("benchmark buildLeaderboard with larger dataset", () => {
    const candidates: Candidate[] = Array.from({ length: 300 }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "r1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Web" : "AI",
      studentId: `${1000 + i}`,
      phone: "",
      email: "",
      timeslot: { start: "", end: "", room: "" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    candidates.forEach((cand) => {
      for (let j = 0; j < 5; j++) {
        submissions.push({
          id: `sub-${cand.id}-${j}`,
          roomId: "r1",
          candidateId: cand.id,
          interviewerName: `Interviewer ${j}`,
          submittedAt: "",
          totalWeightedScore: 70 + ((cand.name.length * 3 + j) % 30),
          scores: mockCriteria.items.map((item) => ({
            criterionId: item.id,
            score: 70 + ((j * 5 + item.weight) % 30),
            bonusPoints: j,
          })),
        });
      }
    });

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    }
    const elapsed = performance.now() - start;
    console.log(
      `[Benchmark 50 runs of buildLeaderboard with 300 candidates & 1500 submissions]: ${elapsed.toFixed(2)} ms`,
    );
    expect(elapsed).toBeGreaterThan(0);
  });
});
