import { describe, expect, test } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "weighted",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 60, description: "", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 40, description: "", maxScore: 100 },
    ],
  };

  test("weightedTotal correctly computes weighted score with capped bonus points", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // bonus capped at 80 * 0.1 = 8 => total score 88
      { criterionId: "comm", score: 90, bonusPoints: 2 }, // bonus 2 => total score 92
    ];

    // (88 * 60 / 100) + (92 * 40 / 100) = 52.8 + 36.8 = 89.6
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(89.6);
  });

  test("weightedTotal handles missing criterion score gracefully as 0", () => {
    const scores = [{ criterionId: "tech", score: 100 }];
    // (100 * 60 / 100) + 0 = 60
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(60);
  });

  test("aggregate calculates mean, median, and trimmed values accurately", () => {
    expect(aggregate([80, 90, 100], "mean")).toBe(90);
    expect(aggregate([10, 20, 100], "median")).toBe(20);
    expect(aggregate([0, 80, 90, 100], "trimmed")).toBe(85); // trimmed drops min (0) & max (100) -> mean(80, 90) = 85
  });

  test("buildLeaderboard sorts candidates, breaks ties on primary criterion, and identifies top criteria", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-a",
        name: "Alice",
        track: "Web",
        studentId: "1001",
        phone: "",
        email: "",
        timeslot: { start: "14:00", end: "14:30", room: "A" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-2",
        roomId: "room-a",
        name: "Bob",
        track: "AI",
        studentId: "1002",
        phone: "",
        email: "",
        timeslot: { start: "14:30", end: "15:00", room: "A" },
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
        roomId: "room-a",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82, // (90*0.6) + (70*0.4) = 54 + 28 = 82
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "sub-2",
        candidateId: "cand-2",
        roomId: "room-a",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 70,
            bonusPoints: 0,
            weight: 60,
          },
          {
            criterionId: "comm",
            criterionName: "의사소통",
            score: 100,
            bonusPoints: 0,
            weight: 40,
          },
        ],
        totalWeightedScore: 82, // (70*0.6) + (100*0.4) = 42 + 40 = 82
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, criteria, "weighted");

    expect(leaderboard).toHaveLength(2);
    // Both have finalScore = 82. Primary criterion is 'tech' (weight 60%).
    // Alice has tech score 90, Bob has tech score 70.
    // So Alice ranks #1, Bob ranks #2.
    expect(leaderboard[0].candidateId).toBe("cand-1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].topCriteria).toContain("기술 역량");

    expect(leaderboard[1].candidateId).toBe("cand-2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].topCriteria).toContain("의사소통");
  });

  test("toCsv generates correctly structured CSV output", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-a",
        name: "Alice",
        track: "Web",
        studentId: "1001",
        phone: "",
        email: "",
        timeslot: { start: "14:00", end: "14:30", room: "A" },
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
        roomId: "room-a",
        interviewerName: "Interviewer 1",
        submittedAt: new Date().toISOString(),
        scores: [
          {
            criterionId: "tech",
            criterionName: "기술 역량",
            score: 90,
            bonusPoints: 0,
            weight: 60,
          },
          { criterionId: "comm", criterionName: "의사소통", score: 70, bonusPoints: 0, weight: 40 },
        ],
        totalWeightedScore: 82,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const rows = buildLeaderboard(candidates, submissions, criteria, "weighted");
    const csv = toCsv(rows, criteria);

    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,Web,1,82,90,70");
  });
});
