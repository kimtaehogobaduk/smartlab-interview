import { describe, expect, it } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring functions", () => {
  const sampleCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 40, description: "", maxScore: 100 },
      { id: "problem", name: "문제 해결력", weight: 30, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 20, description: "", maxScore: 100 },
      { id: "fit", name: "태도/조직적합도", weight: 10, description: "", maxScore: 100 },
    ],
  };

  it("calculates weightedTotal correctly with bonus points capped at 10%", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // 80 + 8 = 88 * 0.4 = 35.2
      { criterionId: "problem", score: 90, bonusPoints: 5 }, // 90 + 5 = 95 * 0.3 = 28.5
      { criterionId: "comm", score: 70, bonusPoints: 0 }, // 70 * 0.2 = 14
      { criterionId: "fit", score: 100, bonusPoints: 20 }, // 100 + 10 (capped) = 110 * 0.1 = 11
    ];
    // Total = 35.2 + 28.5 + 14 + 11 = 88.7
    expect(weightedTotal(scores, sampleCriteria.items)).toBe(88.7);
  });

  it("builds leaderboard correctly and handles tie breaks and top performers", () => {
    const candidates: Candidate[] = [
      {
        id: "c1",
        name: "Alice",
        track: "Web",
        studentId: "1",
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
        id: "c2",
        name: "Bob",
        track: "Web",
        studentId: "2",
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

    // Alice: tech(40%)=90, prob(30%)=80, comm(20%)=70, fit(10%)=50 => weighted = 36 + 24 + 14 + 5 = 79
    // Bob:   tech(40%)=70, prob(30%)=80, comm(20%)=90, fit(10%)=100 => weighted = 28 + 24 + 18 + 10 = 80
    // Adjust Bob's fit so weighted score equals 79:
    // Bob:   tech(40%)=70, prob(30%)=80, comm(20%)=90, fit(10%)=90 => weighted = 28 + 24 + 18 + 9 = 79
    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "c1",
        roomId: "r1",
        interviewerName: "I1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 90, weight: 40 },
          { criterionId: "problem", criterionName: "문제 해결력", score: 80, weight: 30 },
          { criterionId: "comm", criterionName: "의사소통", score: 70, weight: 20 },
          { criterionId: "fit", criterionName: "태도/조직적합도", score: 50, weight: 10 },
        ],
        totalWeightedScore: 79,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "s2",
        candidateId: "c2",
        roomId: "r1",
        interviewerName: "I1",
        submittedAt: "2026-01-01",
        scores: [
          { criterionId: "tech", criterionName: "기술 역량", score: 70, weight: 40 },
          { criterionId: "problem", criterionName: "문제 해결력", score: 80, weight: 30 },
          { criterionId: "comm", criterionName: "의사소통", score: 90, weight: 20 },
          { criterionId: "fit", criterionName: "태도/조직적합도", score: 90, weight: 10 },
        ],
        totalWeightedScore: 79,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, sampleCriteria, "weighted");
    expect(leaderboard.length).toBe(2);
    // Both totalWeightedScore are 79, but Alice has higher tech score (90 vs 70), so Alice should rank #1
    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);

    // Alice should be top performer in tech
    expect(leaderboard[0].topCriteria).toContain("기술 역량");
    // Bob should be top performer in comm & fit
    expect(leaderboard[1].topCriteria).toContain("의사소통");
    expect(leaderboard[1].topCriteria).toContain("태도/조직적합도");
  });

  it("handles empty candidates/submissions without crashing", () => {
    const leaderboard = buildLeaderboard([], [], sampleCriteria, "trimmed");
    expect(leaderboard).toEqual([]);
  });

  it("handles a large dataset efficiently", () => {
    const candidatesCount = 200;
    const submissionsPerCandidate = 5;

    const candidates: Candidate[] = Array.from({ length: candidatesCount }, (_, i) => ({
      id: `cand-${i}`,
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Frontend" : "Backend",
      studentId: `${1000 + i}`,
      phone: "010-0000-0000",
      email: `cand${i}@test.com`,
      timeslot: { start: "14:00", end: "14:30", room: "Room A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const submissions: EvaluationSubmission[] = [];
    for (let i = 0; i < candidatesCount; i++) {
      for (let s = 0; s < submissionsPerCandidate; s++) {
        const scoreVal = (i + s * 7) % 100;
        submissions.push({
          id: `sub-${i}-${s}`,
          candidateId: `cand-${i}`,
          roomId: "room-a",
          interviewerName: `Interviewer ${s}`,
          submittedAt: new Date().toISOString(),
          scores: [
            { criterionId: "tech", criterionName: "기술 역량", score: scoreVal, weight: 40 },
            {
              criterionId: "problem",
              criterionName: "문제 해결력",
              score: (scoreVal + 5) % 100,
              weight: 30,
            },
            {
              criterionId: "comm",
              criterionName: "의사소통",
              score: (scoreVal + 10) % 100,
              weight: 20,
            },
            {
              criterionId: "fit",
              criterionName: "태도/조직적합도",
              score: (scoreVal + 15) % 100,
              weight: 10,
            },
          ],
          totalWeightedScore: scoreVal,
          qualitativeFeedback: { strengths: "", improvements: "" },
        });
      }
    }

    const start = performance.now();
    const result = buildLeaderboard(candidates, submissions, sampleCriteria, "trimmed");
    const end = performance.now();

    expect(result.length).toBe(candidatesCount);
    console.log(
      `Leaderboard built for ${candidatesCount} candidates (${submissions.length} submissions) in ${(end - start).toFixed(2)}ms`,
    );
  });
});
