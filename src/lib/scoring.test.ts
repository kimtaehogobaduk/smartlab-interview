import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  it("calculates weightedTotal correctly including bonus points capped at 10%", () => {
    const items = [
      { id: "tech", name: "Tech", weight: 50, maxScore: 100 },
      { id: "comm", name: "Comm", weight: 50, maxScore: 100 },
    ];
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // bonus capped at 8 (80 * 0.1) -> 88
      { criterionId: "comm", score: 90, bonusPoints: 5 }, // bonus 5 <= 9 -> 95
    ];

    // weighted sum: (88 * 50 / 100) + (95 * 50 / 100) = 44 + 47.5 = 91.5
    expect(weightedTotal(scores, items)).toBe(91.5);
  });

  it("calculates aggregate formula correctly", () => {
    const values = [70, 80, 90, 100];
    expect(aggregate(values, "mean")).toBe(85);
    expect(aggregate(values, "median")).toBe(85);
    expect(aggregate(values, "trimmed")).toBe(85); // average of [80, 90]
  });

  it("builds leaderboard correctly", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "mean",
      passCutoff: 70,
      items: [
        { id: "tech", name: "기술", weight: 60, maxScore: 100 },
        { id: "comm", name: "소통", weight: 40, maxScore: 100 },
      ],
    };

    const candidates: Candidate[] = [
      {
        id: "c1",
        roomId: "r1",
        name: "Alice",
        track: "Dev",
        studentId: "1",
        phone: "1",
        email: "1",
        timeslot: { start: "", end: "", room: "" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "c2",
        roomId: "r1",
        name: "Bob",
        track: "Dev",
        studentId: "2",
        phone: "2",
        email: "2",
        timeslot: { start: "", end: "", room: "" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        roomId: "r1",
        candidateId: "c1",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "tech", score: 90, bonusPoints: 0 },
          { criterionId: "comm", score: 80, bonusPoints: 0 },
        ],
        totalWeightedScore: 86,
      },
      {
        id: "s2",
        roomId: "r1",
        candidateId: "c2",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "tech", score: 70, bonusPoints: 0 },
          { criterionId: "comm", score: 100, bonusPoints: 0 },
        ],
        totalWeightedScore: 82,
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(85); // mean of scores (90+80)/2 = 85

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(85); // mean of scores (70+100)/2 = 85

    // Primary criterion ("tech", weight 60) tie breaker: Alice has 90 vs Bob has 70. Alice ranks 1.
    expect(leaderboard[0].topCriteria).toContain("기술");
    expect(leaderboard[1].topCriteria).toContain("소통");
  });

  it("exports CSV correctly", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "mean",
      passCutoff: 70,
      items: [{ id: "tech", name: "기술", weight: 100, maxScore: 100 }],
    };

    const rows = [
      {
        candidateId: "c1",
        name: "Alice",
        track: "Dev",
        panelCount: 1,
        finalScore: 90,
        perCriterion: [{ criterionId: "tech", name: "기술", average: 90 }],
        rank: 1,
        topCriteria: ["기술"],
      },
    ];

    const csv = toCsv(rows, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술(100%)");
    expect(csv).toContain("1,Alice,Dev,1,90,90");
  });
});
