import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { checkAdminCode } from "./auth.functions";

describe("checkAdminCode", () => {
  const originalEnv = process.env["ADMIN_ACCESS_CODE"];

  beforeEach(() => {
    process.env["ADMIN_ACCESS_CODE"] = "secret123";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["ADMIN_ACCESS_CODE"] = originalEnv;
    } else {
      delete process.env["ADMIN_ACCESS_CODE"];
    }
  });

  it("returns true when admin code matches exactly", () => {
    expect(checkAdminCode("secret123")).toBe(true);
  });

  it("returns false when admin code does not match", () => {
    expect(checkAdminCode("wrongcode")).toBe(false);
  });

  it("returns false when code length differs from expected", () => {
    expect(checkAdminCode("secret12345")).toBe(false);
  });

  it("throws error when ADMIN_ACCESS_CODE environment variable is missing", () => {
    delete process.env["ADMIN_ACCESS_CODE"];
    expect(() => checkAdminCode("secret123")).toThrow("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
  });
});
