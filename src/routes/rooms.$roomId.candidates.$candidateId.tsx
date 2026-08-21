import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { CheckCircle2, FileText, LockKeyhole, Mic, Send, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/smartlab-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useSession, useStore, uid } from "@/lib/store";
import { weightedTotal } from "@/lib/scoring";
import type { Candidate } from "@/lib/types";

export const Route = createFileRoute("/rooms/$roomId/candidates/$candidateId")({
  component: InterviewRoomPage,
});

function InterviewRoomPage() {
  const { roomId, candidateId } = useParams({ from: "/rooms/$roomId/candidates/$candidateId" });
  const { state, setCandidateStatus, appendTranscript, submitEvaluation, setInsights } = useStore();
  const { interviewer } = useSession();
  const candidate = state.candidates.find((c) => c.id === candidateId);
  const room = state.rooms.find((r) => r.id === roomId);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [bonuses, setBonuses] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState({ strengths: "", improvements: "" });
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  const total = useMemo(
    () =>
      weightedTotal(
        state.criteria.items.map((item) => ({
          criterionId: item.id,
          score: scores[item.id] ?? 0,
          bonusPoints: bonuses[item.id] ?? 0,
        })),
        state.criteria.items,
      ),
    [bonuses, scores, state.criteria.items],
  );
  useEffect(() => {
    if (candidate?.status === "PENDING") setCandidateStatus(candidate.id, "IN_PROGRESS");
  }, [candidate, setCandidateStatus]);
  if (!candidate || !room)
    return (
      <AppShell eyebrow="Interview room" title="지원자를 찾을 수 없습니다.">
        <p>면접실 또는 지원자 정보가 없습니다.</p>
      </AppShell>
    );
  const addNote = () => {
    if (!note.trim()) return;
    appendTranscript(candidate.id, {
      id: uid("line"),
      speaker: "interviewer",
      text: note.trim(),
      timestamp: new Date().toISOString(),
    });
    setNote("");
  };
  const submit = () => {
    submitEvaluation({
      id: uid("eval"),
      candidateId: candidate.id,
      roomId,
      interviewerName: interviewer || "면접관",
      submittedAt: new Date().toISOString(),
      scores: state.criteria.items.map((item) => ({
        criterionId: item.id,
        criterionName: item.name,
        score: scores[item.id] ?? 0,
        bonusPoints: Math.min(Math.max(bonuses[item.id] ?? 0, 0), (scores[item.id] ?? 0) * 0.1),
        weight: item.weight,
      })),
      totalWeightedScore: total,
      qualitativeFeedback: {
        strengths: feedback.strengths,
        improvements: feedback.improvements,
      },
    });
    setCandidateStatus(candidate.id, "COMPLETED");
  };
  const generateLocalInsight = () =>
    setInsights(candidate.id, {
      realtimeSummaries: [
        "지원자의 답변에서 문제 정의와 실행 결과를 확인했습니다.",
        "프로젝트 기여 범위와 본인의 의사결정 근거를 추가로 검증하세요.",
        "지원서의 기술 경험과 실제 설명 사이의 연결성을 확인하세요.",
      ],
      tailQuestions: [
        "가장 어려웠던 기술적 트레이드오프는 무엇이었나요?",
        "본인이 맡은 범위를 객관적으로 검증할 수 있는 지표가 있나요?",
        "같은 문제를 지금 다시 설계한다면 무엇을 바꾸겠나요?",
      ],
      contradictions: [],
    });
  return (
    <AppShell
      eyebrow="Live interview room"
      title={`${candidate.name} · ${candidate.track}`}
      description={`${room.name} · ${candidate.timeslot.start} — ${candidate.timeslot.end}`}
      backTo="/rooms/$roomId"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
        <section className="space-y-4">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" /> 지원 서류
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">
                {candidate.documents[0]?.rawText ?? "등록된 서류가 없습니다."}
              </p>
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                <p className="label-mono">Candidate profile</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">학번</span>
                  <span>{candidate.studentId || "—"}</span>
                  <span className="text-muted-foreground">이메일</span>
                  <span className="truncate">{candidate.email || "—"}</span>
                  <span className="text-muted-foreground">연락처</span>
                  <span>{candidate.phone || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-accent" /> 역량 마인드맵
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {(candidate.mindMap.length
                  ? candidate.mindMap
                  : [
                      { id: "a", category: "STRENGTH", label: "문제 구조화" },
                      { id: "b", category: "PROJECT", label: "대표 프로젝트" },
                      { id: "c", category: "TECH", label: candidate.track },
                      { id: "d", category: "VERIFY", label: "기여 범위 검증" },
                    ]
                ).map((node) => (
                  <div
                    key={node.id}
                    className="rounded border border-border bg-secondary/30 p-3 text-xs"
                  >
                    <div className="mb-2 size-2 rounded-full bg-primary" />
                    <span className="font-medium">{node.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
        <section className="space-y-4">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic className="size-4 text-primary" /> 실시간 STT 콘솔
                </CardTitle>
                <Button
                  size="sm"
                  variant={listening ? "default" : "outline"}
                  onClick={() => setListening(!listening)}
                >
                  <span
                    className={`size-2 rounded-full ${listening ? "bg-destructive animate-pulse" : "bg-muted-foreground"}`}
                  />
                  {listening ? "기록 중" : "기록 시작"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-48 space-y-3 rounded-lg bg-secondary/30 p-4">
                {candidate.sttTranscript.length ? (
                  candidate.sttTranscript.map((line) => (
                    <div key={line.id} className="text-sm">
                      <span className="mr-2 text-xs text-muted-foreground">
                        {line.speaker === "candidate" ? "지원자" : "면접관"}
                      </span>
                      {line.text}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    질문과 답변을 메모하면 면접 기록으로 남습니다.
                  </p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="면접 중 메모 또는 발화를 입력하세요."
                  className="min-h-12"
                />
                <Button size="icon" onClick={addNote}>
                  <Send />
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> AI 코파일럿
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {candidate.aiInsights.realtimeSummaries.length ? (
                  candidate.aiInsights.realtimeSummaries.map((text) => (
                    <p key={text} className="text-sm leading-relaxed">
                      • {text}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    기록된 대화를 바탕으로 요약·꼬리질문을 생성할 수 있습니다.
                  </p>
                )}
              </div>
              <Button size="sm" variant="outline" className="mt-4" onClick={generateLocalInsight}>
                <Sparkles /> 인사이트 갱신
              </Button>
              {candidate.aiInsights.tailQuestions.length ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="label-mono mb-2">Suggested follow-ups</p>
                  {candidate.aiInsights.tailQuestions.map((q) => (
                    <p key={q} className="mb-2 text-sm">
                      ↳ {q}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
        <section>
          <Card className="border-border bg-card/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">가중 채점표</CardTitle>
                <Badge variant={state.criteria.isConfirmed ? "default" : "outline"}>
                  {state.criteria.isConfirmed ? "LOCKED CRITERIA" : "기준 미확정"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {state.criteria.items.map((item) => (
                  <label key={item.id} className="block">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>
                        {item.name}{" "}
                        <span className="text-xs text-muted-foreground">({item.weight}%)</span>
                      </span>
                      <span className="font-mono text-primary">
                        {scores[item.id] ?? 0}
                        {bonuses[item.id] ? (
                          <span className="ml-1 text-xs text-warning">+{bonuses[item.id]}</span>
                        ) : null}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      disabled={!state.criteria.isConfirmed}
                      value={scores[item.id] ?? 0}
                      onChange={(e) => setScores({ ...scores, [item.id]: Number(e.target.value) })}
                      className="w-full accent-[var(--primary)]"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-warning">특이 가산점 (+점)</span>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        +
                        <input
                          aria-label={`${item.name} 가산점`}
                          type="number"
                          min="0"
                          max={Math.round((scores[item.id] ?? 0) * 0.1 * 10) / 10}
                          step="0.1"
                          disabled={!state.criteria.isConfirmed}
                          value={bonuses[item.id] ?? 0}
                          onChange={(e) =>
                            setBonuses({
                              ...bonuses,
                              [item.id]: Math.min(
                                Math.max(Number(e.target.value) || 0, 0),
                                (scores[item.id] ?? 0) * 0.1,
                              ),
                            })
                          }
                          className="h-8 w-20 rounded border border-input bg-background px-2 text-right font-mono text-foreground"
                        />
                        점 <span>(기본 점수의 최대 10%)</span>
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </label>
                ))}
              </div>
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm">실시간 가중 총점</span>
                  <strong className="font-mono text-3xl text-primary">
                    {total}
                    <span className="text-sm"> / 100</span>
                  </strong>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <Textarea
                  value={feedback.strengths}
                  onChange={(e) => setFeedback({ ...feedback, strengths: e.target.value })}
                  placeholder="강점 및 확인된 근거"
                />
                <Textarea
                  value={feedback.improvements}
                  onChange={(e) => setFeedback({ ...feedback, improvements: e.target.value })}
                  placeholder="우려 사항 및 추가 확인"
                />
                <Button className="w-full" disabled={!state.criteria.isConfirmed} onClick={submit}>
                  <CheckCircle2 /> 평가 제출 · {total}점
                </Button>
                {!state.criteria.isConfirmed ? (
                  <p className="flex items-center gap-2 text-xs text-warning">
                    <LockKeyhole className="size-3" /> 관리자 기준 확정 전에는 제출할 수 없습니다.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
