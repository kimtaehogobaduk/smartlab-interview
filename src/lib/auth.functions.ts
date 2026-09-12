import { timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

// Security: Use constant-time comparison to prevent timing attacks on access code verification
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform dummy timingSafeEqual comparison to keep execution time consistent
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
    return { valid: safeCompare(data.code, expected) };
  });
