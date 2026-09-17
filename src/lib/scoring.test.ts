import { describe, expect, test } from "bun:test";
import { escapeCsvCell, toCsv, type LeaderboardItem } from "./scoring";
import type { CriteriaConfig } from "./types";

describe("escapeCsvCell", () => {
  test("escapes standard strings and numbers without change", () => {
    expect(escapeCsvCell("John")).toBe("John");
    expect(escapeCsvCell(100)).toBe("100");
  });

  test("escapes commas and double quotes in fields", () => {
    expect(escapeCsvCell("Hello, World")).toBe('"Hello, World"');
    expect(escapeCsvCell('John "Jack" Doe')).toBe('"John ""Jack"" Doe"');
  });

  test("sanitizes formula injection characters (=, +, -, @, \\t, \\r)", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+12345")).toBe("'+12345");
    expect(escapeCsvCell("-12345")).toBe("'-12345");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("=CMD|' /C calc'!A1, foo")).toBe("\"'=CMD|' /C calc'!A1, foo\"");
  });
});

describe("toCsv", () => {
  test("converts leaderboard items and criteria to sanitized CSV", () => {
    const criteria: CriteriaConfig = {
      isConfirmed: true,
      formula: "weighted",
      items: [
        { id: "c1", name: "=Special, Criteria", weight: 50, description: "", maxScore: 100 },
        { id: "c2", name: "Normal", weight: 50, description: "", maxScore: 100 },
      ],
    };

    const rows: LeaderboardItem[] = [
      {
        candidateId: "cand1",
        name: "=1+1",
        track: "Web, Mobile",
        panelCount: 2,
        finalScore: 90,
        perCriterion: [
          { criterionId: "c1", name: "=Special, Criteria", average: 90 },
          { criterionId: "c2", name: "Normal", average: 90 },
        ],
        rank: 1,
        topCriteria: [],
      },
    ];

    const result = toCsv(rows, criteria);
    const lines = result.split("\n");
    expect(lines[0]).toBe(
      '순위,이름,트랙,면접관수,최종점수,"\'=Special, Criteria(50%)",Normal(50%)',
    );
    expect(lines[1]).toBe('1,\'=1+1,"Web, Mobile",2,90,90,90');
  });
});
