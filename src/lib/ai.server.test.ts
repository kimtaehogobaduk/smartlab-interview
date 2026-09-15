import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { callGatewayJson } from "./ai.server";

describe("callGatewayJson error handling", () => {
  const originalEnv = process.env["GROQ_API_KEY"];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env["GROQ_API_KEY"] = "mock-api-key";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["GROQ_API_KEY"] = originalEnv;
    } else {
      delete process.env["GROQ_API_KEY"];
    }
    globalThis.fetch = originalFetch;
  });

  it("throws error without leaking response body details when fetch fails with 500", async () => {
    const sensitiveBody = "Internal error: secret_key=12345 stack: Error at /server/internal.js:42";
    globalThis.fetch = mock(async () => {
      return new Response(sensitiveBody, { status: 500, statusText: "Internal Server Error" });
    }) as unknown as typeof fetch;

    let thrownError: Error | null = null;
    try {
      await callGatewayJson("system prompt", "user prompt");
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toBe("AI 분석 실패 [500]");
    expect(thrownError?.message).not.toContain("secret_key");
    expect(thrownError?.message).not.toContain("internal.js");
  });
});
