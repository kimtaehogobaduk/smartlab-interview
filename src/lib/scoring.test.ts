import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring logic", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    passCutoff: 70,
    items: [
      { id: "c1", name: "Problem Solving", weight: 50, description: "", maxScore: 100 },
      { id: "c2", name: "Communication", weight: 30, description: "", maxScore: 100 },
      { id: "c3", name: "Culture Fit", weight: 20, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal correctly calculates weighted score with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "c2", score: 90, bonusPoints: 15 }, // bonus capped at 90*0.1=9 -> 90 + 9 = 99
      { criterionId: "c3", score: 70, bonusPoints: 0 }, // 70
    ];

    // total = (85 * 50 / 100) + (99 * 30 / 100) + (70 * 20 / 100)
    // = 42.5 + 29.7 + 14 = 86.2
    const result = weightedTotal(scores, criteria.items);
    expect(result).toBe(86.2);
  });

  test("buildLeaderboard aggregates scores and determines ranks correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Frontend",
        studentId: "101",
        phone: "010-1",
        email: "a@a.com",
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
        studentId: "102",
        phone: "010-2",
        email: "b@b.com",
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
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "c1",
            criterionName: "Problem Solving",
            score: 90,
            bonusPoints: 0,
            weight: 50,
          },
          {
            criterionId: "c2",
            criterionName: "Communication",
            score: 80,
            bonusPoints: 0,
            weight: 30,
          },
          {
            criterionId: "c3",
            criterionName: "Culture Fit",
            score: 70,
            bonusPoints: 0,
            weight: 20,
          },
        ],
        totalWeightedScore: 83,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub2",
        candidateId: "cand2",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "c1",
            criterionName: "Problem Solving",
            score: 60,
            bonusPoints: 0,
            weight: 50,
          },
          {
            criterionId: "c2",
            criterionName: "Communication",
            score: 70,
            bonusPoints: 0,
            weight: 30,
          },
          {
            criterionId: "c3",
            criterionName: "Culture Fit",
            score: 80,
            bonusPoints: 0,
            weight: 20,
          },
        ],
        totalWeightedScore: 67,
        qualitativeFeedback: { strengths: "", improvements: "" },
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

  test("buildLeaderboard performance with larger dataset", () => {
    const largeCandidates: Candidate[] = Array.from({ length: 100 }, (_, i) => ({
      id: `cand_${i}`,
      roomId: "room1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Frontend" : "Backend",
      studentId: `${20260000 + i}`,
      phone: "010-0000-0000",
      email: `user${i}@example.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const largeSubmissions: EvaluationSubmission[] = [];
    for (const c of largeCandidates) {
      for (let panel = 1; panel <= 3; panel++) {
        largeSubmissions.push({
          id: `sub_${c.id}_${panel}`,
          candidateId: c.id,
          roomId: "room1",
          interviewerName: `Panel ${panel}`,
          submittedAt: new Date().toISOString(),
          scores: criteria.items.map((item) => ({
            criterionId: item.id,
            criterionName: item.name,
            score: Math.floor(Math.random() * 40) + 60,
            bonusPoints: Math.floor(Math.random() * 5),
            weight: item.weight,
          })),
          totalWeightedScore: 75,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(largeCandidates, largeSubmissions, criteria, "trimmed");
    const elapsed = performance.now() - start;

    expect(result.length).toBe(100);
    console.log(
      `buildLeaderboard elapsed time for 100 candidates / 300 submissions: ${elapsed.toFixed(2)}ms`,
    );
  });
});
