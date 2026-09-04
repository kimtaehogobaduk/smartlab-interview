import { describe, expect, test } from "bun:test";
import { safeCompare } from "./auth.functions";

describe("safeCompare", () => {
  test("returns true for matching strings", () => {
    expect(safeCompare("admin123", "admin123")).toBe(true);
    expect(safeCompare("secret_key_99!", "secret_key_99!")).toBe(true);
  });

  test("returns false for non-matching strings of same length", () => {
    expect(safeCompare("admin123", "admin124")).toBe(false);
    expect(safeCompare("aaaa", "bbbb")).toBe(false);
  });

  test("returns false for strings of different lengths", () => {
    expect(safeCompare("admin", "admin123")).toBe(false);
    expect(safeCompare("admin123", "admin")).toBe(false);
    expect(safeCompare("", "a")).toBe(false);
  });

  test("handles multi-byte unicode characters correctly", () => {
    expect(safeCompare("비밀번호123", "비밀번호123")).toBe(true);
    expect(safeCompare("비밀번호123", "비밀번호124")).toBe(false);
  });
});
