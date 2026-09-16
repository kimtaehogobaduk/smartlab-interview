import { describe, expect, test } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("buildLeaderboard", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "weighted",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 40, description: "", maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "Alice",
      track: "Backend",
      studentId: "20200001",
      phone: "010-0000-0000",
      email: "alice@example.com",
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
      studentId: "20200002",
      phone: "010-0000-0001",
      email: "bob@example.com",
      timeslot: { start: "10:30", end: "11:00", room: "Room A" },
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
      roomId: "room-1",
      interviewerName: "Interviewer A",
      submittedAt: new Date().toISOString(),
      scores: [
        {
          criterionId: "c1",
          criterionName: "Problem Solving",
          score: 80,
          bonusPoints: 0,
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
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
    {
      id: "sub-2",
      candidateId: "cand-2",
      roomId: "room-1",
      interviewerName: "Interviewer A",
      submittedAt: new Date().toISOString(),
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
      qualitativeFeedback: { strengths: "", improvements: "" },
    },
  ];

  test("correctly ranks candidates and assigns top criteria", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(84);
    expect(leaderboard[0].topCriteria).toContain("Communication");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(82);
    expect(leaderboard[1].topCriteria).toContain("Problem Solving");
  });

  test("breaks ties using primary weighted criterion", () => {
    const tiedSubmissions: EvaluationSubmission[] = [
      { ...submissions[0], totalWeightedScore: 80 }, // Alice: total 80, c1 (60% weight) = 80
      {
        ...submissions[1],
        scores: [
          {
            criterionId: "c1",
            criterionName: "Problem Solving",
            score: 85,
            bonusPoints: 0,
            weight: 60,
          },
          {
            criterionId: "c2",
            criterionName: "Communication",
            score: 72.5,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 80, // Bob: total 80, c1 (60% weight) = 85
      },
    ];

    const leaderboard = buildLeaderboard(candidates, tiedSubmissions, criteria, "weighted");
    expect(leaderboard[0].candidateId).toBe("cand-2"); // Bob wins tie due to higher c1 average
    expect(leaderboard[1].candidateId).toBe("cand-1");
  });
});
