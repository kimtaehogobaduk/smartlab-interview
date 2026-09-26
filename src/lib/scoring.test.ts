import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission, Formula } from "./types";

describe("scoring", () => {
  test("weightedTotal calculates weighted average with bonus points correctly", () => {
    const items = [
      { id: "c1", name: "Problem Solving", weight: 60, maxScore: 100, description: "" },
      { id: "c2", name: "Communication", weight: 40, maxScore: 100, description: "" },
    ];
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + 5 = 85 -> 85 * 0.6 = 51
      { criterionId: "c2", score: 90, bonusPoints: 15 }, // bonus capped at 10% of score (9) -> 90 + 9 = 99 -> 99 * 0.4 = 39.6
    ]; // total = 51 + 39.6 = 90.6
    expect(weightedTotal(scores, items)).toBe(90.6);
  });

  test("aggregate formula calculations", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([80, 90, 100], "median")).toBe(90);
    expect(aggregate([10, 80, 90, 100, 200], "trimmed")).toBe(90); // mean of [80, 90, 100]
  });

  test("buildLeaderboard computes rankings and top criteria correctly", () => {
    const candidates: Candidate[] = [
      {
        id: "cand1",
        roomId: "room1",
        name: "Alice",
        track: "Web",
        studentId: "101",
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
        id: "cand2",
        roomId: "room1",
        name: "Bob",
        track: "Web",
        studentId: "102",
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

    const criteria: CriteriaConfig = {
      formula: "weighted",
      isConfirmed: true,
      items: [
        { id: "c1", name: "Coding", weight: 70, maxScore: 100, description: "" },
        { id: "c2", name: "Soft Skills", weight: 30, maxScore: 100, description: "" },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub1",
        candidateId: "cand1",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-03-31T00:00:00Z",
        scores: [
          { criterionId: "c1", criterionName: "Coding", score: 90, bonusPoints: 0, weight: 70 },
          {
            criterionId: "c2",
            criterionName: "Soft Skills",
            score: 80,
            bonusPoints: 0,
            weight: 30,
          },
        ],
        totalWeightedScore: 87,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub2",
        candidateId: "cand2",
        roomId: "room1",
        interviewerName: "Interviewer 1",
        submittedAt: "2026-03-31T00:00:00Z",
        scores: [
          { criterionId: "c1", criterionName: "Coding", score: 70, bonusPoints: 0, weight: 70 },
          {
            criterionId: "c2",
            criterionName: "Soft Skills",
            score: 95,
            bonusPoints: 0,
            weight: 30,
          },
        ],
        totalWeightedScore: 77.5,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].candidateId).toBe("cand1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].finalScore).toBe(87);
    expect(leaderboard[0].topCriteria).toContain("Coding");

    expect(leaderboard[1].candidateId).toBe("cand2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].finalScore).toBe(77.5);
    expect(leaderboard[1].topCriteria).toContain("Soft Skills");
  });

  test("buildLeaderboard benchmark scale test", () => {
    const numCandidates = 200;
    const numSubmissionsPerCandidate = 5;
    const numCriteria = 10;

    const criteriaItems = Array.from({ length: numCriteria }, (_, i) => ({
      id: `crit_${i}`,
      name: `Criterion ${i}`,
      weight: 100 / numCriteria,
      maxScore: 100,
      description: "",
    }));

    const criteria: CriteriaConfig = {
      formula: "weighted",
      isConfirmed: true,
      items: criteriaItems,
    };

    const candidates: Candidate[] = Array.from({ length: numCandidates }, (_, i) => ({
      id: `cand_${i}`,
      roomId: "room1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Frontend" : "Backend",
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
    for (const cand of candidates) {
      for (let s = 0; s < numSubmissionsPerCandidate; s++) {
        const scores = criteriaItems.map((item, idx) => ({
          criterionId: item.id,
          criterionName: item.name,
          score: 60 + ((cand.id.length * 13 + s * 7 + idx * 3) % 40),
          bonusPoints: s % 2 === 0 ? 2 : 0,
          weight: item.weight,
        }));
        submissions.push({
          id: `sub_${cand.id}_${s}`,
          candidateId: cand.id,
          roomId: "room1",
          interviewerName: `Interviewer ${s}`,
          submittedAt: "2026-03-31T00:00:00Z",
          scores,
          totalWeightedScore: 75,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const start = performance.now();
    const runs = 10;
    for (let i = 0; i < runs; i++) {
      buildLeaderboard(candidates, submissions, criteria, "weighted");
    }
    const duration = (performance.now() - start) / runs;
    console.log(`[BENCHMARK] buildLeaderboard average execution time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeGreaterThan(0);
  });
});
