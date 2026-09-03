import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { assignSlots, heuristicParseUniversalData } from "@/lib/parser";
import { uid, useStore } from "@/lib/store";
import type { InterviewRoomItem } from "@/lib/types";

export function ParserPanel({ room }: { room: InterviewRoomItem }) {
  const { addCandidates } = useStore();
  const [raw, setRaw] = useState(
    "김민준\t웹개발\t20261234\t010-1234-5678\tminjun@example.com\n박서연 / AI 엔지니어링 / 20265678 / 15:00",
  );
  const [rows, setRows] = useState<ReturnType<typeof heuristicParseUniversalData>>([]);
  const parse = () =>
    setRows(
      assignSlots(heuristicParseUniversalData(raw), {
        startTime: "14:00",
        durationMinutes: room.minutesPerPerson,
        bufferMinutes: 5,
      }),
    );
  const register = () => {
    addCandidates(
      rows.map((row) => ({
        id: uid("candidate"),
        roomId: room.id,
        name: row.name,
        track: row.track,
        studentId: row.studentId,
        phone: row.phone,
        email: row.email,
        timeslot: { start: row.start, end: row.end, room: room.name },
        status: "PENDING",
        documents: [
          {
            id: uid("doc"),
            title: "지원서 요약",
            type: "application",
            contentSnippet: `${row.name}의 ${row.track} 지원서`,
            rawText: `${row.name}은(는) ${row.track} 트랙에 지원했습니다. 대표 프로젝트 경험과 문제 해결 과정에 대해 확인이 필요합니다.`,
          },
        ],
        sttTranscript: [],
        aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
        mindMap: [],
      })),
    );
    setRows([]);
  };
  return (
    <Card className="border-border bg-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> 만능 데이터 파서
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="min-h-28 font-mono text-xs"
          placeholder="엑셀 복사 텍스트, 쉼표/슬래시 구분, 카카오톡 공지를 붙여넣으세요."
        />
        <div className="flex flex-wrap justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            AI가 없어도 로컬 정규식 파서가 즉시 동작합니다.
          </p>
          <Button onClick={parse}>
            <Sparkles /> 데이터 분석
          </Button>
        </div>
        {rows.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-2 text-left">이름</th>
                    <th className="p-2 text-left">트랙</th>
                    <th className="p-2 text-left">학번</th>
                    <th className="p-2 text-left">시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <tr key={`${row.name}-${i}`}>
                      <td className="p-2">{row.name}</td>
                      <td className="p-2">{row.track}</td>
                      <td className="p-2">{row.studentId || "—"}</td>
                      <td className="p-2 font-mono">
                        {row.start} — {row.end}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" onClick={register}>
              <Plus /> {rows.length}명 일괄 등록
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
