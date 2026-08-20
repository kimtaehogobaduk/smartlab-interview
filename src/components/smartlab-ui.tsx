import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  LockKeyhole,
  Mic,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Brand } from "@/components/Brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CRITERIA_PRESETS, useStore } from "@/lib/store";
import { buildLeaderboard, weightedTotal } from "@/lib/scoring";
import { assignSlots, heuristicParseUniversalData } from "@/lib/parser";
import type {
  Candidate,
  CriteriaConfig,
  EvaluationCriterion,
  Formula,
  InterviewRoomItem,
} from "@/lib/types";
import { uid } from "@/lib/store";

export function AppShell({
  children,
  eyebrow,
  title,
  description,
  backTo = "/",
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  backTo?: "/" | "/admin" | "/rooms" | "/rooms/$roomId";
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-5">
            <Link
              to={backTo}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Brand size={36} />
            <div className="hidden border-l border-border pl-5 md:block">
              <p className="label-mono">{eyebrow}</p>
              <h1 className="text-sm font-semibold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />{" "}
              Local workspace
            </span>
            <Link
              to="/admin"
              className="label-mono rounded-md border border-border px-3 py-2 hover:bg-secondary"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8">
        {description ? (
          <p className="mb-7 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Gauge;
  accent?: "primary" | "accent" | "warning";
}) {
  return (
    <Card className="border-border bg-card/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className="label-mono">{label}</span>
          <Icon
            className={`size-4 ${accent === "accent" ? "text-accent" : accent === "warning" ? "text-warning" : "text-primary"}`}
          />
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  );
}

const statusLabel: Record<Candidate["status"], string> = {
  PENDING: "대기중",
  IN_PROGRESS: "진행중",
  COMPLETED: "평가완료",
  ABSENT: "결시",
};

export function StatusBadge({ status }: { status: Candidate["status"] }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "COMPLETED"
          ? "border-success/40 text-success"
          : status === "IN_PROGRESS"
            ? "border-accent/40 text-accent"
            : status === "ABSENT"
              ? "border-destructive/40 text-destructive"
              : "text-muted-foreground"
      }
    >
      {statusLabel[status]}
    </Badge>
  );
}

export function CriteriaEditor() {
  const { state, setCriteria } = useStore();
  const [draft, setDraft] = useState<CriteriaConfig>(state.criteria);
  const total = draft.items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const updateItem = (id: string, patch: Partial<EvaluationCriterion>) =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  const applyPreset = (preset: (typeof CRITERIA_PRESETS)[number]) =>
    setDraft((prev) => ({
      ...prev,
      isConfirmed: false,
      items: prev.items.map((item, i) => ({
        ...item,
        name: preset.names[i] ?? item.name,
        weight: preset.weights[i] ?? 0,
      })),
    }));
  const confirm = () => {
    if (total !== 100) return;
    setCriteria(
      { ...draft, isConfirmed: true, confirmedAt: new Date().toISOString(), confirmedBy: "Admin" },
      "Admin",
      "평가 기준과 가중치 100% 확정",
    );
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CRITERIA_PRESETS.map((preset) => (
          <Button key={preset.id} size="sm" variant="outline" onClick={() => applyPreset(preset)}>
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {draft.items.map((item) => (
          <Card key={item.id} className="border-border bg-card/50">
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1.2fr_100px_2fr] md:items-center">
              <div>
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="font-medium"
                />
                <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
              </div>
              <label className="text-xs text-muted-foreground">
                가중치 %
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.weight}
                  onChange={(e) => updateItem(item.id, { weight: Number(e.target.value) })}
                  className="mt-1"
                />
              </label>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(item.weight, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${total === 100 ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}
      >
        <div>
          <p className="font-semibold">
            가중치 합계{" "}
            <span className={total === 100 ? "text-success" : "text-warning"}>{total}%</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {total === 100
              ? "모든 면접관의 채점표를 열 수 있습니다."
              : `${Math.abs(100 - total)}%를 ${total > 100 ? "줄여" : "추가"}야 합니다.`}
          </p>
        </div>
        <Button disabled={total !== 100} onClick={confirm}>
          {state.criteria.isConfirmed ? <Check /> : <LockKeyhole />}{" "}
          {state.criteria.isConfirmed ? "기준 확정됨" : "기준 확정"}
        </Button>
      </div>
    </div>
  );
}

export function CandidateTable({
  roomId,
  compact = false,
}: {
  roomId?: string;
  compact?: boolean;
}) {
  const { state, removeCandidate, setCandidateStatus } = useStore();
  const candidates = state.candidates.filter((candidate) => !roomId || candidate.roomId === roomId);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">지원자</th>
              <th>트랙</th>
              <th>면접 시간</th>
              <th>상태</th>
              <th className="px-4 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{candidate.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {candidate.studentId || candidate.email}
                  </div>
                </td>
                <td>
                  <Badge variant="secondary">{candidate.track}</Badge>
                </td>
                <td className="font-mono text-xs">
                  {candidate.timeslot.start} — {candidate.timeslot.end}
                </td>
                <td>
                  <StatusBadge status={candidate.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {!compact ? (
                    <div className="flex justify-end gap-2">
                      <select
                        aria-label={`${candidate.name} 상태`}
                        value={candidate.status}
                        onChange={(e) =>
                          setCandidateStatus(candidate.id, e.target.value as Candidate["status"])
                        }
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="PENDING">대기중</option>
                        <option value="IN_PROGRESS">진행중</option>
                        <option value="COMPLETED">완료</option>
                        <option value="ABSENT">결시</option>
                      </select>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCandidate(candidate.id)}
                      >
                        <X />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  등록된 지원자가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

export function Leaderboard({ roomId }: { roomId?: string }) {
  const { state } = useStore();
  const rows = buildLeaderboard(
    state.candidates.filter((c) => !roomId || c.roomId === roomId),
    state.submissions,
    state.criteria,
    state.criteria.formula,
  );
  const [track, setTrack] = useState("전체");
  const tracks = ["전체", ...new Set(rows.map((row) => row.track))];
  const visible = rows.filter((row) => track === "전체" || row.track === track);
  return (
    <Card className="border-border bg-card/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-warning" /> 리더보드
          </CardTitle>
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-xs"
          >
            {tracks.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map((row) => (
            <div
              key={row.candidateId}
              className="flex items-center gap-4 rounded-lg border border-border p-3"
            >
              <div className="w-8 text-center font-mono text-lg text-muted-foreground">
                #{row.rank}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {row.name}
                  {row.passed ? (
                    <Badge className="bg-success text-success-foreground">합격권</Badge>
                  ) : (
                    <Badge variant="outline" className="text-warning">
                      재검토
                    </Badge>
                  )}
                  {row.topCriteria.length ? (
                    <span className="text-[10px] text-warning">TOP {row.topCriteria[0]}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.track} · {row.panelCount}명 제출
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-semibold text-primary">{row.finalScore}</div>
                <div className="text-[10px] text-muted-foreground">
                  cutoff {state.criteria.passCutoff}
                </div>
              </div>
            </div>
          ))}
          {visible.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              평가 제출 후 순위가 표시됩니다.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function RoomCard({ room }: { room: InterviewRoomItem }) {
  const { state } = useStore();
  const candidates = state.candidates.filter((c) => c.roomId === room.id);
  const completed = candidates.filter((c) => c.status === "COMPLETED").length;
  return (
    <Card className="group border-border bg-card/60 transition hover:border-primary/50 hover:shadow-[0_0_30px_-18px_var(--primary)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-mono">{room.name}</p>
            <h3 className="mt-2 text-lg font-semibold">{room.title}</h3>
          </div>
          <Badge variant="outline" className="border-success/40 text-success">
            READY
          </Badge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-xs">
          <div>
            <div className="text-lg font-semibold">{room.interviewers.length}</div>
            <div className="text-muted-foreground">면접관</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{candidates.length}</div>
            <div className="text-muted-foreground">지원자</div>
          </div>
          <div>
            <div className="text-lg font-semibold">
              {room.minutesPerPerson}
              <span className="text-xs">m</span>
            </div>
            <div className="text-muted-foreground">1인 시간</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            평가 진행률 {candidates.length ? Math.round((completed / candidates.length) * 100) : 0}%
          </span>
          <Link
            to="/rooms/$roomId"
            params={{ roomId: room.id }}
            className="flex items-center gap-1 font-medium text-primary"
          >
            입장 <ArrowRight className="size-3 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  icon: Icon = ClipboardCheck,
  title,
  body,
}: {
  icon?: typeof ClipboardCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function FormulaLabel({ formula }: { formula: Formula }) {
  return (
    <span>
      {formula === "trimmed"
        ? "가중 절사평균"
        : formula === "weighted"
          ? "가중 평균"
          : formula === "median"
            ? "중앙값"
            : "산술평균"}
    </span>
  );
}
