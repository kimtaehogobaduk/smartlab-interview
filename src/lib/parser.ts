import type { ParsedCandidateRow } from "./types";

export interface SlotConfig {
  startTime: string;
  durationMinutes: number;
  bufferMinutes: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TIME_RE = /(\d{1,2})\s*[:시]\s*(\d{2})?/;
const PHONE_RE = /(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})/;
const EMAIL_RE = /([\w.+-]+@[\w-]+\.[\w.]+)/;
const STUDENT_RE = /\b(20\d{6,8})\b/;
const NAME_RE = /([가-힣]{2,4})(?![가-힣])/;

const TRACKS = [
  "AI 엔지니어링",
  "웹개발",
  "모바일",
  "디자인/기획",
  "데이터 분석",
  "백엔드",
  "프론트엔드",
];

/** Local regex heuristic parser — fail-safe fallback when AI is unavailable. */
export function heuristicParseUniversalData(raw: string): ParsedCandidateRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const rows: ParsedCandidateRow[] = [];
  for (const line of lines) {
    if (/이름|성명|name/i.test(line) && /트랙|시간|track|time/i.test(line)) continue;
    const cells = line
      .split(/\t|\s*\/\s*|\s*\|\s*|\s*,\s*/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length === 0) continue;

    const joined = cells.join(" ");
    const name = cells.find((c) => /^[가-힣]{2,4}$/.test(c)) ?? NAME_RE.exec(joined)?.[1] ?? "";
    if (!name) continue;

    const track =
      cells.find((c) => TRACKS.some((t) => c.includes(t) || t.includes(c))) ??
      cells.find((c) => /개발|디자인|기획|AI|데이터|모바일|웹/i.test(c) && c !== name) ??
      "미지정";

    const timeMatch = TIME_RE.exec(joined.replace(name, ""));
    const start = timeMatch
      ? `${String(Number(timeMatch[1])).padStart(2, "0")}:${timeMatch[2] ?? "00"}`
      : "";

    rows.push({
      name,
      track,
      studentId: STUDENT_RE.exec(joined)?.[1] ?? "",
      phone: PHONE_RE.exec(joined)?.[1] ?? "",
      email: EMAIL_RE.exec(joined)?.[1] ?? "",
      start,
      end: "",
    });
  }
  return rows;
}

/** Assign non-conflicting sequential slots, respecting explicit start times. */
export function assignSlots(rows: ParsedCandidateRow[], config: SlotConfig): ParsedCandidateRow[] {
  let cursor = toMinutes(config.startTime);
  const step = config.durationMinutes + config.bufferMinutes;

  return rows.map((row) => {
    let start = cursor;
    if (row.start && TIME_RE.test(row.start)) {
      start = Math.max(toMinutes(row.start), cursor);
    }
    const end = start + config.durationMinutes;
    cursor = start + step;
    return { ...row, start: toTime(start), end: toTime(end) };
  });
}