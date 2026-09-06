import { describe, expect, it } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  it("returns true for matching strings", () => {
    expect(safeCompare("super-secret-admin-code", "super-secret-admin-code")).toBe(true);
  });

  it("returns false for mismatched strings of same length", () => {
    expect(safeCompare("super-secret-admin-code", "super-secret-admin-codX")).toBe(false);
  });

  it("returns false for mismatched strings of different lengths", () => {
    expect(safeCompare("wrong", "super-secret-admin-code")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });
});
