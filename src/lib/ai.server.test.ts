import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GROQ_API_KEY: "test-key" };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("throws generic error message without leaking sensitive response body details on 500 failure", async () => {
    const sensitiveResponseBody =
      "Internal Server Error: Secret DB credentials or stack trace details here";

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sensitiveResponseBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
      "AI 분석 실패 [500]",
    );

    try {
      await callGatewayJson("system prompt", "user prompt");
    } catch (err: unknown) {
      const error = err as Error;
      expect(error.message).not.toContain("Secret DB credentials");
      expect(error.message).not.toContain("stack trace");
    }
  });
});
