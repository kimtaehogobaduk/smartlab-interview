import { describe, expect, test } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true for identical strings", () => {
    expect(safeCompare("secret-code-123", "secret-code-123")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(safeCompare("secret-code-123", "secret-code-124")).toBe(false);
  });

  test("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("secret-code-123", "secret-code-1234")).toBe(false);
    expect(safeCompare("secret", "secret-code-123")).toBe(false);
  });

  test("handles empty or special unicode characters", () => {
    expect(safeCompare("비밀번호123", "비밀번호123")).toBe(true);
    expect(safeCompare("비밀번호123", "비밀번호124")).toBe(false);
  });
});
