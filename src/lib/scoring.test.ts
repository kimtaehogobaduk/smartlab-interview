import { describe, expect, test } from "bun:test";
import { buildLeaderboard, weightedTotal, aggregate } from "./scoring";
import type { Candidate, CriteriaConfig, EvaluationSubmission } from "./types";

const mockCriteria: CriteriaConfig = {
  isConfirmed: true,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    { id: "c1", name: "Tech", weight: 40, description: "", maxScore: 100 },
    { id: "c2", name: "Problem Solving", weight: 30, description: "", maxScore: 100 },
    { id: "c3", name: "Communication", weight: 20, description: "", maxScore: 100 },
    { id: "c4", name: "Fit", weight: 10, description: "", maxScore: 100 },
  ],
};

function generateTestData(numCandidates: number, subsPerCandidate: number) {
  const candidates: Candidate[] = [];
  const submissions: EvaluationSubmission[] = [];

  for (let i = 0; i < numCandidates; i++) {
    const candidateId = `cand-${i}`;
    candidates.push({
      id: candidateId,
      roomId: "room-1",
      name: `Candidate ${i}`,
      track: i % 2 === 0 ? "Frontend" : "Backend",
      studentId: `2026${i}`,
      phone: "010-0000-0000",
      email: `cand${i}@example.com`,
      timeslot: { start: "10:00", end: "10:30", room: "A" },
      status: "COMPLETED",
      documents: [],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    });

    for (let s = 0; s < subsPerCandidate; s++) {
      submissions.push({
        id: `eval-${i}-${s}`,
        candidateId,
        roomId: "room-1",
        interviewerName: `Interviewer ${s}`,
        submittedAt: new Date().toISOString(),
        scores: mockCriteria.items.map((item, idx) => ({
          criterionId: item.id,
          criterionName: item.name,
          score: 70 + ((i + s + idx) % 30),
          bonusPoints: (s + idx) % 3,
          weight: item.weight,
        })),
        totalWeightedScore: 70 + ((i * 3 + s * 2) % 25),
        qualitativeFeedback: { strengths: "", improvements: "" },
      });
    }
  }

  return { candidates, submissions };
}

describe("scoring", () => {
  test("weightedTotal calculates weighted score correctly", () => {
    const scores = [
      { criterionId: "c1", score: 80, bonusPoints: 5 }, // 80 + min(5, 8) = 85 -> 85 * 0.4 = 34
      { criterionId: "c2", score: 90, bonusPoints: 0 }, // 90 * 0.3 = 27
      { criterionId: "c3", score: 70 }, // 70 * 0.2 = 14
      { criterionId: "c4", score: 60 }, // 60 * 0.1 = 6
    ];
    // Total = 34 + 27 + 14 + 6 = 81
    expect(weightedTotal(scores, mockCriteria.items)).toBe(81);
  });

  test("buildLeaderboard ranks candidates correctly and calculates averages", () => {
    const { candidates, submissions } = generateTestData(10, 3);
    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");

    expect(leaderboard.length).toBe(10);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[9].rank).toBe(10);

    // Verify ranks are strictly ordered by finalScore desc
    for (let i = 0; i < leaderboard.length - 1; i++) {
      expect(leaderboard[i].finalScore).toBeGreaterThanOrEqual(leaderboard[i + 1].finalScore);
    }
  });

  test("buildLeaderboard breaks ties using primary criterion with highest weight", () => {
    const candidates: Candidate[] = [
      {
        id: "cand-a",
        roomId: "room-1",
        name: "Alice",
        track: "Web",
        studentId: "1",
        phone: "",
        email: "",
        timeslot: { start: "", end: "", room: "" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
      {
        id: "cand-b",
        roomId: "room-1",
        name: "Bob",
        track: "Web",
        studentId: "2",
        phone: "",
        email: "",
        timeslot: { start: "", end: "", room: "" },
        status: "COMPLETED",
        documents: [],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      },
    ];

    // Both candidates have identical finalScore = 80
    // Primary criterion 'c1' (Tech, weight 40): Alice scores 90, Bob scores 80
    const submissions: EvaluationSubmission[] = [
      {
        id: "s1",
        candidateId: "cand-a",
        roomId: "room-1",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "c1", criterionName: "Tech", score: 90, bonusPoints: 0, weight: 40 },
          {
            criterionId: "c2",
            criterionName: "Problem Solving",
            score: 70,
            bonusPoints: 0,
            weight: 30,
          },
          {
            criterionId: "c3",
            criterionName: "Communication",
            score: 80,
            bonusPoints: 0,
            weight: 20,
          },
          { criterionId: "c4", criterionName: "Fit", score: 80, bonusPoints: 0, weight: 10 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
      {
        id: "s2",
        candidateId: "cand-b",
        roomId: "room-1",
        interviewerName: "I1",
        submittedAt: "",
        scores: [
          { criterionId: "c1", criterionName: "Tech", score: 80, bonusPoints: 0, weight: 40 },
          {
            criterionId: "c2",
            criterionName: "Problem Solving",
            score: 90,
            bonusPoints: 0,
            weight: 30,
          },
          {
            criterionId: "c3",
            criterionName: "Communication",
            score: 80,
            bonusPoints: 0,
            weight: 20,
          },
          { criterionId: "c4", criterionName: "Fit", score: 80, bonusPoints: 0, weight: 10 },
        ],
        totalWeightedScore: 80,
        qualitativeFeedback: { strengths: "", improvements: "" },
      },
    ];

    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "weighted");
    expect(leaderboard[0].candidateId).toBe("cand-a"); // Alice wins tie due to higher Tech score
    expect(leaderboard[1].candidateId).toBe("cand-b");
  });

  test("buildLeaderboard performance with larger dataset", () => {
    const { candidates, submissions } = generateTestData(100, 5);
    const start = performance.now();
    const leaderboard = buildLeaderboard(candidates, submissions, mockCriteria, "trimmed");
    const duration = performance.now() - start;

    expect(leaderboard.length).toBe(100);
    console.log(`buildLeaderboard (100 candidates, 500 submissions): ${duration.toFixed(2)}ms`);
  });
});
