import { describe, expect, it } from "bun:test";
import { checkAdminCode } from "./auth.functions";

describe("checkAdminCode", () => {
  it("returns true for matching admin code", () => {
    const isValid = checkAdminCode("secret123", "secret123");
    expect(isValid).toBe(true);
  });

  it("returns false for incorrect admin code", () => {
    const isValid = checkAdminCode("wrongcode", "secret123");
    expect(isValid).toBe(false);
  });

  it("throws error when expected admin code is missing", () => {
    expect(() => checkAdminCode("secret123", undefined)).toThrow(
      "ADMIN_ACCESS_CODE가 설정되지 않았습니다.",
    );
  });
});
