import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AuditLogEntry,
  Candidate,
  CandidateStatus,
  CriteriaConfig,
  EvaluationSubmission,
  InterviewRoomItem,
  MindMapNode,
  TranscriptLine,
} from "./types";

const STORAGE_KEY = "smartlab-interview-v1";

export interface AppState {
  criteria: CriteriaConfig;
  rooms: InterviewRoomItem[];
  candidates: Candidate[];
  submissions: EvaluationSubmission[];
  auditLogs: AuditLogEntry[];
}

export const DEFAULT_CRITERIA: CriteriaConfig = {
  isConfirmed: false,
  formula: "trimmed",
  passCutoff: 70,
  items: [
    {
      id: "tech",
      name: "기술 역량",
      weight: 40,
      description: "직무 관련 기술 깊이, 학습 이력, 코드/설계 이해도",
      maxScore: 100,
    },
    {
      id: "problem",
      name: "문제 해결력",
      weight: 30,
      description: "문제 정의·구조화 능력, 논리적 추론, 대안 제시",
      maxScore: 100,
    },
    {
      id: "comm",
      name: "의사소통",
      weight: 20,
      description: "논지 전달력, 질문 이해도, 경청과 피드백 수용",
      maxScore: 100,
    },
    {
      id: "fit",
      name: "태도/조직적합도",
      weight: 10,
      description: "책임감, 협업 태도, 조직 목표와의 정렬",
      maxScore: 100,
    },
  ],
};

export const CRITERIA_PRESETS: { id: string; label: string; weights: number[]; names: string[] }[] =
  [
    {
      id: "dev",
      label: "개발 직무 표준형",
      weights: [40, 30, 20, 10],
      names: ["기술 역량", "문제 해결력", "의사소통", "태도/조직적합도"],
    },
    {
      id: "equal",
      label: "균등 4분할형",
      weights: [25, 25, 25, 25],
      names: ["기술 역량", "문제 해결력", "의사소통", "태도/조직적합도"],
    },
    {
      id: "collab",
      label: "협업 및 인성 중심형",
      weights: [20, 25, 35, 20],
      names: ["기술 역량", "문제 해결력", "의사소통", "태도/조직적합도"],
    },
    {
      id: "core3",
      label: "3대 핵심 지표형",
      weights: [50, 30, 20],
      names: ["기술 역량", "문제 해결력", "태도/조직적합도"],
    },
  ];

const SEED: AppState = {
  criteria: DEFAULT_CRITERIA,
  rooms: [
    {
      id: "room-a",
      name: "A 면접실",
      title: "2026 상반기 신입 부원 선발",
      minutesPerPerson: 30,
      interviewers: [
        { id: "iv-1", name: "홍길동", role: "면접관" },
        { id: "iv-2", name: "이순신", role: "면접관" },
        { id: "iv-3", name: "강감찬", role: "면접관" },
      ],
      status: "READY",
    },
  ],
  candidates: [
    {
      id: "candidate-minjun",
      roomId: "room-a",
      name: "김민준",
      track: "웹개발",
      studentId: "20261234",
      phone: "010-1234-5678",
      email: "minjun@example.com",
      timeslot: { start: "14:00", end: "14:30", room: "A 면접실" },
      status: "PENDING",
      documents: [
        {
          id: "doc-minjun",
          title: "지원서",
          type: "application",
          contentSnippet: "서비스 성능 개선 프로젝트 경험",
          rawText:
            "React와 TypeScript 기반의 동아리 홈페이지를 개발했습니다. 이미지 최적화와 캐싱을 적용해 초기 로딩 시간을 42% 줄였고, 팀원들과 배포 프로세스를 정리했습니다.",
        },
      ],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "candidate-seoyeon",
      roomId: "room-a",
      name: "박서연",
      track: "AI 엔지니어링",
      studentId: "20265678",
      phone: "010-2345-6789",
      email: "seoyeon@example.com",
      timeslot: { start: "14:35", end: "15:05", room: "A 면접실" },
      status: "PENDING",
      documents: [
        {
          id: "doc-seoyeon",
          title: "지원서",
          type: "application",
          contentSnippet: "검색 증강 생성 챗봇 프로토타입",
          rawText:
            "검색 증강 생성 기반의 학습 도우미를 팀 프로젝트로 만들었습니다. 평가셋을 직접 설계하고 답변 근거를 함께 노출하는 방식을 실험했습니다.",
        },
      ],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
    {
      id: "candidate-hyunwoo",
      roomId: "room-a",
      name: "이현우",
      track: "데이터 분석",
      studentId: "20264512",
      phone: "010-3456-7890",
      email: "hyunwoo@example.com",
      timeslot: { start: "15:10", end: "15:40", room: "A 면접실" },
      status: "PENDING",
      documents: [
        {
          id: "doc-hyunwoo",
          title: "지원서",
          type: "application",
          contentSnippet: "사용자 행동 데이터 대시보드",
          rawText:
            "학회 운영 데이터를 분석해 이탈 구간을 찾고, 운영진이 바로 확인할 수 있는 대시보드를 만들었습니다. 가설을 세우고 실험 결과로 개선안을 제안했습니다.",
        },
      ],
      sttTranscript: [],
      aiInsights: { realtimeSummaries: [], tailQuestions: [], contradictions: [] },
      mindMap: [],
    },
  ],
  submissions: [],
  auditLogs: [],
};

function load(): AppState {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return { ...SEED, ...(JSON.parse(raw) as AppState) };
  } catch {
    return SEED;
  }
}

export const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

interface StoreApi {
  state: AppState;
  hydrated: boolean;
  log: (actor: string, action: string, detail: string) => void;
  setCriteria: (next: CriteriaConfig, actor: string, reason: string) => void;
  addRoom: (room: Omit<InterviewRoomItem, "id" | "status">) => void;
  removeRoom: (id: string) => void;
  addCandidates: (candidates: Candidate[]) => void;
  removeCandidate: (id: string) => void;
  setCandidateStatus: (id: string, status: CandidateStatus) => void;
  appendTranscript: (id: string, line: TranscriptLine) => void;
  setInsights: (
    id: string,
    insights: { realtimeSummaries: string[]; tailQuestions: string[]; contradictions: string[] },
  ) => void;
  setMindMap: (id: string, nodes: MindMapNode[]) => void;
  submitEvaluation: (submission: EvaluationSubmission) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(SEED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const log = useCallback((actor: string, action: string, detail: string) => {
    setState((prev) => ({
      ...prev,
      auditLogs: [
        { id: uid("log"), at: new Date().toISOString(), actor, action, detail },
        ...prev.auditLogs,
      ].slice(0, 300),
    }));
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      hydrated,
      log,
      setCriteria: (next, actor, reason) => {
        setState((prev) => ({
          ...prev,
          criteria: next,
          auditLogs: [
            {
              id: uid("log"),
              at: new Date().toISOString(),
              actor,
              action: next.isConfirmed ? "평가 기준 확정" : "평가 기준 잠금 해제",
              detail: reason,
            },
            ...prev.auditLogs,
          ],
        }));
      },
      addRoom: (room) => {
        const created: InterviewRoomItem = { ...room, id: uid("room"), status: "READY" };
        setState((prev) => ({
          ...prev,
          rooms: [...prev.rooms, created],
          auditLogs: [
            {
              id: uid("log"),
              at: new Date().toISOString(),
              actor: "Admin",
              action: "면접실 생성",
              detail: `${created.name} · 심사위원 ${created.interviewers.length}명 · ${created.minutesPerPerson}분`,
            },
            ...prev.auditLogs,
          ],
        }));
      },
      removeRoom: (id) => {
        setState((prev) => ({
          ...prev,
          rooms: prev.rooms.filter((r) => r.id !== id),
          candidates: prev.candidates.filter((c) => c.roomId !== id),
          submissions: prev.submissions.filter((s) => s.roomId !== id),
          auditLogs: [
            {
              id: uid("log"),
              at: new Date().toISOString(),
              actor: "Admin",
              action: "면접실 삭제",
              detail: `${prev.rooms.find((r) => r.id === id)?.name ?? id} 및 연관 데이터 삭제`,
            },
            ...prev.auditLogs,
          ],
        }));
      },
      addCandidates: (candidates) => {
        setState((prev) => ({
          ...prev,
          candidates: [...prev.candidates, ...candidates],
          auditLogs: [
            {
              id: uid("log"),
              at: new Date().toISOString(),
              actor: "Admin",
              action: "지원자 일괄 등록",
              detail: `${candidates.length}명 원자적 등록`,
            },
            ...prev.auditLogs,
          ],
        }));
      },
      removeCandidate: (id) => {
        setState((prev) => ({
          ...prev,
          candidates: prev.candidates.filter((c) => c.id !== id),
          submissions: prev.submissions.filter((s) => s.candidateId !== id),
        }));
      },
      setCandidateStatus: (id, status) => {
        setState((prev) => ({
          ...prev,
          candidates: prev.candidates.map((c) => (c.id === id ? { ...c, status } : c)),
        }));
      },
      appendTranscript: (id, line) => {
        setState((prev) => ({
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.id === id ? { ...c, sttTranscript: [...c.sttTranscript, line] } : c,
          ),
        }));
      },
      setInsights: (id, insights) => {
        setState((prev) => ({
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.id === id ? { ...c, aiInsights: insights } : c,
          ),
        }));
      },
      setMindMap: (id, nodes) => {
        setState((prev) => ({
          ...prev,
          candidates: prev.candidates.map((c) => (c.id === id ? { ...c, mindMap: nodes } : c)),
        }));
      },
      submitEvaluation: (submission) => {
        setState((prev) => ({
          ...prev,
          submissions: [
            ...prev.submissions.filter(
              (s) =>
                !(
                  s.candidateId === submission.candidateId &&
                  s.interviewerName === submission.interviewerName
                ),
            ),
            submission,
          ],
          auditLogs: [
            {
              id: uid("log"),
              at: new Date().toISOString(),
              actor: submission.interviewerName,
              action: "채점표 제출",
              detail: `가중 총점 ${submission.totalWeightedScore}점 · 판정 ${submission.qualitativeFeedback.finalVerdict}`,
            },
            ...prev.auditLogs,
          ],
        }));
      },
      reset: () => setState(SEED),
    }),
    [state, hydrated, log],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useSession() {
  const [interviewer, setInterviewerState] = useState<string>("");
  useEffect(() => {
    setInterviewerState(window.sessionStorage.getItem("smartlab-interviewer") ?? "");
  }, []);
  const setInterviewer = useCallback((name: string) => {
    window.sessionStorage.setItem("smartlab-interviewer", name);
    setInterviewerState(name);
  }, []);
  return { interviewer, setInterviewer };
}
