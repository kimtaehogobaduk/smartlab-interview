import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand1",
      roomId: "room1",
      name: "Alice",
      track: "Frontend",
      studentId: "101",
      phone: "010-0000-0001",
      email: "alice@example.com",
      timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand2",
      roomId: "room1",
      name: "Bob",
      track: "Backend",
      studentId: "102",
      phone: "010-0000-0002",
      email: "bob@example.com",
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
      id: "sub1",
      candidateId: "cand1",
      roomId: "room1",
      interviewerName: "Interviewer 1",
      submittedAt: "2025-01-01T00:00:00Z",
      scores: [
        {
          criterionId: "c1",
          criterionName: "Problem Solving",
          score: 80,
          bonusPoints: 5,
          weight: 60,
        },
        {
          criterionId: "c2",
          criterionName: "Communication",
          score: 90,
          bonusPoints: 0,
          weight: 40,
        },
      ],
      totalWeightedScore: 84,
      qualitativeFeedback: { strengths: "Good", improvements: "None" },
    },
    {
      id: "sub2",
      candidateId: "cand1",
      roomId: "room1",
      interviewerName: "Interviewer 2",
      submittedAt: "2025-01-01T00:05:00Z",
      scores: [
        {
          criterionId: "c1",
          criterionName: "Problem Solving",
          score: 90,
          bonusPoints: 0,
          weight: 60,
        },
        {
          criterionId: "c2",
          criterionName: "Communication",
          score: 70,
          bonusPoints: 0,
          weight: 40,
        },
      ],
      totalWeightedScore: 82,
      qualitativeFeedback: { strengths: "Nice", improvements: "Clarity" },
    },
    {
      id: "sub3",
      candidateId: "cand2",
      roomId: "room1",
      interviewerName: "Interviewer 1",
      submittedAt: "2025-01-01T00:10:00Z",
      scores: [
        {
          criterionId: "c1",
          criterionName: "Problem Solving",
          score: 70,
          bonusPoints: 0,
          weight: 60,
        },
        {
          criterionId: "c2",
          criterionName: "Communication",
          score: 60,
          bonusPoints: 0,
          weight: 40,
        },
      ],
      totalWeightedScore: 66,
      qualitativeFeedback: { strengths: "Okay", improvements: "More practice" },
    },
  ];

  it("weightedTotal calculates weighted total with bonus points capped", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85 -> 85 * 0.6 = 51
      { criterionId: "c2", score: 90, bonusPoints: 20 }, // 90 + min(20, 9) = 99 -> 99 * 0.4 = 39.6
    ];
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(90.6);
  });

  it("aggregate computes formula values correctly", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 30], "median")).toBe(20);
    expect(aggregate([10, 20, 30], "trimmed")).toBe(20);
  });

  it("buildLeaderboard calculates correct ranks and scores", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);

    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].panelCount).toBe(2);

    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].panelCount).toBe(1);

    expect(leaderboard[0].topCriteria).toContain("Problem Solving");
    expect(leaderboard[0].topCriteria).toContain("Communication");
  });

  it("toCsv formats rows as CSV", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,Problem Solving(60%),Communication(40%)",
    );
    expect(csv).toContain("1,Alice,Frontend,2");
  });
});
