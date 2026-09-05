import { describe, expect, test } from "bun:test";
import { timingSafeCompare } from "./auth.functions";

describe("timingSafeCompare", () => {
  test("returns true for identical secret strings", () => {
    expect(timingSafeCompare("secret123", "secret123")).toBe(true);
    expect(timingSafeCompare("admin-pass-2026", "admin-pass-2026")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(timingSafeCompare("secret123", "secret124")).toBe(false);
    expect(timingSafeCompare("admin12345", "admin12346")).toBe(false);
  });

  test("returns false for non-matching strings of different lengths", () => {
    expect(timingSafeCompare("secret123", "secret1234")).toBe(false);
    expect(timingSafeCompare("short", "muchlongerstring")).toBe(false);
  });

  test("handles empty strings and edge cases", () => {
    expect(timingSafeCompare("", "")).toBe(true);
    expect(timingSafeCompare("a", "")).toBe(false);
    expect(timingSafeCompare("", "b")).toBe(false);
  });
});
