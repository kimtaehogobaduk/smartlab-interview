import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("secret-code-123", "secret-code-123")).toBe(true);
  });

  it("returns false for non-matching strings", () => {
    expect(safeCompare("wrong-code", "secret-code-123")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeCompare("secret", "secret-code-123")).toBe(false);
  });

  it("returns false for empty string comparison with non-empty string", () => {
    expect(safeCompare("", "secret-code-123")).toBe(false);
  });
});
