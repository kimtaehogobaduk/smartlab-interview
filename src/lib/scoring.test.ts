import { describe, expect, test } from "bun:test";
import { buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const sampleCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술", weight: 40, description: "", maxScore: 100 },
      { id: "problem", name: "문제해결", weight: 30, description: "", maxScore: 100 },
      { id: "comm", name: "소통", weight: 30, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal calculates weighted scores correctly", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 2 },
      { criterionId: "problem", score: 90, bonusPoints: 0 },
      { criterionId: "comm", score: 70, bonusPoints: 0 },
    ];
    const total = weightedTotal(scores, sampleCriteria.items);
    expect(total).toBe(80.8);
  });

  test("buildLeaderboard aggregates and ranks correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "c1",
        roomId: "r1",
        name: "Alice",
        track: "Web",
        studentId: "1",
        phone: "",
        email: "",
        timeslot: { start: "10:00", end: "10:30", room: "A" },
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
        track: "Web",
        studentId: "2",
        phone: "",
        email: "",
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
        id: "s1",
        candidateId: "c1",
        roomId: "r1",
        interviewerName: "I1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "tech", criterionName: "기술", score: 90, bonusPoints: 0, weight: 40 },
          {
            criterionId: "problem",
            criterionName: "문제해결",
            score: 80,
            bonusPoints: 0,
            weight: 30,
          },
          { criterionId: "comm", criterionName: "소통", score: 80, bonusPoints: 0, weight: 30 },
        ],
        totalWeightedScore: 84,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "s2",
        candidateId: "c2",
        roomId: "r1",
        interviewerName: "I1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "tech", criterionName: "기술", score: 70, bonusPoints: 0, weight: 40 },
          {
            criterionId: "problem",
            criterionName: "문제해결",
            score: 70,
            bonusPoints: 0,
            weight: 30,
          },
          { criterionId: "comm", criterionName: "소통", score: 70, bonusPoints: 0, weight: 30 },
        ],
        totalWeightedScore: 70,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, sampleCriteria, "mean");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[0].topCriteria).toContain("기술");

    const csv = toCsv(leaderboard, sampleCriteria);
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });

  test("buildLeaderboard performance benchmark", () => {
    const numCandidates = 200;
    const numSubmissionsPerCandidate = 3;
    const numCriteria = 10;

    const criteriaItems = Array.from({ length: numCriteria }, (_, i) => ({
      id: `crit_${i}`,
      name: `항목_${i}`,
      weight: 10,
      description: "",
      maxScore: 100,
    }));

    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "mean",
      passCutoff: 70,
      items: criteriaItems,
    };

    const candidates: Candidate[] = Array.from({ length: numCandidates }, (_, i) => ({
      id: `cand_${i}`,
      roomId: "r1",
      name: `Candidate ${i}`,
      track: `Track ${i % 5}`,
      studentId: `${1000 + i}`,
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < numCandidates; i++) {
      for (let j = 0; j < numSubmissionsPerCandidate; j++) {
        submissions.push({
          id: `sub_${i}_${j}`,
          candidateId: `cand_${i}`,
          roomId: "r1",
          interviewerName: `Interviewer ${j}`,
          submittedAt: "2026-01-01",
          scores: criteriaItems.map((c) => ({
            criterionId: c.id,
            criterionName: c.name,
            score: (i * 7 + j * 3) % 100,
            bonusPoints: 0,
            weight: c.weight,
          })),
          totalWeightedScore: 75,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(candidates, submissions, criteria, "mean");
    const duration = performance.now() - start;

    console.log(
      `buildLeaderboard took ${duration.toFixed(2)} ms for 200 candidates & 600 submissions.`,
    );
    expect(result.length).toBe(numCandidates);
  });
});
