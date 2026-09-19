import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("weightedTotal", () => {
  const items = [
    { id: "c1", name: "전공", weight: 50, description: "", maxScore: 100 },
    { id: "c2", name: "협업", weight: 50, description: "", maxScore: 100 },
  ];

  test("calculates weighted total correctly without bonus", () => {
    const scores = [
      { criterionId: "c1", score: 80 },
      { criterionId: "c2", score: 90 },
    ];
    // 80*0.5 + 90*0.5 = 40 + 45 = 85
    expect(weightedTotal(scores, items)).toBe(85);
  });

  test("applies bonus points capped at 10% of base score", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 10 }, // capped at 80*0.1 = 8 => score 88 -> weight 50% = 44
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // capped at 9 => 5 <= 9 -> score 95 -> weight 50% = 47.5
    ];
    // 44 + 47.5 = 91.5
    expect(weightedTotal(scores, items)).toBe(91.5);
  });
});

describe("aggregate", () => {
  test("computes mean formula", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
  });

  test("computes median formula", () => {
    expect(aggregate([10, 90, 100], "median")).toBe(90);
  });

  test("computes trimmed mean formula", () => {
    expect(aggregate([10, 80, 90, 100], "trimmed")).toBe(85); // mean of 80 and 90
  });
});

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    items: [
      { id: "c1", name: "전공", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "인성", weight: 40, description: "", maxScore: 100 },
    ],
    formula: "trimmed",
    isConfirmed: true,
  };

  const candidates: Candidate[] = [
    {
      id: "cand_1",
      roomId: "room_1",
      name: "Alice",
      track: "Frontend",
      studentId: "1111",
      status: "COMPLETED",
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand_2",
      roomId: "room_1",
      name: "Bob",
      track: "Backend",
      studentId: "2222",
      status: "COMPLETED",
      timeslot: { start: "10:30", end: "11:00", room: "A" },
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ];

  const submissions: EvaluationSubmission[] = [
    {
      id: "sub_1",
      candidateId: "cand_1",
      roomId: "room_1",
      interviewerName: "P1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "c1", criterionName: "전공", score: 90, weight: 60 },
        { criterionId: "c2", criterionName: "인성", score: 80, weight: 40 },
      ],
      totalWeightedScore: 86,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
    {
      id: "sub_2",
      candidateId: "cand_2",
      roomId: "room_1",
      interviewerName: "P1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "c1", criterionName: "전공", score: 70, weight: 60 },
        { criterionId: "c2", criterionName: "인성", score: 80, weight: 40 },
      ],
      totalWeightedScore: 74,
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  test("ranks candidates accurately and sets topCriteria", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand_1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].topCriteria).toContain("전공");

    expect(leaderboard[1].candidateId).toBe("cand_2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(74);
  });
});

describe("toCsv", () => {
  const criteria: CriteriaConfig = {
    items: [{ id: "c1", name: "전공", weight: 100, description: "", maxScore: 100 }],
    formula: "mean",
    isConfirmed: true,
  };

  test("exports leaderboard items to CSV string", () => {
    const rows = [
      {
        candidateId: "cand_1",
        name: "Alice",
        track: "Frontend",
        panelCount: 1,
        finalScore: 90,
        perCriterion: [{ criterionId: "c1", name: "전공", average: 90 }],
        rank: 1,
        topCriteria: ["전공"],
      },
    ];
    const csv = toCsv(rows, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,전공(100%)");
    expect(csv).toContain("1,Alice,Frontend,1,90,90");
  });
});
