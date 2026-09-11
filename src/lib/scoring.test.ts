import { describe, expect, it } from "bun:test";
import { buildLeaderboard } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("buildLeaderboard", () => {
  it("correctly calculates leaderboard rankings and top criteria with Map optimization", () => {
    const candidates: Candidate[] = [
      {
        id: "c1",
        roomId: "r1",
        name: "Alice",
        track: "Web",
        timeslot: { start: "10:00", end: "10:30" },
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
        timeslot: { start: "10:30", end: "11:00" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      items: [
        { id: "crit1", name: "Problem Solving", weight: 60, description: "", maxScore: 100 },
        { id: "crit2", name: "Communication", weight: 40, description: "", maxScore: 100 },
      ],
    };

    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "c1",
        interviewerId: "i1",
        interviewerName: "Interviewer 1",
        scores: [
          { criterionId: "crit1", score: 90 },
          { criterionId: "crit2", score: 80 },
        ],
        totalWeightedScore: 86,
        submittedAt: new Date().toISOString(),
      },
      {
        id: "s2",
        candidateId: "c2",
        interviewerId: "i1",
        interviewerName: "Interviewer 1",
        scores: [
          { criterionId: "crit1", score: 70 },
          { criterionId: "crit2", score: 95 },
        ],
        totalWeightedScore: 80,
        submittedAt: new Date().toISOString(),
      },
    ];

    const result = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(result).toHaveLength(2);
    expect(result[0].candidateId).toBe("c1");
    expect(result[0].rank).toBe(1);
    expect(result[0].finalScore).toBe(86);
    expect(result[0].topCriteria).toContain("Problem Solving");

    expect(result[1].candidateId).toBe("c2");
    expect(result[1].rank).toBe(2);
    expect(result[1].finalScore).toBe(80);
    expect(result[1].topCriteria).toContain("Communication");
  });
});
