import { describe, expect, test } from "bun:test";
import { buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  confirmedAt: "2026-03-01T00:00:00.000Z",
  confirmedBy: "Admin",
  formula: "mean",
  items: [
    {
      id: "c1",
      name: "문제 해결 능력",
      weight: 60,
      description: "코딩 및 문제 해결",
      maxScore: 100,
    },
    {
      id: "c2",
      name: "협업 능력",
      weight: 40,
      description: "커뮤니케이션",
      maxScore: 100,
    },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Web",
    studentId: "20260001",
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
    roomId: "room-1",
    name: "Bob",
    track: "Web",
    studentId: "20260002",
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
    roomId: "room-1",
    candidateId: "cand-1",
    interviewerName: "Interviewer A",
    scores: [
      { criterionId: "c1", score: 90, bonusPoints: 5 }, // 90 + 5 = 95
      { criterionId: "c2", score: 80, bonusPoints: 0 }, // 80
    ], // avg score: (95 + 80) / 2 = 87.5
    totalWeightedScore: 89,
    submittedAt: "2026-03-01T10:30:00.000Z",
  },
  {
    id: "sub-2",
    roomId: "room-1",
    candidateId: "cand-2",
    interviewerName: "Interviewer A",
    scores: [
      { criterionId: "c1", score: 70, bonusPoints: 0 },
      { criterionId: "c2", score: 85, bonusPoints: 0 },
    ],
    totalWeightedScore: 76,
    submittedAt: "2026-03-01T11:00:00.000Z",
  },
];

describe("scoring logic", () => {
  test("weightedTotal calculates score correctly", () => {
    const scores = [
      { criterionId: "c1", score: 90, bonusPoints: 5 },
      { criterionId: "c2", score: 80, bonusPoints: 0 },
    ];
    // (95 * 60 / 100) + (80 * 40 / 100) = 57 + 32 = 89
    expect(weightedTotal(scores, mockCriteria.items)).toBe(89);
  });

  test("buildLeaderboard produces correct ranks, scores and criteria winners", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");

    expect(leaderboard).toHaveLength(2);

    const first = leaderboard[0];
    expect(first.candidateId).toBe("cand-1");
    expect(first.rank).toBe(1);
    expect(first.finalScore).toBe(87.5);
    expect(first.topCriteria).toContain("문제 해결 능력");

    const second = leaderboard[1];
    expect(second.candidateId).toBe("cand-2");
    expect(second.rank).toBe(2);
    expect(second.topCriteria).toContain("협업 능력");
  });

  test("toCsv exports criteria correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,문제 해결 능력(60%),협업 능력(40%)");
    expect(csv).toContain("1,Alice,Web,1,87.5,95,80");
  });

  test("benchmark scale test for buildLeaderboard", () => {
    const numCandidates = 100;
    const numSubmissionsPerCandidate = 5;

    const largeCandidates: Candidate[] = Array.from({ length: numCandidates }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Web" : "AI",
      studentId: `2026${1000 + i}`,
      phone: "010-0000-0000",
      email: `cand${i}@test.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const largeSubmissions: EvaluationSubmission[] = [];
    for (let i = 0; i < numCandidates; i++) {
      for (let j = 0; j < numSubmissionsPerCandidate; j++) {
        largeSubmissions.push({
          id: `sub-${i}-${j}`,
          roomId: "room-1",
          candidateId: `cand-${i}`,
          interviewerName: `Interviewer ${j}`,
          scores: [
            { criterionId: "c1", score: 60 + ((i + j) % 40), bonusPoints: j },
            { criterionId: "c2", score: 50 + ((i * j) % 50), bonusPoints: 0 },
          ],
          totalWeightedScore: 70,
          submittedAt: "2026-03-01T10:00:00.000Z",
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(largeCandidates, largeSubmissions, mockCriteria, "mean");
    const elapsed = performance.now() - start;

    expect(result.length).toBe(numCandidates);
    expect(elapsed).toBeLessThan(50); // Should run well within 50ms
  });
});
