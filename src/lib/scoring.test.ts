import { describe, expect, it } from "bun:test";
import { buildLeaderboard, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 40, description: "기술 깊이", maxScore: 100 },
    { id: "problem", name: "문제 해결력", weight: 30, description: "논리적 추론", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 20, description: "경청과 피드백", maxScore: 100 },
    { id: "fit", name: "태도/조직적합도", weight: 10, description: "책임감", maxScore: 100 },
  ],
};

describe("weightedTotal", () => {
  it("calculates weighted total correctly", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 0 },
      { criterionId: "problem", score: 90, bonusPoints: 0 },
      { criterionId: "comm", score: 70, bonusPoints: 0 },
      { criterionId: "fit", score: 100, bonusPoints: 0 },
    ];
    // (80*40 + 90*30 + 70*20 + 100*10) / 100 = (3200 + 2700 + 1400 + 1000) / 100 = 83
    expect(weightedTotal(scores, mockCriteria.items)).toBe(83);
  });

  it("caps bonus points at 10% of the base score", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 20 }, // capped at 8 (80 * 0.1) -> 88
      { criterionId: "problem", score: 90, bonusPoints: 0 }, // 90
      { criterionId: "comm", score: 70, bonusPoints: 0 }, // 70
      { criterionId: "fit", score: 100, bonusPoints: 0 }, // 100
    ];
    // (88*40 + 90*30 + 70*20 + 100*10) / 100 = (3520 + 2700 + 1400 + 1000) / 100 = 86.2
    expect(weightedTotal(scores, mockCriteria.items)).toBe(86.2);
  });
});

describe("buildLeaderboard", () => {
  it("builds leaderboard and assigns correct ranks and top criteria", () => {
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
        track: "AI",
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
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 40,
          },
          {
            criterionId: "problem",
            criterionName: "문제 해결력",
            score: 80,
            bonusPoints: 0,
            weight: 30,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 20 },
          {
            criterionId: "fit",
            criterionName: "태도/조직적합도",
            score: 60,
            bonusPoints: 0,
            weight: 10,
          },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "s2",
        candidateId: "c2",
        roomId: "r1",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 70,
            bonusPoints: 0,
            weight: 40,
          },
          {
            criterionId: "problem",
            criterionName: "문제 해결력",
            score: 95,
            bonusPoints: 0,
            weight: 30,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 90, bonusPoints: 0, weight: 20 },
          {
            criterionId: "fit",
            criterionName: "태도/조직적합도",
            score: 85,
            bonusPoints: 0,
            weight: 10,
          },
        ],
        totalWeightedScore: 83,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].candidateId).toBe("c2");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c1");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("기술 역량");
  });
});
