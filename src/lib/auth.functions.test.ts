import { describe, expect, it } from "bun:test";
import { checkAdminCode, timingSafeEqualString } from "./auth.functions";

describe("timingSafeEqualString", () => {
  it("should return true for identical strings", () => {
    expect(timingSafeEqualString("secret123", "secret123")).toBe(true);
  });

  it("should return false for different strings of same length", () => {
    expect(timingSafeEqualString("secret123", "secret124")).toBe(false);
  });

  it("should return false for strings of different lengths", () => {
    expect(timingSafeEqualString("secret123", "secret1234")).toBe(false);
  });
});

describe("checkAdminCode", () => {
  it("should return true when code matches expected code", () => {
    expect(checkAdminCode("secret123", "secret123")).toBe(true);
  });

  it("should return false when code does not match expected code", () => {
    expect(checkAdminCode("wrongcode", "secret123")).toBe(false);
  });

  it("should throw error when expected code is empty or missing", () => {
    expect(() => checkAdminCode("secret123", undefined)).toThrow(
      "ADMIN_ACCESS_CODE가 설정되지 않았습니다.",
    );
  });
});
