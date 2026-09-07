import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1).max(256) });

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // Perform timingSafeEqual against bufA itself to prevent early timing exit
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
