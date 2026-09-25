import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson security error sanitization", () => {
  const originalEnvKey = process.env["GROQ_API_KEY"];
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "mock-api-key";
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    process.env["GROQ_API_KEY"] = originalEnvKey;
    globalThis.fetch = originalFetch;
  });

  it("throws sanitized error without leaking sensitive response body on 500 status", async () => {
    const sensitiveResponseBody = JSON.stringify({
      error: {
        message: "Internal Secret Key or Stack Trace Exposed: sk_live_secret123456789",
        code: "internal_failure",
      },
    });

    globalThis.fetch = (async () =>
      new Response(sensitiveResponseBody, {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })) as typeof globalThis.fetch;

    try {
      await callGatewayJson("system prompt", "user prompt");
      expect().fail("Should have thrown an error");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      const errorMsg = (err as Error).message;
      expect(errorMsg).not.toContain("sk_live_secret123456789");
      expect(errorMsg).not.toContain("Internal Secret Key");
      expect(errorMsg).toBe("AI 서비스 연동 중 오류가 발생했습니다. (상태 코드: 500)");
    }
  });
});
