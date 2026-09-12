import { describe, expect, test } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true when strings match exactly", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
  });

  test("returns false when strings differ in content (same length)", () => {
    expect(safeCompare("secret123", "wrong1234")).toBe(false);
  });

  test("returns false when strings differ in length", () => {
    expect(safeCompare("secret123", "short")).toBe(false);
    expect(safeCompare("short", "secret123")).toBe(false);
  });

  test("handles empty strings correctly", () => {
    expect(safeCompare("", "")).toBe(true);
    expect(safeCompare("a", "")).toBe(false);
  });
});
