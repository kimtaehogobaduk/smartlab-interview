const GROQ_GATEWAY = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = process.env["GROQ_TEXT_MODEL"] ?? "llama-3.3-70b-versatile";
const VISION_MODEL =
  process.env["GROQ_VISION_MODEL"] ?? "meta-llama/llama-4-scout-17b-16e-instruct";

type Content =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export async function callGatewayJson(
  system: string,
  user: Content,
): Promise<Record<string, unknown>> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("GROQ_API_KEY가 설정되지 않았습니다.");
  const model = Array.isArray(user) ? VISION_MODEL : TEXT_MODEL;

  const response = await fetch(GROQ_GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`AI gateway failed [${response.status}]: ${body}`);
    if (response.status === 429) throw new Error("AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
    if (response.status === 402)
      throw new Error("AI 크레딧이 부족합니다. 워크스페이스에 크레딧을 추가해 주세요.");
    throw new Error(`AI 분석 실패 [${response.status}]: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = /\{[\s\S]*\}/.exec(text);
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  }
}

export function asStringArray(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, limit);
}