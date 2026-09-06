import { describe, expect, test } from "bun:test";
import { buildLeaderboard, aggregate, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  test("weightedTotal calculates weighted scores correctly", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 },
      { criterionId: "c2", score: 90, bonusPoints: 0 },
    ];
    const items = [
      { id: "c1", name: "C1", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "C2", weight: 50, description: "", maxScore: 100 },
    ];
    expect(weightedTotal(scores, items)).toBe(87.5);
  });

  test("buildLeaderboard aggregates and ranks correctly", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      confirmedAt: "",
      confirmedBy: "",
      formula: "mean",
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
        track: "Web",
        studentId: "1",
        phone: "010-0000-0000",
        email: "alice@test.com",
        timeslot: { start: "10:00", end: "10:30", room: "A" },
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
        track: "Web",
        studentId: "2",
        phone: "010-0000-0001",
        email: "bob@test.com",
        timeslot: { start: "10:30", end: "11:00", room: "A" },
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
        submittedAt: "",
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
            score: 80,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 86,
      },
      {
        id: "sub2",
        candidateId: "cand2",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: "",
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
            score: 70,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 70,
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("Problem Solving");
    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
  });

  test("benchmark buildLeaderboard performance", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      confirmedAt: "",
      confirmedBy: "",
      formula: "weighted",
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        description: "",
        maxScore: 100,
      })),
    };

    const candidates: Candidate[] = Array.from({ length: 200 }, (_, i) => ({
      id: `cand_${i}`,
      roomId: `room_${i % 5}`,
      name: `Candidate ${i}`,
      track: `Track ${i % 3}`,
      studentId: `${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@test.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < 200; i++) {
      for (let p = 0; p < 5; p++) {
        submissions.push({
          id: `sub_${i}_${p}`,
          candidateId: `cand_${i}`,
          roomId: `room_${i % 5}`,
          interviewerName: `Interviewer ${p}`,
          submittedAt: "",
          scores: criteria.items.map((item) => ({
            criterionId: item.id,
            criterionName: item.name,
            score: 50 + (i % 50) + p,
            bonusPoints: 2,
            weight: 10,
          })),
          totalWeightedScore: 50 + (i % 50) + p,
        });
      }
    }

    const start = performance.now();
    for (let run = 0; run < 100; run++) {
      buildLeaderboard(candidates, submissions, criteria, "weighted");
    }
    const elapsed = performance.now() - start;
    console.log(`[Benchmark] 100 runs took: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeGreaterThan(0);
  });
});
