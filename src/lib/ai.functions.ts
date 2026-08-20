import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { asStringArray, callGatewayJson } from "./ai.server";

const ParserInput = z.object({
  rawInput: z.string().default(""),
  imageBase64: z.string().optional(),
});

export const parseUniversalData = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ParserInput.parse(data))
  .handler(async ({ data }) => {
    const system =
      "당신은 면접 운영 데이터 파서입니다. 엑셀 복사 텍스트, 카카오톡 공지, 시간표 이미지에서 지원자 정보를 추출합니다. " +
      '반드시 {"rows":[{"name","track","studentId","phone","email","start","end"}]} 형태의 JSON만 반환하세요. ' +
      "시간은 HH:MM 24시간 형식, 값이 없으면 빈 문자열. 트랙을 못 찾으면 '미지정'.";

    const content: Parameters<typeof callGatewayJson>[1] = data.imageBase64
      ? [
          { type: "text", text: `다음 이미지와 텍스트에서 지원자 명단을 추출:\n${data.rawInput}` },
          { type: "image_url", image_url: { url: data.imageBase64 } },
        ]
      : `다음 비정형 데이터에서 지원자 명단을 추출:\n${data.rawInput}`;

    const parsed = await callGatewayJson(system, content);
    const rows = Array.isArray(parsed["rows"]) ? (parsed["rows"] as Record<string, unknown>[]) : [];
    return {
      rows: rows.slice(0, 200).map((row) => ({
        name: String(row["name"] ?? "").trim(),
        track: String(row["track"] ?? "미지정").trim() || "미지정",
        studentId: String(row["studentId"] ?? "").trim(),
        phone: String(row["phone"] ?? "").trim(),
        email: String(row["email"] ?? "").trim(),
        start: String(row["start"] ?? "").trim(),
        end: String(row["end"] ?? "").trim(),
      })),
    };
  });

const FeedbackInput = z.object({
  transcript: z.string().min(1),
  candidateProfile: z.string().default(""),
  documents: z.string().default(""),
});

export const realtimeFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => FeedbackInput.parse(data))
  .handler(async ({ data }) => {
    const system =
      "당신은 다대일 면접의 AI 코파일럿입니다. 대화록과 지원서를 비교 분석하여 " +
      '{"summaries":[3개 핵심 요약],"tailQuestions":[3개 심층 꼬리질문],"contradictions":[지원서-답변 모순점]} ' +
      "형태의 JSON만 반환하세요. 한국어로, 각 문장은 간결하게.";

    const parsed = await callGatewayJson(
      system,
      `[지원자 프로필]\n${data.candidateProfile}\n\n[지원 서류]\n${data.documents}\n\n[면접 대화록]\n${data.transcript}`,
    );

    return {
      summaries: asStringArray(parsed["summaries"], 3),
      tailQuestions: asStringArray(parsed["tailQuestions"], 3),
      contradictions: asStringArray(parsed["contradictions"], 4),
    };
  });

const MindMapInput = z.object({
  candidateName: z.string().default(""),
  documents: z.string().min(1),
});

export const buildMindMap = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => MindMapInput.parse(data))
  .handler(async ({ data }) => {
    const system =
      "지원 서류에서 역량 마인드맵 노드를 추출합니다. " +
      '{"nodes":[{"category":"STRENGTH|PROJECT|TECH|VERIFY","label":"짧은 라벨","evidence":"서류 근거 문장"}]} ' +
      "형태의 JSON만 반환하세요. 카테고리별 2~3개, 총 8~12개. 한국어.";

    const parsed = await callGatewayJson(
      system,
      `[지원자] ${data.candidateName}\n[서류]\n${data.documents}`,
    );
    const nodes = Array.isArray(parsed["nodes"])
      ? (parsed["nodes"] as Record<string, unknown>[])
      : [];
    const allowed = ["STRENGTH", "PROJECT", "TECH", "VERIFY"];
    return {
      nodes: nodes
        .filter((n) => allowed.includes(String(n["category"])))
        .slice(0, 14)
        .map((n, i) => ({
          id: `node-${i}`,
          category: String(n["category"]) as "STRENGTH" | "PROJECT" | "TECH" | "VERIFY",
          label: String(n["label"] ?? "").slice(0, 40),
          evidence: String(n["evidence"] ?? ""),
        })),
    };
  });