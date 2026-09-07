import { describe, expect, test } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true for matching strings", () => {
    expect(safeCompare("secret-code-123", "secret-code-123")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret-code-123", "secret-code-456")).toBe(false);
  });

  test("returns false for strings of different lengths", () => {
    expect(safeCompare("secret-code-123", "secret")).toBe(false);
    expect(safeCompare("short", "longer-string")).toBe(false);
  });

  test("returns false for empty vs non-empty strings", () => {
    expect(safeCompare("", "secret")).toBe(false);
  });

  test("returns true for empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });
});
