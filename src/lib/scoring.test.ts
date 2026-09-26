import { describe, expect, test } from "bun:test";
import { buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 60, description: "기술", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 40, description: "소통", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Web",
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
    track: "Web",
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

describe("scoring - weightedTotal", () => {
  test("calculates correct weighted total with bonus capping", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // bonus capped at 80 * 0.1 = 8 -> 88
      { criterionId: "comm", score: 90, bonusPoints: 2 }, // bonus 2 -> 92
    ];

    // (88 * 60 / 100) + (92 * 40 / 100) = 52.8 + 36.8 = 89.6
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(89.6);
  });

  test("handles missing criterion scores gracefully", () => {
    const scores = [{ criterionId: "tech", score: 100 }];
    // (100 * 60 / 100) + (0 * 40 / 100) = 60
    const total = weightedTotal(scores, mockCriteria.items);
    expect(total).toBe(60);
  });
});

describe("scoring - buildLeaderboard", () => {
  test("ranks candidates correctly and assigns top criteria", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 70,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 95, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, submissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });

  test("handles tie-breaking with primary criterion", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 80,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 85,
            bonusPoints: 0,
            weight: 60,
          },
          {
            criterionId: "comm",
            criterionName: "의사소통",
            score: 72.5,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, submissions, mockCriteria, "weighted");

    expect(leaderboard[0].candidateId).toBe("cand-2"); // Higher primary criterion score (85 vs 80)
    expect(leaderboard[1].candidateId).toBe("cand-1");
  });
});

describe("scoring - toCsv", () => {
  test("exports leaderboard rows into CSV format", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, submissions, mockCriteria, "weighted");

    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,Web,1,82,90,70");
  });
});
