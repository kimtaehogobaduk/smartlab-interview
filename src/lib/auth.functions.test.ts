import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("secret123", "secret123")).toBe(true);
  });

  it("returns false for non-matching strings of equal length", () => {
    expect(safeCompare("secret123", "secret124")).toBe(false);
  });

  it("returns false for non-matching strings of different lengths", () => {
    expect(safeCompare("secret123", "secret")).toBe(false);
  });

  it("handles edge cases safely including empty strings, unicode, and non-string inputs", () => {
    expect(safeCompare("", "")).toBe(true);
    expect(safeCompare("비밀번호123", "비밀번호123")).toBe(true);
    expect(safeCompare("비밀번호123", "비밀번호124")).toBe(false);
    expect(safeCompare(null as unknown as string, "secret")).toBe(false);
    expect(safeCompare("secret", undefined as unknown as string)).toBe(false);
  });
});
