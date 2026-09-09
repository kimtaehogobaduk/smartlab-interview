import { describe, expect, test } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true for matching strings", () => {
    expect(safeCompare("secret-code-123", "secret-code-123")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret-code-123", "secret-code-124")).toBe(false);
  });

  test("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("secret", "secret-code-123")).toBe(false);
  });

  test("returns false for empty string comparison", () => {
    expect(safeCompare("", "secret")).toBe(false);
  });
});
