import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 50, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 30, description: "", maxScore: 100 },
    { id: "fit", name: "태도/조직적합도", weight: 20, description: "", maxScore: 100 },
  ],
};

describe("weightedTotal", () => {
  it("calculates weighted total score correctly without bonus", () => {
    const scores = [
      { criterionId: "tech", score: 80 },
      { criterionId: "comm", score: 90 },
      { criterionId: "fit", score: 70 },
    ];
    // (80*0.5) + (90*0.3) + (70*0.2) = 40 + 27 + 14 = 81
    expect(weightedTotal(scores, mockCriteria.items)).toBe(81);
  });

  it("caps bonus points at 10% of base score", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 15 }, // capped at 8
      { criterionId: "comm", score: 90, bonusPoints: 5 }, // 5
      { criterionId: "fit", score: 70, bonusPoints: 0 },
    ];
    // tech: 88*0.5 = 44, comm: 95*0.3 = 28.5, fit: 70*0.2 = 14 => sum = 86.5
    expect(weightedTotal(scores, mockCriteria.items)).toBe(86.5);
  });
});

describe("aggregate", () => {
  it("calculates mean correctly", () => {
    expect(aggregate([80, 90, 70], "mean")).toBe(80);
  });

  it("calculates median correctly", () => {
    expect(aggregate([80, 100, 60, 90], "median")).toBe(85);
  });

  it("calculates trimmed mean correctly for >= 3 values", () => {
    expect(aggregate([10, 80, 90, 100], "trimmed")).toBe(85); // trims 10 and 100, mean(80, 90) = 85
  });
});

describe("buildLeaderboard", () => {
  const mockCandidates: Candidate[] = [
    {
      id: "c1",
      roomId: "r1",
      name: "Kim",
      track: "Web",
      studentId: "1",
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "r1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "c2",
      roomId: "r1",
      name: "Lee",
      track: "AI",
      studentId: "2",
      phone: "",
      email: "",
      timeslot: { start: "10:30", end: "11:00", room: "r1" },
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
      interviewerName: "I1",
      submittedAt: "2026-01-01",
      scores: [
        { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 0, weight: 50 },
        { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 30 },
        {
          criterionId: "fit",
          criterionName: "태도/조직적합도",
          score: 70,
          bonusPoints: 0,
          weight: 20,
        },
      ],
      totalWeightedScore: 83,
    },
    {
      id: "s2",
      candidateId: "c2",
      roomId: "r1",
      interviewerName: "I1",
      submittedAt: "2026-01-01",
      scores: [
        { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 50 },
        { criterionId: "comm", criterionName: "의사소통", score: 95, bonusPoints: 0, weight: 30 },
        {
          criterionId: "fit",
          criterionName: "태도/조직적합도",
          score: 90,
          bonusPoints: 0,
          weight: 20,
        },
      ],
      totalWeightedScore: 81.5,
    },
  ];

  it("ranks candidates correctly and assigns top criteria using weighted total score", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].finalScore).toBe(83);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].finalScore).toBe(81.5);
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });

  it("benchmarks buildLeaderboard performance with 100 candidates and 300 submissions", () => {
    const candidates: Candidate[] = Array.from({ length: 100 }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Web" : "AI",
      studentId: `2026${i}`,
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "room-1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 3; j++) {
        submissions.push({
          id: `sub-${i}-${j}`,
          candidateId: `cand-${i}`,
          roomId: "room-1",
          interviewerName: `Interviewer ${j}`,
          submittedAt: "2026-01-01",
          scores: [
            {
              criterionId: "tech",
              criterionName: "기술 역량",
              score: 70 + (i % 20),
              bonusPoints: 2,
              weight: 50,
            },
            {
              criterionId: "comm",
              criterionName: "의사소통",
              score: 60 + (i % 30),
              bonusPoints: 1,
              weight: 30,
            },
            {
              criterionId: "fit",
              criterionName: "태도/조직적합도",
              score: 80 + (i % 10),
              bonusPoints: 0,
              weight: 20,
            },
          ],
          totalWeightedScore: 75,
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    const elapsed = performance.now() - start;

    expect(result.length).toBe(100);
    expect(elapsed).toBeLessThan(50); // Should execute comfortably under 50ms
  });
});
