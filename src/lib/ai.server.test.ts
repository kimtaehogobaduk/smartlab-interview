import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error sanitization", () => {
  const originalEnv = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("does not leak raw error body in exception message on 500 error", async () => {
    const sensitiveBody = JSON.stringify({
      error: {
        message: "Internal server error with sensitive token: secret_token_123",
        code: "internal_error",
      },
    });

    globalThis.fetch = mock(async () => {
      return new Response(sensitiveBody, {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
      "AI 분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("handles 429 rate limit correctly", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Rate limit exceeded", { status: 429 });
    }) as unknown as typeof fetch;

    expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
