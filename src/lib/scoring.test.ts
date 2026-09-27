import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "기술 역량", weight: 60, description: "기술", maxScore: 100 },
    { id: "c2", name: "인성", weight: 40, description: "인성", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "cand-1",
    roomId: "room-1",
    name: "Alice",
    track: "Backend",
    studentId: "101",
    phone: "010-1111-1111",
    email: "alice@test.com",
    timeslot: { start: "10:00", end: "10:30", room: "Room A" },
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
    track: "Frontend",
    studentId: "102",
    phone: "010-2222-2222",
    email: "bob@test.com",
    timeslot: { start: "10:30", end: "11:00", room: "Room A" },
    status: "COMPLETED",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

describe("weightedTotal", () => {
  it("calculates weighted score correctly without bonus points", () => {
    const scores = [
      { criterionId: "c1", score: 80 },
      { criterionId: "c2", score: 90 },
    ];
    // (80 * 60) / 100 + (90 * 40) / 100 = 48 + 36 = 84
    expect(weightedTotal(scores, mockCriteria.items)).toBe(84);
  });

  it("calculates bonus points correctly capped at 10% of score", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 15 }, // capped at 8 (80 * 0.1) -> 88
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // 5 <= 9 -> 95
    ];
    // (88 * 60) / 100 + (95 * 40) / 100 = 52.8 + 38 = 90.8
    expect(weightedTotal(scores, mockCriteria.items)).toBe(90.8);
  });
});

describe("aggregate", () => {
  it("calculates mean", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
  });

  it("calculates median", () => {
    expect(aggregate([10, 50, 20], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
  });

  it("calculates trimmed mean for 3+ values", () => {
    expect(aggregate([10, 20, 80, 100], "trimmed")).toBe(50); // mean of [20, 80]
  });
});

describe("buildLeaderboard", () => {
  it("builds leaderboard and calculates ranks and top criteria correctly", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "c1", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 60 },
          { criterionId: "c2", criterionName: "인성", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "c1", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 60 },
          { criterionId: "c2", criterionName: "인성", score: 95, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, submissions, mockCriteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(82);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(80);
    expect(leaderboard[1].topCriteria).toContain("인성");
  });

  it("handles ties breaking by primary criterion score", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        candidateId: "cand-1",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "c1", criterionName: "기술 역량", score: 80, bonusPoints: 0, weight: 60 },
          { criterionId: "c2", criterionName: "인성", score: 80, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "c1", criterionName: "기술 역량", score: 85, bonusPoints: 0, weight: 60 },
          { criterionId: "c2", criterionName: "인성", score: 72.5, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(mockCandidates, submissions, mockCriteria, "weighted");

    expect(leaderboard[0].candidateId).toBe("cand-2"); // Higher score in c1 (weight 60)
    expect(leaderboard[1].candidateId).toBe("cand-1");
  });
});

describe("toCsv", () => {
  it("formats leaderboard as CSV string", () => {
    const leaderboard = buildLeaderboard(
      mockCandidates,
      [
        {
          id: "sub-1",
          candidateId: "cand-1",
          roomId: "room-1",
          interviewerName: "Interviewer 1",
          submittedAt: "2026-01-01",
          scores: [
            {
              criterionId: "c1",
              criterionName: "기술 역량",
              score: 90,
              bonusPoints: 0,
              weight: 60,
            },
            { criterionId: "c2", criterionName: "인성", score: 70, bonusPoints: 0, weight: 40 },
          ],
          totalWeightedScore: 82,
          qualitativeFeedback: { strengths: "", improvements: "" },
        },
      ],
      mockCriteria,
      "weighted",
    );

    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),인성(40%)");
    expect(csv).toContain("1,Alice,Backend,1,82,90,70");
  });
});
