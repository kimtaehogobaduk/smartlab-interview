import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson", () => {
  const originalEnv = process.env["GROQ_API_KEY"];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "test-api-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["GROQ_API_KEY"] = originalEnv;
    } else {
      delete process.env["GROQ_API_KEY"];
    }
    globalThis.fetch = originalFetch;
  });

  it("throws a sanitized error without leaking upstream response body on HTTP 500 error", async () => {
    const sensitiveResponseBody =
      '{"error":{"message":"Internal server secret stack trace info","code":500}}';

    globalThis.fetch = mock(async () => {
      return new Response(sensitiveResponseBody, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }) as unknown as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user input");
      expect.unreachable("Should have thrown an error");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const error = err as Error;
      expect(error.message).toBe("AI 분석 실패 [500]");
      expect(error.message).not.toContain("Internal server secret stack trace info");
    }
  });

  it("throws expected user-friendly message on 429 rate limit", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Too Many Requests", { status: 429 });
    }) as unknown as typeof fetch;

    expect(callGatewayJson("sys", "user")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
