import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error sanitization", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env["GROQ_API_KEY"];

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env["GROQ_API_KEY"];
    } else {
      process.env["GROQ_API_KEY"] = originalEnv;
    }
  });

  it("sanitizes error details on non-ok status codes and does not leak raw body in Error message", async () => {
    const rawErrorBody =
      '{"error":{"message":"Internal DB connection string postgres://user:secret@localhost:5432 failed"}}';
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(rawErrorBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    ) as typeof fetch;

    try {
      await callGatewayJson("system prompt", "user content");
      expect(true).toBe(false); // Should not reach here
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      const error = err as Error;
      expect(error.message).toBe("AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      expect(error.message).not.toContain("postgres://");
      expect(error.message).not.toContain("secret");
    }
  });

  it("handles 429 status code securely", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("Too Many Requests", {
          status: 429,
        }),
      ),
    ) as typeof fetch;

    expect(callGatewayJson("sys", "user")).rejects.toThrow(
      "AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
