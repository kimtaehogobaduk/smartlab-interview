import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring & leaderboard tests", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
      { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 30, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "c1",
      roomId: "r1",
      name: "Alice",
      track: "Frontend",
      studentId: "1",
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
      id: "c2",
      roomId: "r1",
      name: "Bob",
      track: "Backend",
      studentId: "2",
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

  const submissions: EvaluationSubmission[] = [
    {
      id: "s1",
      candidateId: "c1",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "tech", criterionName: "기술 역량", score: 90, bonusPoints: 5, weight: 40 },
        {
          criterionId: "problem",
          criterionName: "문제 해결력",
          score: 80,
          bonusPoints: 0,
          weight: 30,
        },
        { criterionId: "comm", criterionName: "의사소통", score: 85, bonusPoints: 0, weight: 30 },
      ],
      totalWeightedScore: 85.5,
      qualitativeFeedback: { strengths: "Great", improvements: "None" },
    },
    {
      id: "s2",
      candidateId: "c2",
      roomId: "r1",
      interviewerName: "Interviewer 1",
      submittedAt: new Date().toISOString(),
      scores: [
        { criterionId: "tech", criterionName: "기술 역량", score: 70, bonusPoints: 0, weight: 40 },
        {
          criterionId: "problem",
          criterionName: "문제 해결력",
          score: 75,
          bonusPoints: 0,
          weight: 30,
        },
        { criterionId: "comm", criterionName: "의사소통", score: 80, bonusPoints: 0, weight: 30 },
      ],
      totalWeightedScore: 74.5,
      qualitativeFeedback: { strengths: "Good", improvements: "Needs practice" },
    },
  ];

  test("weightedTotal calculates score with capped bonus points correctly", () => {
    const scores = [
      { criterionId: "tech", score: 90, bonusPoints: 15 }, // bonus max is 90 * 0.1 = 9
      { criterionId: "problem", score: 80, bonusPoints: 2 },
      { criterionId: "comm", score: 70 },
    ];
    // tech: (90 + 9) * 0.4 = 39.6
    // problem: (80 + 2) * 0.3 = 24.6
    // comm: 70 * 0.3 = 21.0
    // sum: 39.6 + 24.6 + 21.0 = 85.2
    expect(weightedTotal(scores, criteria.items)).toBe(85.2);
  });

  test("aggregate calculates mean, median, and trimmed values correctly", () => {
    const values = [60, 70, 80, 90, 100];
    expect(aggregate(values, "mean")).toBe(80);
    expect(aggregate(values, "median")).toBe(80);
    expect(aggregate(values, "trimmed")).toBe(80);
  });

  test("buildLeaderboard ranks candidates accurately and determines top criteria", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
  });

  test("toCsv converts leaderboard rows to CSV format", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,기술 역량(40%),문제 해결력(30%),의사소통(30%)",
    );
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });
});
