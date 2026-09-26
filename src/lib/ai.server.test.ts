import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling & sanitization", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-api-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) {
      process.env.GROQ_API_KEY = originalEnv;
    } else {
      delete process.env.GROQ_API_KEY;
    }
  });

  it("throws generic sanitized error when API returns 500 with sensitive error body", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Internal Server Error: Secret Key Invalid / Stack trace details", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }) as unknown as typeof fetch;

    expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow(
      "AI 분석에 실패했습니다.",
    );
  });

  it("throws user friendly message on 429 rate limit", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Rate limit exceeded", { status: 429 });
    }) as unknown as typeof fetch;

    expect(callGatewayJson("system prompt", "user prompt")).rejects.toThrow("AI 요청이 많습니다.");
  });
});
