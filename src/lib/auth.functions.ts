import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Constant-time string comparison to protect against timing side-channel attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

export function checkAdminCode(
  inputCode: string,
  expectedCode = process.env["ADMIN_ACCESS_CODE"],
): boolean {
  if (!expectedCode) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
  return timingSafeEqualString(inputCode, expectedCode);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    return { valid: checkAdminCode(data.code) };
  });
