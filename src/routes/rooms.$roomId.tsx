import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowRight, Clock3, LockKeyhole, Radio, UserRound } from "lucide-react";
import { AppShell, CandidateTable, StatusBadge } from "@/components/smartlab-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession, useStore } from "@/lib/store";

export const Route = createFileRoute("/rooms/$roomId")({ component: CandidateQueuePage });

function CandidateQueuePage() {
  const { roomId } = useParams({ from: "/rooms/$roomId" });
  const { state, setCandidateStatus } = useStore();
  const { interviewer } = useSession();
  const room = state.rooms.find((r) => r.id === roomId);
  const candidates = state.candidates.filter((candidate) => candidate.roomId === roomId);
  if (!room)
    return (
      <AppShell eyebrow="Interviewer entry" title="Room not found">
        <p>면접실을 찾을 수 없습니다.</p>
      </AppShell>
    );
  return (
    <AppShell eyebrow="Candidate queue" title={room.name} description={room.title} backTo="/rooms">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <span className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" /> {interviewer || "면접관 미선택"}
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="size-4" /> {room.minutesPerPerson}분 / 지원자
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <LockKeyhole className="size-4" /> 블라인드 평가
            </span>
          </div>
          <Badge variant="outline" className="border-success/40 text-success">
            <Radio className="mr-1 size-3" /> LIVE LOBBY
          </Badge>
        </div>
        <div className="grid gap-3">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card/50 p-4"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold">
                {candidate.name.slice(0, 1)}
              </div>
              <div className="min-w-44 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {candidate.name}
                  <Badge variant="secondary">{candidate.track}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {candidate.studentId || "학번 미등록"} · {candidate.email || "연락처 미등록"}
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {candidate.timeslot.start} — {candidate.timeslot.end}
              </div>
              <StatusBadge status={candidate.status} />
              {candidate.status === "PENDING" || candidate.status === "IN_PROGRESS" ? (
                <Button
                  asChild
                  size="sm"
                  onClick={() => setCandidateStatus(candidate.id, "IN_PROGRESS")}
                >
                  <Link
                    to="/rooms/$roomId/candidates/$candidateId"
                    params={{ roomId, candidateId: candidate.id }}
                  >
                    {candidate.status === "IN_PROGRESS" ? "면접실 열기" : "면접 시작"}{" "}
                    <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/rooms/$roomId/candidates/$candidateId"
                    params={{ roomId, candidateId: candidate.id }}
                  >
                    결과 보기
                  </Link>
                </Button>
              )}
            </div>
          ))}
          {candidates.length === 0 ? (
            <div className="panel py-16 text-center text-sm text-muted-foreground">
              지원자가 없습니다. 관리자 포털에서 명단을 등록하세요.
            </div>
          ) : null}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <CandidateTable roomId={roomId} compact />
          <div className="rounded-lg border border-border bg-card/40 p-5">
            <p className="label-mono">Panel protocol</p>
            <h2 className="mt-2 text-lg font-semibold">기준 확정 전에는 채점이 잠깁니다.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {state.criteria.isConfirmed
                ? "관리자가 기준을 확정했습니다. 면접실에서 개인 점수를 입력하고 제출할 수 있습니다."
                : "관리자에게 평가 기준 확정을 요청해 주세요. 현재는 면접 기록만 작성할 수 있습니다."}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
