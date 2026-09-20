import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const sampleCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "전공 역량", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "협업 능력", weight: 30, description: "", maxScore: 100 },
      { id: "c3", name: "인성 및 열정", weight: 20, description: "", maxScore: 100 },
    ],
  };

  const sampleCandidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "홍길동",
      track: "웹개발",
      studentId: "20230001",
      phone: "010-1234-5678",
      email: "hong@example.com",
      timeslot: { start: "14:00", end: "14:30", room: "A실" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand-2",
      roomId: "room-1",
      name: "김철수",
      track: "AI 엔지니어링",
      studentId: "20230002",
      phone: "010-8765-4321",
      email: "kim@example.com",
      timeslot: { start: "14:30", end: "15:00", room: "A실" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ];

  const sampleSubmissions: EvaluationSubmission[] = [
    {
      id: "sub-1",
      candidateId: "cand-1",
      roomId: "room-1",
      interviewerName: "면접관1",
      submittedAt: "2025-01-01T10:00:00Z",
      scores: [
        { criterionId: "c1", criterionName: "전공 역량", score: 80, bonusPoints: 5, weight: 50 },
        { criterionId: "c2", criterionName: "협업 능력", score: 90, bonusPoints: 0, weight: 30 },
        { criterionId: "c3", criterionName: "인성 및 열정", score: 70, bonusPoints: 0, weight: 20 },
      ],
      totalWeightedScore: 81,
      qualitativeFeedback: { strengths: "우수", improvements: "없음" },
    },
    {
      id: "sub-2",
      candidateId: "cand-1",
      roomId: "room-1",
      interviewerName: "면접관2",
      submittedAt: "2025-01-01T10:05:00Z",
      scores: [
        { criterionId: "c1", criterionName: "전공 역량", score: 90, bonusPoints: 0, weight: 50 },
        { criterionId: "c2", criterionName: "협업 능력", score: 80, bonusPoints: 0, weight: 30 },
        { criterionId: "c3", criterionName: "인성 및 열정", score: 90, bonusPoints: 0, weight: 20 },
      ],
      totalWeightedScore: 87,
      qualitativeFeedback: { strengths: "논리적", improvements: "없음" },
    },
    {
      id: "sub-3",
      candidateId: "cand-2",
      roomId: "room-1",
      interviewerName: "면접관1",
      submittedAt: "2025-01-01T10:10:00Z",
      scores: [
        { criterionId: "c1", criterionName: "전공 역량", score: 95, bonusPoints: 0, weight: 50 },
        { criterionId: "c2", criterionName: "협업 능력", score: 70, bonusPoints: 0, weight: 30 },
        { criterionId: "c3", criterionName: "인성 및 열정", score: 80, bonusPoints: 0, weight: 20 },
      ],
      totalWeightedScore: 84.5,
      qualitativeFeedback: { strengths: "AI 이해도 높음", improvements: "소통 피드백" },
    },
  ];

  describe("weightedTotal", () => {
    it("calculates total score with weights and capped bonus points", () => {
      const scores = [
        { criterionId: "c1", score: 80, bonusPoints: 5 }, // 85 * 0.5 = 42.5
        { criterionId: "c2", score: 90, bonusPoints: 0 }, // 90 * 0.3 = 27
        { criterionId: "c3", score: 70, bonusPoints: 0 }, // 70 * 0.2 = 14
      ];
      expect(weightedTotal(scores, sampleCriteria.items)).toBe(83.5);
    });

    it("caps bonus points at 10% of score", () => {
      const scores = [
        { criterionId: "c1", score: 50, bonusPoints: 20 }, // max bonus is 5 -> score = 55 * 0.5 = 27.5
        { criterionId: "c2", score: 0, bonusPoints: 10 }, // max bonus is 0 -> score = 0
        { criterionId: "c3", score: 100, bonusPoints: 5 }, // bonus 5 <= 10 -> score = 105 * 0.2 = 21
      ];
      expect(weightedTotal(scores, sampleCriteria.items)).toBe(48.5);
    });
  });

  describe("aggregate", () => {
    it("calculates mean", () => {
      expect(aggregate([10, 20, 30], "mean")).toBe(20);
    });

    it("calculates median", () => {
      expect(aggregate([10, 50, 30], "median")).toBe(30);
      expect(aggregate([10, 20, 30, 40], "median")).toBe(25);
    });

    it("calculates trimmed mean", () => {
      expect(aggregate([10, 20, 30, 40, 100], "trimmed")).toBe(30);
      expect(aggregate([10, 20], "trimmed")).toBe(15);
    });
  });

  describe("buildLeaderboard", () => {
    it("builds leaderboard items correctly", () => {
      const leaderboard = buildLeaderboard(
        sampleCandidates,
        sampleSubmissions,
        sampleCriteria,
        "mean",
      );

      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].candidateId).toBe("cand-1");
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].panelCount).toBe(2);

      expect(leaderboard[1].candidateId).toBe("cand-2");
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].panelCount).toBe(1);
    });

    it("ranks candidates with ties breaking on primary criterion", () => {
      // Create equal total score candidates
      const candidates: Candidate[] = [
        { ...sampleCandidates[0], id: "c-a", name: "A" },
        { ...sampleCandidates[1], id: "c-b", name: "B" },
      ];
      const submissions: EvaluationSubmission[] = [
        {
          ...sampleSubmissions[0],
          id: "s-a",
          candidateId: "c-a",
          scores: [
            {
              criterionId: "c1",
              criterionName: "전공 역량",
              score: 80,
              bonusPoints: 0,
              weight: 50,
            },
            {
              criterionId: "c2",
              criterionName: "협업 능력",
              score: 100,
              bonusPoints: 0,
              weight: 30,
            },
            {
              criterionId: "c3",
              criterionName: "인성 및 열정",
              score: 100,
              bonusPoints: 0,
              weight: 20,
            },
          ],
          totalWeightedScore: 90,
        },
        {
          ...sampleSubmissions[0],
          id: "s-b",
          candidateId: "c-b",
          scores: [
            {
              criterionId: "c1",
              criterionName: "전공 역량",
              score: 100,
              bonusPoints: 0,
              weight: 50,
            },
            {
              criterionId: "c2",
              criterionName: "협업 능력",
              score: 80,
              bonusPoints: 0,
              weight: 30,
            },
            {
              criterionId: "c3",
              criterionName: "인성 및 열정",
              score: 80,
              bonusPoints: 0,
              weight: 20,
            },
          ],
          totalWeightedScore: 90,
        },
      ];

      const leaderboard = buildLeaderboard(candidates, submissions, sampleCriteria, "weighted");
      expect(leaderboard[0].candidateId).toBe("c-b"); // Candidate B has higher primary criterion (c1) score (100 vs 80)
      expect(leaderboard[1].candidateId).toBe("c-a");
    });
  });
});
