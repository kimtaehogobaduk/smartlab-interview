import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "weighted",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Frontend",
    studentId: "1001",
    phone: "010-0000-0001",
    email: "alice@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
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
    track: "Backend",
    studentId: "1002",
    phone: "010-0000-0002",
    email: "bob@test.com",
    timeslot: { start: "10:30", end: "11:00", room: "Room 1" },
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
    interviewerName: "Interviewer A",
    scores: [
      { criterionId: "tech", score: 90 },
      { criterionId: "comm", score: 80 },
    ],
    totalWeightedScore: 86,
    submittedAt: new Date().toISOString(),
  },
  {
    id: "sub-2",
    candidateId: "cand-2",
    roomId: "room-1",
    interviewerName: "Interviewer A",
    scores: [
      { criterionId: "tech", score: 70 },
      { criterionId: "comm", score: 95 },
    ],
    totalWeightedScore: 80,
    submittedAt: new Date().toISOString(),
  },
];

describe("buildLeaderboard", () => {
  test("ranks candidates correctly by final score", () => {
    const leaderboard = buildLeaderboard(
      mockCandidates,
      mockSubmissions,
      mockCriteria,
      mockCriteria.formula,
    );

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.candidateId).toBe("cand-1");
    expect(leaderboard[0]?.rank).toBe(1);
    expect(leaderboard[0]?.finalScore).toBe(86);

    expect(leaderboard[1]?.candidateId).toBe("cand-2");
    expect(leaderboard[1]?.rank).toBe(2);
    expect(leaderboard[1]?.finalScore).toBe(80);
  });

  test("correctly assigns top criteria per criterion", () => {
    const leaderboard = buildLeaderboard(
      mockCandidates,
      mockSubmissions,
      mockCriteria,
      mockCriteria.formula,
    );

    const alice = leaderboard.find((item) => item.candidateId === "cand-1");
    const bob = leaderboard.find((item) => item.candidateId === "cand-2");

    expect(alice?.topCriteria).toContain("기술 역량");
    expect(bob?.topCriteria).toContain("의사소통");
  });

  test("handles candidates without submissions gracefully", () => {
    const leaderboard = buildLeaderboard(mockCandidates, [], mockCriteria, mockCriteria.formula);

    expect(leaderboard).toHaveLength(0);
  });
});

describe("weightedTotal", () => {
  test("calculates weighted total including bonus points limit (10%)", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 15 }, // max bonus is 8 (10% of 80) => 88
      { criterionId: "comm", score: 70 }, // 70
    ];
    // 88 * 0.6 + 70 * 0.4 = 52.8 + 28 = 80.8
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(80.8);
  });
});
