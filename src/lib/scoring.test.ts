import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, weightedTotal, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "c1", name: "기술", weight: 60, maxScore: 100 },
      { id: "c2", name: "인성", weight: 40, maxScore: 100 },
    ],
  };

  const candidates: Candidate[] = [
    {
      id: "cand-1",
      roomId: "room-1",
      name: "Cand 1",
      track: "웹",
      studentId: "1001",
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "cand-2",
      roomId: "room-1",
      name: "Cand 2",
      track: "웹",
      studentId: "1002",
      phone: "",
      email: "",
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
      id: "sub-1",
      candidateId: "cand-1",
      roomId: "room-1",
      interviewerName: "P1",
      scores: [
        { criterionId: "c1", score: 80, bonusPoints: 5 },
        { criterionId: "c2", score: 90 },
      ],
      comment: "",
      totalWeightedScore: 88,
      submittedAt: new Date().toISOString(),
    },
    {
      id: "sub-2",
      candidateId: "cand-2",
      roomId: "room-1",
      interviewerName: "P1",
      scores: [
        { criterionId: "c1", score: 70 },
        { criterionId: "c2", score: 80 },
      ],
      comment: "",
      totalWeightedScore: 74,
      submittedAt: new Date().toISOString(),
    },
  ];

  it("weightedTotal calculates score with bonus cap", () => {
    const score = weightedTotal(submissions[0].scores, criteria.items);
    expect(score).toBe(87);
  });

  it("aggregate calculates mean, median, trimmed", () => {
    expect(aggregate([10, 20, 30], "mean")).toBe(20);
    expect(aggregate([10, 20, 30], "median")).toBe(20);
    expect(aggregate([10, 20, 30, 40, 50], "trimmed")).toBe(30);
  });

  it("buildLeaderboard builds and ranks candidates correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
  });

  it("toCsv formats leaderboard rows correctly", () => {
    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "trimmed");
    const csv = toCsv(leaderboard, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술(60%),인성(40%)");
    expect(csv).toContain("1,Cand 1,웹,1,88,85,90");
  });

  it("benchmark buildLeaderboard with large dataset", () => {
    const largeCriteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "trimmed",
      passCutoff: 70,
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `crit-${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        maxScore: 100,
      })),
    };

    const largeCandidates: Candidate[] = Array.from({ length: 150 }, (_, i) => ({
      id: `cand-${i}`,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: "웹",
      studentId: `${1000 + i}`,
      phone: "",
      email: "",
      timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const largeSubmissions: EvaluationSubmission[] = [];
    for (const cand of largeCandidates) {
      for (let p = 0; p < 5; p++) {
        largeSubmissions.push({
          id: `sub-${cand.id}-${p}`,
          candidateId: cand.id,
          roomId: "room-1",
          interviewerName: `Panel ${p}`,
          scores: largeCriteria.items.map((c, ci) => ({
            criterionId: c.id,
            score: 50 + ((ci * 7 + p * 3) % 50),
            bonusPoints: ci % 2 === 0 ? 2 : 0,
          })),
          comment: "",
          totalWeightedScore: 70,
          submittedAt: new Date().toISOString(),
        });
      }
    }

    const start = performance.now();
    for (let run = 0; run < 50; run++) {
      buildLeaderboard(largeCandidates, largeSubmissions, largeCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(`Time taken for 50 runs of buildLeaderboard: ${duration.toFixed(2)}ms`);
    expect(duration).toBeGreaterThan(0);
  });
});
