import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function checkAdminCode(code: string): boolean {
  const expected = process.env["ADMIN_ACCESS_CODE"];
  if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");

  // Security enhancement: Use constant-time comparison to prevent timing attacks
  const bufA = Buffer.from(code);
  const bufB = Buffer.from(expected);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

const AdminCodeInput = z.object({ code: z.string().min(1) });

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    return { valid: checkAdminCode(data.code) };
  });
