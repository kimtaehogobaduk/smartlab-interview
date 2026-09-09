import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("should return true for identical strings", () => {
    expect(safeCompare("secret123!", "secret123!")).toBe(true);
  });

  it("should return false for non-matching strings", () => {
    expect(safeCompare("secret123!", "wrongcode")).toBe(false);
  });

  it("should return false for strings of different lengths", () => {
    expect(safeCompare("secret123!", "secret")).toBe(false);
  });
});
