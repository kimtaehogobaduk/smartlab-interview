import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error sanitization", () => {
  const originalEnvKey = process.env["GROQ_API_KEY"];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "test-api-key";
  });

  afterEach(() => {
    process.env["GROQ_API_KEY"] = originalEnvKey;
    globalThis.fetch = originalFetch;
  });

  it("does not leak raw response body when API fails with 500 error", async () => {
    const sensitiveResponseBody =
      "Internal Server Error: Secret DB credentials or stack trace exposed!";
    globalThis.fetch = mock(async () => {
      return new Response(sensitiveResponseBody, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }) as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user prompt");
      expect.unreachable("callGatewayJson should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const err = error as Error;
      expect(err.message).not.toContain("Secret DB credentials");
      expect(err.message).toContain("AI 분석 실패 [500]: AI 분석 중 오류가 발생했습니다.");
    }
  });

  it("handles 429 rate limit error securely", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Too Many Requests", { status: 429 });
    }) as typeof fetch;

    expect(callGatewayJson("system", "user")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
