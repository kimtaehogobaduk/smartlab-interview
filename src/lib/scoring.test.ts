import { describe, expect, it } from "bun:test";
import { aggregate, buildLeaderboard, toCsv, weightedTotal } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

describe("scoring", () => {
  const criteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "trimmed",
    passCutoff: 70,
    items: [
      { id: "tech", name: "기술 역량", weight: 60, description: "Direct tech", maxScore: 100 },
      { id: "comm", name: "의사소통", weight: 40, description: "Communication", maxScore: 100 },
    ],
  };

  it("calculates weighted total accurately including capped bonus points", () => {
    const scores = [
      { criterionId: "tech", score: 80, bonusPoints: 10 }, // bonus capped at 80*0.1 = 8 => 88
      { criterionId: "comm", score: 90, bonusPoints: 5 }, // bonus = 5 => 95
    ];
    // weighted sum = (88 * 60)/100 + (95 * 40)/100 = 52.8 + 38 = 90.8
    const total = weightedTotal(scores, criteria.items);
    expect(total).toBe(90.8);
  });

  it("aggregates values correctly for mean, median, and trimmed formulas", () => {
    const values = [50, 70, 90, 100];
    expect(aggregate(values, "mean")).toBe(77.5);
    expect(aggregate(values, "median")).toBe(80);
    expect(aggregate(values, "trimmed")).toBe(80); // trimmed removes 50 and 100 -> mean(70, 90) = 80
  });

  it("builds leaderboard correctly and handles primary tie-breaker and top criteria", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Web",
        studentId: "2026001",
        phone: "010-1111-1111",
        email: "alice@example.com",
        timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-2",
        roomId: "room-1",
        name: "Bob",
        track: "Web",
        studentId: "2026002",
        phone: "010-2222-2222",
        email: "bob@example.com",
        timeslot: { start: "10:35", end: "11:05", room: "Room 1" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        roomId: "room-1",
        candidateId: "cand-1",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 90 },
          { criterionId: "comm", score: 70 },
        ],
        totalWeightedScore: 82,
        submittedAt: new Date().toISOString(),
      },
      {
        id: "sub-2",
        roomId: "room-1",
        candidateId: "cand-2",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 70 },
          { criterionId: "comm", score: 90 },
        ],
        totalWeightedScore: 78,
        submittedAt: new Date().toISOString(),
      },
    ];

    const rows = buildLeaderboard(candidates, submissions, criteria, "mean");
    expect(rows).toHaveLength(2);

    // Tied on mean final score (80), but Alice scored higher in primary criteria "tech" (90 vs 70)
    expect(rows[0].candidateId).toBe("cand-1");
    expect(rows[0].rank).toBe(1);
    expect(rows[0].topCriteria).toContain("기술 역량");

    expect(rows[1].candidateId).toBe("cand-2");
    expect(rows[1].rank).toBe(2);
    expect(rows[1].topCriteria).toContain("의사소통");
  });

  it("exports CSV headers and values accurately", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-1",
        roomId: "room-1",
        name: "Alice",
        track: "Web",
        studentId: "2026001",
        phone: "010-1111-1111",
        email: "alice@example.com",
        timeslot: { start: "10:00", end: "10:30", room: "Room 1" },
        status: "PENDING",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    const submissions: EvaluationSubmission[] = [
      {
        id: "sub-1",
        roomId: "room-1",
        candidateId: "cand-1",
        interviewerName: "Interviewer A",
        scores: [
          { criterionId: "tech", score: 90 },
          { criterionId: "comm", score: 70 },
        ],
        totalWeightedScore: 82,
        submittedAt: new Date().toISOString(),
      },
    ];

    const rows = buildLeaderboard(candidates, submissions, criteria, "mean");
    const csv = toCsv(rows, criteria);
    expect(csv).toContain("순위,이름,트랙,면접관수,최종점수,기술 역량(60%),의사소통(40%)");
    expect(csv).toContain("1,Alice,Web,1,80,90,70");
  });
});
