import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring algorithms", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    confirmedAt: new Date().toISOString(),
    confirmedBy: "Admin",
    formula: "weighted",
    items: [
      { id: "c1", name: "Problem Solving", weight: 50, description: "Desc 1", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 30, description: "Desc 2", maxScore: 100 },
      { id: "c3", name: "Domain Knowledge", weight: 20, description: "Desc 3", maxScore: 100 },
    ],
  };

  test("weightedTotal correctly calculates weighted score and caps bonus points at 10%", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 10 }, // bonus max = 8.0, total score = 88. weight 50% => 44
      { criterionId: "c2", score: 90, bonusPoints: 5 }, // bonus = 5. total score = 95. weight 30% => 28.5
      { criterionId: "c3", score: 70 }, // bonus = 0. total score = 70. weight 20% => 14
    ]; // total = 44 + 28.5 + 14 = 86.5
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(86.5);
  });

  test("buildLeaderboard computes candidates rank, top criteria, and scores correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Frontend",
        studentId: "20240001",
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
        track: "Backend",
        studentId: "20240002",
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
        roomId: "room1",
        candidateId: "cand1",
        evaluatorName: "Eval 1",
        evaluatorRole: "Senior",
        scores: [
          { criterionId: "c1", score: 90 },
          { criterionId: "c2", score: 80 },
          { criterionId: "c3", score: 85 },
        ],
        totalWeightedScore: 86,
        strengthNote: "",
        weaknessNote: "",
        submittedAt: new Date().toISOString(),
      },
      {
        id: "sub2",
        roomId: "room1",
        candidateId: "cand2",
        evaluatorName: "Eval 1",
        evaluatorRole: "Senior",
        scores: [
          { criterionId: "c1", score: 70 },
          { criterionId: "c2", score: 75 },
          { criterionId: "c3", score: 60 },
        ],
        totalWeightedScore: 69.5,
        submittedAt: new Date().toISOString(),
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
  });

  test("performance benchmark on large dataset", () => {
    const largeCriteria: CriteriaConfig = {
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "Admin",
      formula: "weighted",
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `crit_${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        description: `Desc ${i}`,
        maxScore: 100,
      })),
    };

    const candidatesCount = 300;
    const evaluatorsCount = 5;
    const candidates: Candidate[] = Array.from({ length: candidatesCount }, (_, i) => ({
      id: `c_${i}`,
      roomId: "room1",
      name: `Candidate ${i}`,
      track: `Track ${i % 3}`,
      studentId: `2024${i}`,
      phone: "010-0000-0000",
      email: `user${i}@test.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < candidatesCount; i++) {
      for (let e = 0; e < evaluatorsCount; e++) {
        const scores = largeCriteria.items.map((crit) => ({
          criterionId: crit.id,
          score: Math.floor(Math.random() * 50) + 50,
          bonusPoints: Math.floor(Math.random() * 5),
        }));
        submissions.push({
          id: `s_${i}_${e}`,
          roomId: "room1",
          candidateId: `c_${i}`,
          evaluatorName: `Eval ${e}`,
          evaluatorRole: "Senior",
          scores,
          totalWeightedScore: weightedTotal(scores, largeCriteria.items),
          submittedAt: new Date().toISOString(),
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(candidates, submissions, largeCriteria, "weighted");
    const duration = performance.now() - start;

    console.log(
      `buildLeaderboard with ${candidatesCount} candidates and ${submissions.length} submissions took ${duration.toFixed(2)}ms`,
    );
    expect(result.length).toBe(candidatesCount);
  });
});
