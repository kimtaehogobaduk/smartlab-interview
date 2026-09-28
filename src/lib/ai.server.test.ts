import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  const originalEnv = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("throws error when GROQ_API_KEY is not set", async () => {
    delete process.env.GROQ_API_KEY;
    expect(callGatewayJson("sys", "user")).rejects.toThrow("GROQ_API_KEY가 설정되지 않았습니다.");
  });

  it("sanitizes 500 error responses without leaking body or status", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Internal Server Error: Secret DB credentials or stack trace", {
        status: 500,
      });
    }) as typeof fetch;

    try {
      await callGatewayJson("sys", "user");
      expect.unreachable("Should have thrown error");
    } catch (err: unknown) {
      expect((err as Error).message).toBe("AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      expect((err as Error).message).not.toContain("500");
      expect((err as Error).message).not.toContain("Secret DB credentials");
    }
  });

  it("handles 429 rate limit errors safely", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Too Many Requests", { status: 429 });
    }) as typeof fetch;

    expect(callGatewayJson("sys", "user")).rejects.toThrow("AI 요청이 많습니다.");
  });
});
