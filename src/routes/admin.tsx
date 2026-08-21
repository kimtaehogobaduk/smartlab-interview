import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ClipboardList,
  History,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  AppShell,
  CandidateTable,
  CriteriaEditor,
  Leaderboard,
  ParserPanel,
  RoomCard,
  StatCard,
  AdminGate,
} from "@/components/smartlab-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin")({ component: AdminPortalPage });

function AdminPortalPage() {
  const { state, addRoom } = useStore();
  const [tab, setTab] = useState<"overview" | "criteria" | "rooms" | "candidates" | "audit">(
    "overview",
  );
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: "B 면접실",
    title: "2026 상반기 신입 부원 선발",
    minutes: 30,
    interviewers: "김하늘, 최유진",
  });
  const candidatesDone = state.candidates.filter((c) => c.status === "COMPLETED").length;
  const nav = [
    ["overview", "Overview", Activity],
    ["criteria", "Governance", ShieldCheck],
    ["rooms", "Interview rooms", ClipboardList],
    ["candidates", "Candidates", Users],
    ["audit", "Audit log", History],
  ] as const;
  const createRoom = () => {
    const interviewers = newRoom.interviewers
      .split(",")
      .map((name, i) => ({ id: `iv-${Date.now()}-${i}`, name: name.trim() }).name)
      .filter(Boolean)
      .map((name, i) => ({ id: `iv-${Date.now()}-${i}`, name, role: "면접관" }));
    if (!newRoom.name.trim() || !interviewers.length) return;
    addRoom({
      name: newRoom.name.trim(),
      title: newRoom.title.trim(),
      minutesPerPerson: Number(newRoom.minutes),
      interviewers,
    });
    setShowNewRoom(false);
  };
  return (
    <AdminGate>
      <AppShell
        eyebrow="Admin portal"
        title="운영 콘솔"
        description="평가 기준을 먼저 확정하고, 면접실·지원자·감사 로그를 한 곳에서 관리하세요. 모든 변경은 이 브라우저에 안전하게 저장됩니다."
      >
        <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-1">
            <div className="mb-4 px-3 label-mono">Workspace</div>
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${tab === id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
            <div className="mt-8 rounded-lg border border-border bg-card/50 p-4">
              <p className="label-mono">Governance state</p>
              <p
                className={`mt-3 flex items-center gap-2 text-sm font-medium ${state.criteria.isConfirmed ? "text-success" : "text-warning"}`}
              >
                <span className="size-2 rounded-full bg-current" />
                {state.criteria.isConfirmed ? "Locked & live" : "Awaiting lock"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {state.criteria.isConfirmed
                  ? "면접관 평가표가 열려 있습니다."
                  : "기준을 100%로 확정하면 평가가 열립니다."}
              </p>
            </div>
          </aside>
          <section className="min-w-0">
            {tab === "overview" ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Active rooms"
                    value={state.rooms.length}
                    note="운영 중인 면접실"
                    icon={ClipboardList}
                  />
                  <StatCard
                    label="Candidates"
                    value={state.candidates.length}
                    note="전체 지원자 풀"
                    icon={Users}
                    accent="accent"
                  />
                  <StatCard
                    label="Evaluations"
                    value={candidatesDone}
                    note="평가 완료 지원자"
                    icon={Activity}
                    accent="warning"
                  />
                  <StatCard
                    label="Criteria"
                    value={`${state.criteria.items.reduce((s, i) => s + i.weight, 0)}%`}
                    note={state.criteria.isConfirmed ? "평가 기준 확정됨" : "확정 필요"}
                    icon={ShieldCheck}
                  />
                </div>
                <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
                  <Card className="border-border bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">오늘의 면접실</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {state.rooms.map((room) => (
                        <RoomCard key={room.id} room={room} />
                      ))}
                    </CardContent>
                  </Card>
                  <Leaderboard />
                </div>
              </div>
            ) : null}
            {tab === "criteria" ? (
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" /> 평가 기준 거버넌스
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    가중치 합계가 정확히 100%가 되어야 면접관 채점표가 해제됩니다.
                  </p>
                </CardHeader>
                <CardContent>
                  <CriteriaEditor />
                </CardContent>
              </Card>
            ) : null}
            {tab === "rooms" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Interview rooms</h2>
                    <p className="text-sm text-muted-foreground">
                      면접실과 심사위원단을 관리합니다.
                    </p>
                  </div>
                  <Button onClick={() => setShowNewRoom(!showNewRoom)}>
                    <Settings2 /> 새 면접실
                  </Button>
                </div>
                {showNewRoom ? (
                  <Card className="border-primary/40 bg-primary/5">
                    <CardContent className="grid gap-3 p-5 md:grid-cols-2">
                      <Input
                        value={newRoom.name}
                        onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                        placeholder="면접실 이름"
                      />
                      <Input
                        value={newRoom.title}
                        onChange={(e) => setNewRoom({ ...newRoom, title: e.target.value })}
                        placeholder="전형 제목"
                      />
                      <Input
                        type="number"
                        value={newRoom.minutes}
                        onChange={(e) =>
                          setNewRoom({ ...newRoom, minutes: Number(e.target.value) })
                        }
                        placeholder="1인당 시간"
                      />
                      <Input
                        value={newRoom.interviewers}
                        onChange={(e) => setNewRoom({ ...newRoom, interviewers: e.target.value })}
                        placeholder="면접관 이름 (쉼표 구분)"
                      />
                      <div className="flex gap-2 md:col-span-2">
                        <Button onClick={createRoom}>
                          <Plus /> 생성
                        </Button>
                        <Button variant="ghost" onClick={() => setShowNewRoom(false)}>
                          취소
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  {state.rooms.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </div>
            ) : null}
            {tab === "candidates" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Candidate intake</h2>
                  <p className="text-sm text-muted-foreground">
                    비정형 명단을 파싱하고 면접실에 일괄 등록합니다.
                  </p>
                </div>
                {state.rooms[0] ? <ParserPanel room={state.rooms[0]} /> : null}
                <CandidateTable />
              </div>
            ) : null}
            {tab === "audit" ? (
              <Card className="border-border bg-card/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="size-5 text-accent" /> 불변 감사 로그
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {state.auditLogs.length ? (
                      state.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="grid gap-1 border-b border-border py-3 text-sm md:grid-cols-[150px_140px_1fr]"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(log.at).toLocaleString("ko-KR")}
                          </span>
                          <span className="font-medium">{log.action}</span>
                          <span className="text-muted-foreground">
                            {log.actor} · {log.detail}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        아직 기록이 없습니다.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      </AppShell>
    </AdminGate>
  );
}
