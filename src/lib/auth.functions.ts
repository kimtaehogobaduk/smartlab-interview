import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AdminCodeInput = z.object({ code: z.string().min(1) });

/**
 * Compares two secret strings in constant time using SHA-256 digests
 * to prevent timing side-channel attacks during admin authentication.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function verifyAdminCodeHandler({ data }: { data: { code: string } }) {
  const expected = process.env["ADMIN_ACCESS_CODE"];
  if (!expected) throw new Error("ADMIN_ACCESS_CODE가 설정되지 않았습니다.");
  return { valid: safeCompare(data.code, expected) };
}

export const verifyAdminCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AdminCodeInput.parse(data))
  .handler(verifyAdminCodeHandler);
