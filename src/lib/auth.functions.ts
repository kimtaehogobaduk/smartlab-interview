import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1).max(256) });

export async function safeCompare(a: string, b: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function verifyAdminCodeHandler(code: string, expected?: string): Promise<boolean> {
  if (!expected) {
    // Fail securely without leaking server configuration details to caller
    return false;
  }
  return safeCompare(code, expected);
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .validator((data: unknown) => AdminCodeInput.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_CODE"];
    return { valid: await verifyAdminCodeHandler(data.code, expected) };
  });
