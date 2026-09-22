import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate, toCsv } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "mean",
  passCutoff: 70,
  items: [
    { id: "tech", name: "기술 역량", weight: 50, description: "", maxScore: 100 },
    { id: "comm", name: "의사소통", weight: 30, description: "", maxScore: 100 },
    { id: "fit", name: "조직적합도", weight: 20, description: "", maxScore: 100 },
  ],
};

const mockCandidates: Candidate[] = [
  {
    id: "c1",
    roomId: "r1",
    name: "Alice",
    track: "Dev",
    studentId: "1",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
    status: "PENDING",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
  {
    id: "c2",
    roomId: "r1",
    name: "Bob",
    track: "Dev",
    studentId: "2",
    phone: "",
    email: "",
    timeslot: { start: "", end: "", room: "" },
    status: "PENDING",
    documents: [],
    sttTranscript: [],
    aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
    mindMap: [],
  },
];

const mockSubmissions: EvaluationSubmission[] = [
  {
    id: "s1",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Iv1",
    scores: [
      { criterionId: "tech", score: 80, bonusPoints: 5 }, // 80 + 5 = 85
      { criterionId: "comm", score: 90 }, // 90
      { criterionId: "fit", score: 70 }, // 70
    ],
    totalWeightedScore: 83.5,
    submittedAt: "2026-01-01",
  },
  {
    id: "s2",
    candidateId: "c1",
    roomId: "r1",
    interviewerName: "Iv2",
    scores: [
      { criterionId: "tech", score: 90 }, // 90
      { criterionId: "comm", score: 80 }, // 80
      { criterionId: "fit", score: 80 }, // 80
    ],
    totalWeightedScore: 85,
    submittedAt: "2026-01-01",
  },
  {
    id: "s3",
    candidateId: "c2",
    roomId: "r1",
    interviewerName: "Iv1",
    scores: [
      { criterionId: "tech", score: 95 }, // 95
      { criterionId: "comm", score: 70 }, // 70
      { criterionId: "fit", score: 60 }, // 60
    ],
    totalWeightedScore: 80.5,
    submittedAt: "2026-01-01",
  },
];

describe("scoring logic", () => {
  test("weightedTotal calculates score with capped bonus points", () => {
    const score = weightedTotal(
      [
        { criterionId: "tech", score: 80, bonusPoints: 15 }, // bonus max 80 * 0.1 = 8 -> 88 * 0.5 = 44
        { criterionId: "comm", score: 100 }, // 100 * 0.3 = 30
      ],
      mockCriteria.items,
    );
    expect(score).toBe(74);
  });

  test("buildLeaderboard computes ranks and top criteria correctly", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    expect(leaderboard.length).toBe(2);

    expect(leaderboard[0].candidateId).toBe("c1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].candidateId).toBe("c2");
    expect(leaderboard[1].rank).toBe(2);

    // Check topCriteria
    expect(leaderboard[0].topCriteria).toContain("의사소통");
    expect(leaderboard[0].topCriteria).toContain("조직적합도");
    expect(leaderboard[1].topCriteria).toContain("기술 역량");
  });

  test("toCsv converts leaderboard to CSV string", () => {
    const leaderboard = buildLeaderboard(mockCandidates, mockSubmissions, mockCriteria, "mean");
    const csv = toCsv(leaderboard, mockCriteria);
    expect(csv).toContain(
      "순위,이름,트랙,면접관수,최종점수,기술 역량(50%),의사소통(30%),조직적합도(20%)",
    );
    expect(csv).toContain("Alice");
    expect(csv).toContain("Bob");
  });

  test("benchmark buildLeaderboard with large data set", () => {
    const numCandidates = 300;
    const numInterviewers = 5;
    const numCriteria = 10;

    const testCriteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "trimmed",
      passCutoff: 70,
      items: Array.from({ length: numCriteria }, (_, i) => ({
        id: `crit_${i}`,
        name: `Criterion ${i}`,
        weight: 10,
        description: "",
        maxScore: 100,
      })),
    };

    const testCandidates: Candidate[] = Array.from({ length: numCandidates }, (_, i) => ({
      id: `cand_${i}`,
      roomId: "room1",
      name: `Candidate ${i}`,
      track: "Track",
      studentId: `${1000 + i}`,
      phone: "",
      email: "",
      timeslot: { start: "", end: "", room: "" },
      status: "PENDING",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    }));

    const testSubmissions: EvaluationSubmission[] = [];
    for (let i = 0; i < numCandidates; i++) {
      for (let j = 0; j < numInterviewers; j++) {
        testSubmissions.push({
          id: `sub_${i}_${j}`,
          candidateId: `cand_${i}`,
          roomId: "room1",
          interviewerName: `Interviewer ${j}`,
          scores: testCriteria.items.map((crit) => ({
            criterionId: crit.id,
            score: 50 + ((i + j) % 50),
            bonusPoints: (i + j) % 5,
          })),
          totalWeightedScore: 70,
          submittedAt: "2026-01-01",
        });
      }
    }

    const start = performance.now();
    for (let k = 0; k < 10; k++) {
      buildLeaderboard(testCandidates, testSubmissions, testCriteria, "trimmed");
    }
    const duration = performance.now() - start;
    console.log(`[Benchmark] 10 iterations of buildLeaderboard: ${duration.toFixed(2)} ms`);
    expect(duration).toBeGreaterThan(0);
  });
});
