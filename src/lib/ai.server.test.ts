import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error sanitization", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "dummy-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) {
      process.env.GROQ_API_KEY = originalEnv;
    } else {
      delete process.env.GROQ_API_KEY;
    }
  });

  it("does not leak raw API response body in thrown error on 500 failure", async () => {
    const sensitiveResponseBody =
      "Internal Server Error: Secret DB credentials or stack trace leaked here";
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sensitiveResponseBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user input");
      expect.unreachable("callGatewayJson should have thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      const err = error as Error;
      expect(err.message).not.toContain("Secret DB credentials");
      expect(err.message).not.toContain("stack trace");
      expect(err.message).toBe("AI 분석에 실패했습니다. (상태 코드: 500)");
    }
  });
});
