import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring lib", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "c1",
      roomId: "r1",
      name: "Alice",
      track: "Frontend",
      studentId: "101",
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
      name: "Bob",
      track: "Backend",
      studentId: "102",
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

  it("calculates weightedTotal correctly with capped bonus points", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // 10 capped at 8 (10% of 80) -> 88
      { criterionId: "comm", score: 90, bonusPoints: 5 }, // 5 capped at 5 -> 95
    ];
    // (88 * 60 + 95 * 40) / 100 = (5280 + 3800) / 100 = 90.8
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(90.8);
  });

  it("aggregates values correctly for trimmed, median, mean", () => {
    const values = [60, 80, 100];
    expect(aggregate(values, "mean")).toBe(80);
    expect(aggregate(values, "median")).toBe(80);
    expect(aggregate(values, "trimmed")).toBe(80);

    const values4 = [50, 70, 90, 100];
    // trimmed removes 50 and 100, mean of [70, 90] = 80
    expect(aggregate(values4, "trimmed")).toBe(80);
  });

  it("builds leaderboard accurately and ranks candidates", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        roomId: "r1",
        candidateId: "c1",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 90, bonusPoints: 0 },
          { criterionId: "comm", score: 80, bonusPoints: 0 },
        ],
        totalWeightedScore: 86,
        submittedAt: new Date().toISOString(),
      },
      {
        id: "s2",
        roomId: "r1",
        candidateId: "c2",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 70, bonusPoints: 0 },
          { criterionId: "comm", score: 70, bonusPoints: 0 },
        ],
        totalWeightedScore: 70,
        submittedAt: new Date().toISOString(),
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(86);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
    expect(leaderboard[0].topCriteria).toContain("의사소통");

    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(70);
  });

  it("exports leaderboard to CSV", () => {
    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        roomId: "r1",
        candidateId: "c1",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 90 },
          { criterionId: "comm", score: 80 },
        ],
        totalWeightedScore: 86,
        submittedAt: new Date().toISOString(),
      },
    ];
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,Frontend,1,86,90,80");
  });
});
