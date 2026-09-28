import { describe, expect, test } from "bun:test";
import { toCsv, type LeaderboardItem } from "./scoring";
import type { CriteriaConfig } from "./types";

describe("toCsv security and formatting", () => {
  const sampleCriteria: CriteriaConfig = {
    isConfirmed: true,
    formula: "mean",
    items: [
      { id: "c1", name: "Problem Solving", weight: 60, description: "" },
      { id: "c2", name: "=DANGEROUS_CRITERIA", weight: 40, description: "" },
    ],
  };

  test("sanitizes CSV formula injection triggers (=, +, -, @, \\t, \\r)", () => {
    const rows: LeaderboardItem[] = [
      {
        candidateId: "cand-1",
        name: "=SUM(A1:A10)",
        track: "+12345",
        panelCount: 2,
        finalScore: 90,
        perCriterion: [
          { criterionId: "c1", name: "Problem Solving", average: 90 },
          { criterionId: "c2", name: "=DANGEROUS_CRITERIA", average: 90 },
        ],
        rank: 1,
        topCriteria: [],
      },
      {
        candidateId: "cand-2",
        name: "@attacker",
        track: "-minusTrack",
        panelCount: 1,
        finalScore: 80,
        perCriterion: [
          { criterionId: "c1", name: "Problem Solving", average: 80 },
          { criterionId: "c2", name: "=DANGEROUS_CRITERIA", average: 80 },
        ],
        rank: 2,
        topCriteria: [],
      },
    ];

    const csv = toCsv(rows, sampleCriteria);
    const lines = csv.split("\n");

    // Check header sanitization
    expect(lines[0]).toContain("'=DANGEROUS_CRITERIA(40%)");

    // Check row 1 sanitization
    expect(lines[1]).toContain("'=SUM(A1:A10)");
    expect(lines[1]).toContain("'+12345");

    // Check row 2 sanitization
    expect(lines[2]).toContain("'@attacker");
    expect(lines[2]).toContain("'-minusTrack");
  });

  test("escapes double quotes and commas in cells", () => {
    const rows: LeaderboardItem[] = [
      {
        candidateId: "cand-3",
        name: 'John "The Boss" Doe',
        track: "Frontend, UX & Design",
        panelCount: 3,
        finalScore: 95,
        perCriterion: [
          { criterionId: "c1", name: "Problem Solving", average: 95 },
          { criterionId: "c2", name: "=DANGEROUS_CRITERIA", average: 95 },
        ],
        rank: 1,
        topCriteria: [],
      },
    ];

    const csv = toCsv(rows, sampleCriteria);
    const lines = csv.split("\n");

    expect(lines[1]).toContain('"John ""The Boss"" Doe"');
    expect(lines[1]).toContain('"Frontend, UX & Design"');
  });
});
