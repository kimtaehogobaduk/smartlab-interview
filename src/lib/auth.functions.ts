import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Constant-time string comparison helper to prevent timing side-channel attacks on secrets.
 */
export function safeCompare(input: string, secret: string): boolean {
  const bufInput = Buffer.from(input);
  const bufSecret = Buffer.from(secret);

  if (bufInput.length !== bufSecret.length) {
    // Perform dummy timing-safe comparison to mitigate timing leaks on length discrepancy
    timingSafeEqual(bufInput, bufInput);
    return false;
  }

  return timingSafeEqual(bufInput, bufSecret);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
    // Use timing-safe comparison to prevent secret enumeration via timing attacks
    return { valid: safeCompare(data.code, expected) };
  });
