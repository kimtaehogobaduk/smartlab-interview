import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  it("calculates weighted total score correctly with weights", () => {
    const items = [
      { id: "c1", name: "기술역량", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "인성/태도", weight: 50, description: "", maxScore: 100 },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 0 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ];

    expect(weightedTotal(scores, items)).toBe(85);
  });

  it("handles bonus points capped at 10% of score", () => {
    const items = [{ id: "c1", name: "기술역량", weight: 100, description: "", maxScore: 100 }];
    // Bonus points 20 capped at 10% of score 80 = 8. Total = 88.
    const scores = [{ criterionId: "c1", score: 80, bonusPoints: 20 }];

    expect(weightedTotal(scores, items)).toBe(88);
  });

  it("handles missing scores gracefully", () => {
    const items = [
      { id: "c1", name: "기술역량", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "인성/태도", weight: 50, description: "", maxScore: 100 },
    ];
    const scores = [{ criterionId: "c1", score: 80 }];

    expect(weightedTotal(scores, items)).toBe(40);
  });
});

describe("aggregate", () => {
  it("calculates mean correctly", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
  });

  it("calculates weighted/default correctly", () => {
    expect(aggregate([80, 90, 100], "weighted")).toBe(90);
  });

  it("calculates median correctly", () => {
    expect(aggregate([70, 80, 100], "median")).toBe(80);
    expect(aggregate([70, 80, 90, 100], "median")).toBe(85);
  });

  it("calculates trimmed mean correctly", () => {
    // Trims min (60) and max (100), averages 80 & 90 => 85
    expect(aggregate([60, 80, 90, 100], "trimmed")).toBe(85);
    // Fewer than 3 items falls back to mean
    expect(aggregate([70, 90], "trimmed")).toBe(80);
  });
});

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "weighted",
    items: [
      { id: "c1", name: "기술역량", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "협업능력", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "김철수",
      track: "백엔드",
      studentId: "20260001",
      phone: "",
      email: "",
      timeslot: { start: "14:00", end: "14:30", room: "A" },
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
      track: "프론트엔드",
      studentId: "20260002",
      phone: "",
      email: "",
      timeslot: { start: "14:30", end: "15:00", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "sub-1",
      candidateId: "cand-1",
      interviewerId: "iv-1",
      interviewerName: "면접관1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "c1", score: 90 },
        { criterionId: "c2", score: 80 },
      ],
      totalWeightedScore: 86,
      notes: "",
      recommendation: "PASS",
    },
    {
      id: "sub-2",
      candidateId: "cand-2",
      interviewerId: "iv-1",
      interviewerName: "면접관1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "c1", score: 70 },
        { criterionId: "c2", score: 90 },
      ],
      totalWeightedScore: 78,
      notes: "",
      recommendation: "PASS",
    },
  ];

  it("ranks candidates by score and calculates criteria averages correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].topCriteria).toContain("기술역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(78);
    expect(leaderboard[1].topCriteria).toContain("협업능력");
  });

  it("handles candidates with no submissions gracefully", () => {
    const candidatesWithUnevaluated = [
      ...candidates,
      {
        id: "cand-3",
        roomId: "room-1",
        name: "박민수",
        track: "백엔드",
        studentId: "20260003",
        phone: "",
        email: "",
        timeslot: { start: "15:00", end: "15:30", room: "A" },
        status: "PENDING" as const,
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const leaderboard = buildLeaderboard(
      candidatesWithUnevaluated,
      submissions,
      criteria,
      "weighted",
    );
    expect(leaderboard.length).toBe(2);
  });
});

describe("toCsv", () => {
  it("formats leaderboard as CSV string", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      items: [{ id: "c1", name: "기술역량", weight: 100, description: "", maxScore: 100 }],
    };
    const rows = [
      {
        candidateId: "cand-1",
        name: "김철수",
        track: "백엔드",
        panelCount: 1,
        finalScore: 90,
        perCriterion: [{ criterionId: "c1", name: "기술역량", average: 90 }],
        rank: 1,
        topCriteria: ["기술역량"],
      },
    ];

    const csv = toCsv(rows, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술역량(100%)");
    expect(csv).toContain("1,김철수,백엔드,1,90,90");
  });
});
