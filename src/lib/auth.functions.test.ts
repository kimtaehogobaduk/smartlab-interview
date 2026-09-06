import { describe, expect, test } from "vitest";
import { checkAdminCode } from "./auth.functions";

describe("checkAdminCode", () => {
  const secret = "secret_admin_code_123";

  test("returns true when admin code matches exactly", () => {
    expect(checkAdminCode("secret_admin_code_123", secret)).toBe(true);
  });

  test("returns false when admin code is wrong (same length)", () => {
    expect(checkAdminCode("secret_admin_code_124", secret)).toBe(false);
  });

  test("returns false when admin code is wrong (different length)", () => {
    expect(checkAdminCode("wrong", secret)).toBe(false);
  });

  test("returns false when admin code is empty", () => {
    expect(checkAdminCode("", secret)).toBe(false);
  });
});
