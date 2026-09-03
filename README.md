<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

<div align="center">

<img src="./public/smartlab-logo.png" alt="SmartLab Logo" width="220" />

# ⚡ SMARTLAB INTERVIEW

### 차세대 AI 기반 다대일 면접 선발 & 거버넌스 관리 플랫폼

**Next-Generation Multimodal AI Interview & Governance Platform**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Groq AI](https://img.shields.io/badge/Groq_Cloud_AI-Llama_3.3_&_4-F05032?style=for-the-badge&logo=meta&logoColor=white)](https://groq.com/)
[![Built with Lovable](https://img.shields.io/badge/Built_with-Lovable-ff4b4b?style=for-the-badge)](https://lovable.dev)

[주요 기능](#3-화면별-상세-기능-및-비즈니스-로직) • [시스템 아키텍처](#2-시스템-아키텍처-및-기술-스택) • [데이터 스키마](#4-데이터베이스-및-엔터프라이즈-데이터-모델) • [API 명세](#5-백엔드-api-명세서) • [시작하기](#6-시작하기-getting-started)

---

</div>

## 📌 1. 플랫폼 개요 및 개발 배경 (Executive Summary)

### 1.1. 개발 배경 및 문제 정의 (Background & Problem Statement)

동아리, 학회, 부트캠프, 스타트업 및 연구실 등에서 정기적으로 진행되는 **다대일(Multiple Interviewers to Single Candidate)** 면접 선발 과정에서는 고질적인 병목 현상과 불공정성 이슈가 발생해 왔습니다.

- 📄 **지원자 데이터의 비정형 파편화**
  지원서 텍스트, 엑셀 명단, 시간표 캡처 이미지, 카카오톡 공지 등 각기 다른 포맷의 데이터를 일일이 수작업으로 시간표와 면접표에 입력하면서 발생하는 일정 충돌 및 누락.
- 🙈 **면접관 간 주관적 편향 및 담합 (Halo & Conformity Bias)**
  특정 면접관의 발언이나 선입견에 다른 면접관들이 동조하거나, 정량적 기준 없이 직관에 의존하여 점수를 부여하는 문제.
- ⏱️ **기록의 부재와 꼬리질문의 한계**
  면접관이 질문을 던지고 필기하느라 지원자의 답변 흐름을 놓치거나, 지원서의 세부 이력과 실제 답변 간의 모순을 제시간에 짚어내지 못함.
- ⚖️ **평가 기준 거버넌스(Governance)의 붕괴**
  면접 도중 평가 항목이나 가중치가 모호하게 변경되거나, 최고점/최저점 극단치로 인해 특정 지원자가 불이익을 받는 왜곡 현상.

---

### 1.2. 핵심 설계 철학 (Core Design Principles)

| 원칙                  | 핵심 개념                    | 설명                                                                                                                              |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Strict Governance** | Role Separation & Governance | 관리자(Admin)의 엄격한 평가 기준/가중치 확정(Lock) 없이는 어떤 면접관도 평가를 임의로 조작하거나 제출할 수 없음.                  |
| **Double-Blind**      | Double-Blind Evaluation      | 면접 진행 중에는 타 면접관의 채점표를 가려 상호 동조를 방지하고, 제출 상태(Status)만 실시간 공유.                                 |
| **Multimodal AI**     | AI Assistance Engine         | Groq의 Llama 계열 텍스트·비전 모델을 사용하여 일정표 이미지 OCR, 실시간 STT(음성 인식), 꼬리질문 생성, 서류 마인드맵 구축을 지원. |
| **Fail-Safe**         | High Resilience              | AI 서비스 지연이나 네트워크 불안정 시에도 로컬 정규식 휴리스틱 파서와 로컬 계산 엔진이 즉시 가동되는 이중 안전망 구축.            |

---

## 🏗️ 2. 시스템 아키텍처 및 기술 스택 (System Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT TIER (React 18 + Vite)                 │
├──────────────────┬──────────────────┬─────────────────┬────────────────┤
│ Landing & Entry  │ Admin Portal     │ Interview Room  │ Leaderboard    │
│  - Role Selector │  - Criteria Lock │  - STT Console  │  - Trimmed Avg │
│  - Room Lobby    │  - Audit Logs    │  - MindMap SVG  │  - Cutoff Pass │
│  - Panel Auth    │  - Universal OCR │  - Eval Form    │  - Track Filter│
└─────────┬────────┴─────────┬────────┴────────┬────────┴────────┬───────┘
          │                  │                 │                 │
          ▼                  ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVER TIER (Node.js + Express)                 │
├────────────────────────────────────────────────────────────────────────┤
│  REST API Endpoints:                                                   │
│   • /api/auth/login, /api/auth/profile                                 │
│   • /api/rooms (CRUD & Panel Assignment)                               │
│   • /api/candidates, /api/candidates/batch, /api/candidates/:id/status │
│   • /api/evaluations/submit, /api/evaluations/audit-logs               │
│   • /api/ai/universal-parser, /api/ai/realtime-feedback                │
│   • /api/ai/qualitative-synthesis, /api/ai/mindmap                     │
│                                                                        │
│  Dual AI Orchestration Engine:                                         │
│   • Text: Groq Cloud API (Llama-3.3-70b-versatile)                    │
│   • Vision: Groq Cloud API (Llama 4 Scout)                            │
│   • Rule-based Fallback: heuristicParseUniversalData (Regex / Local)   │
└────────────────────────────────────────────────────────────────────────┘
```

### 🛠️ 기술 명세표

| 구분                    | 사용 기술 / 라이브러리                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| **Frontend**            | React 18.3, TypeScript 5.5, Tailwind CSS, Lucide Icons, Web Speech API |
| **Backend**             | Express 4.x / tsx runtime, Bundled with esbuild CommonJS               |
| **AI Pipeline**         | Groq Cloud API (Llama 3.3 Text + Llama 4 Scout Vision)                 |
| **State & Persistence** | In-Memory Cache + Persistent File / Cloud Storage                      |

---

## 💡 3. 화면별 상세 기능 및 비즈니스 로직 (Feature Specifications)

### 3.1. 랜딩 페이지 및 역할별 진입 허브 (`LandingEntryPage.tsx` & `LoginPage.tsx`)

- **플랫폼 브랜딩 및 원클릭 진입**: SmartLab 인터랙티브 브랜드 엠블럼 및 앰비언트 백그라운드.
- **2-Track 진입점**: 면접관 모드(Interviewer) vs 관리자 포털(Admin Portal) 분리.
- **어드민 보안 인증**: 마스터 인증 토큰/비밀번호 검증 및 세션 유지.
- **면접관 룸 선택 및 본인 확인 (`RoomSelectPage.tsx`, `SelectInterviewerPage.tsx`)**:
  - 개설된 면접실 목록 카드(면접실 이름, 배정된 면접관 수, 진행 상태) 확인.
  - 사전 등록된 면접관 프로필 목록 중 본인 이름을 선택하여 세션 로그인.

---

### 3.2. 어드민 포털 & 거버넌스 관리 (`AdminPortalPage.tsx`)

#### A. 평가 기준 및 가중치 확정 시스템 (Strict Governance Lock)

- **평가 항목 구성**: `id`, `name`(기술 역량, 문제 해결력, 의사소통, 태도/조직적합도 등), `description`, `weight`(기본 40/30/20/10).
- **실시간 100% 가중치 검증**: 항목 가중치 합이 정확히 100%가 되지 않으면 확정(Confirm) 버튼이 비활성화되며, 부족/초과 퍼센티지를 시각적 인디케이터로 안내.
- **프리셋 템플릿 원클릭 로드**:
  1. 개발 직무 표준형 (40% / 30% / 20% / 10%)
  2. 균등 4분할형 (25% / 25% / 25% / 25%)
  3. 협업 및 인성 중심형 (20% / 25% / 35% / 20%)
  4. 3대 핵심 지표형 (50% / 30% / 20%)
- **확정/수정 상태 머신 (Status Machine)**:
  - `isConfirmed: false` 상태에서는 전체 면접관 화면에 _"관리자가 평가 기준을 검토 중입니다. 기준 확정 전까지 평가표 작성이 잠깁니다"_ 경고 배너가 출력되고 제출이 차단됨.
  - 관리자가 **[평가 기준 확정]**을 클릭하면 `isConfirmed: true`로 전환되고 면접관들의 입력 락이 실시간 해제됨.
  - 확정 후 수정 시에는 기존 제출된 채점표와의 정합성을 위해 경고 모달을 거치며 변경 내역이 감사 로그에 남음.
- **합격 과락선(Pass Cutoff Threshold) 지정**: 최소 합격 요구 점수(예: 70.0점)를 슬라이더로 설정하여 리더보드에서 합격 안정권을 자동 식별.

#### B. 면접실(Room) 및 심사위원단(Panel) CRUD

- 면접실 이름, 1인당 배정 시간(10~120분), 심사위원 명단 일괄 텍스트 입력 (`홍길동, 이순신, 강감찬`).
- 각 방별 등록 지원자 수, 완료된 평가 수, 실시간 평가 진행률 그래프 표시.

#### C. 감사 로그 추적기 (`AdminAuditModal.tsx`)

- 어드민의 기준 확정, 가중치 변경, 지원자 추가/삭제, 방 설정 변경 이력을 타임스탬프, 변경자, 변경 상세 사유와 함께 불변(Immutable) 감사 로그로 조회.

---

### 3.3. 만능 데이터 파서 & 순차적 시간표 생성기 (`UniversalParserModal.tsx`)

#### A. 비정형 데이터 입력 및 Groq Vision OCR

- **비정형 텍스트 파싱**: 엑셀 시트 복사 텍스트, 슬래시(/) 구분 텍스트, 카카오톡 공지 텍스트 자동 토큰화.
- **이미지 비전 판독 (Multimodal Image OCR)**: 시간표 캡처 사진, 명단 이미지(PNG, JPG, WebP)를 드래그 앤 드롭하면 Base64로 인코딩하여 Groq Vision 모델로 전송. 표 구조, 격자형 타임테이블을 분석하여 인원별 이름, 트랙, 시간 추출.

#### B. 무충돌 순차적 타임슬롯 자동 스케줄링

```
[시작 시간] + [지원자 Index × (면접 시간 + 쉬는 시간)] = 자동 타임슬롯 부여
```

- 원본 데이터에 고유 시간이 지정되어 있는 경우 이를 존중하고, 미지정 시 설정된 파라미터(예: 시작 14:00, 30분 면접)에 맞춰 `14:00~14:30`, `14:35~15:05`, `15:10~15:40` 등으로 충돌 없는 스케줄을 자동 생성.

#### C. 파싱 결과 사전 편집(Preview Editor) & 1클릭 일괄 등록

- 파싱된 지원자 목록을 확인하고 이름, 트랙, 시간, 전화번호를 테이블에서 인라인 수정.
- `POST /api/candidates/batch` 트랜잭션을 통해 지원자 풀에 원자적(Atomic)으로 일괄 반영.

---

### 3.4. 지원자 대기 및 진행 관리 (`CandidateListPage.tsx`)

- **타임라인 기반 지원자 카드**: 타임슬롯, 학번, 지원 트랙 배지, 전화번호, 이메일 요약.
- **진행 상태 머신**: `대기중(PENDING)` ➔ `면접진행(IN_PROGRESS)` ➔ `평가완료(COMPLETED)` ➔ `결시/불참(ABSENT)`
- **원클릭 면접실 입장**: [면접실 입장] 클릭 시 3단 분할 실시간 면접 콘솔로 전환.

---

### 3.5. 3단 분할 실시간 면접 콘솔 (`InterviewRoom.tsx`)

```
┌───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
│     [좌측] 서류 & 마인드맵    │    [중앙] 실시간 STT & AI     │     [우측] 가중 채점표        │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ • 지원자 서류 원문 탭         │ • 면접 진행 타이머 (카운트다운) │ • 어드민 확정 기준 자동 연동   │
│ • 핵심 요약 및 이력 스니펫   │ • 실시간 음성 녹음 (STT)      │ • 0.1점 단위 슬라이더/인풋     │
│ • SVG 인터랙티브 마인드맵     │ • 답변 3줄 요약 피드          │ • 100점 만점 실시간 가중 계산 │
│   - 카테고리별 역량 노드 탐색 │ • AI 추천 심층 꼬리 질문      │ • 타 면접관 블라인드 제출 현황│
│   - 노드 클릭 시 상세 펼침    │ • 서류-답변 모순점 실시간 감지│ • 면접 종합 정성 코멘트 제출  │
└───────────────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

#### A. 좌측 패널: 서류 뷰어 & 인터랙티브 AI 마인드맵 (`InteractiveMindMap.tsx`)

- 지원 서류 원문 뷰어 및 SVG 역량 마인드맵 Engine (핵심 강점, 대표 프로젝트, 기술 스택, 검증 필요 영역 시각화).

#### B. 중앙 패널: 실시간 음성 인식 & AI 코파일럿 (`STTConsole.tsx`)

- **실시간 Web Speech STT Engine**: 발화를 실시간 텍스트 스트림으로 변환 및 타임스탬프 기록.
- **실시간 AI 인사이트 (`/api/ai/realtime-feedback`)**:
  - **주요 발언 3줄 요약**: 지원자의 장황한 답변을 핵심 논지로 축약.
  - **심층 꼬리 질문**: 답변의 진위 확인을 위한 기술적/논리적 반론 질문 3가지 제안.
  - **지원서 모순점 감지**: 지원서 경력/역할과 실제 답변 내용 간 불일치 경고.

#### C. 우측 패널: 다면 블라인드 가중 채점표 (`EvaluationForm.tsx`)

- 어드민 확정 기준 자동 연동 및 100점 만점 실시간 가중치 계산.
- 다른 면접관의 점수는 숨겨지고 오직 `[면접관 A: 제출완료]`, `[면접관 B: 작성중]` 뱃지만 공유 (Blind Protocol).

---

### 3.6. 다차원 리더보드 & 합격 선발 엔진 (`LeaderboardModal.tsx`)

#### A. 산출 공식 (Calculation Methodologies)

- **가중 절사평균 (Trimmed Mean, 권장)**: 3인 이상 평가 시, 최저점 1개와 최고점 1개를 제외 후 나머지 점수들을 가중 평균하여 편향 방지.
- **가중 평균 (Weighted Mean)**: 모든 면접관의 가중 합산 점수를 산술 평균.
- **중앙값 (Median)**: 총점 중 정중앙에 위치한 점수 채택.
- **단순 산술평균 (Arithmetic Mean)**: 가중치 없이 원점수의 평균 산출.

#### B. 고급 분석 및 내보내기

- **과락선(Cutoff) 판정**: 기준 점수 이상 시 초록색 합격권, 미달 시 주황색 과락/재검토 뱃지.
- **항목별 최고 득점자(Top Performer) Gold Badge**: 특정 항목 1위 뱃지 부여.
- **동점자 판정 룰 (Tie-breaking Engine)**: 총점 동률 시 가중치가 가장 높은 1순위 항목 득점 우위자 상위 랭크.
- **엑셀/CSV 내보내기**: 최종 집계 결과를 행정 보고용 파일로 다운로드.

---

## 💾 4. 데이터베이스 및 엔터프라이즈 데이터 모델 (Data Schema)

```typescript
// 1. 관리자 평가 거버넌스 설정
export interface CriteriaConfig {
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  formula: "trimmed" | "weighted" | "median" | "mean";
  passCutoff: number; // 예: 70.0점
  items: EvaluationCriterion[];
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  weight: number; // 합계 100%
  description: string;
  maxScore: number; // 100
}

// 2. 면접실 및 면접관 구성
export interface InterviewRoomItem {
  id: string;
  name: string;
  title: string;
  minutesPerPerson: number;
  panelCount: number;
  interviewers: { id: string; name: string; role: string }[];
  criteria: EvaluationCriterion[];
  isConfirmed: boolean;
  status: "READY" | "IN_PROGRESS" | "COMPLETED";
}

// 3. 지원자 프로필 및 실시간 면접 데이터
export interface Candidate {
  id: string;
  roomId?: string;
  name: string;
  track: string;
  studentId: string;
  phone: string;
  email: string;
  timeslot: {
    start: string;
    end: string;
    room: string;
  };
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABSENT";
  interviewers: string[];
  documents: {
    id: string;
    title: string;
    type: string;
    contentSnippet: string;
    rawText: string;
  }[];
  sttTranscript: {
    id: string;
    speaker: "interviewer" | "candidate";
    text: string;
    timestamp: string;
  }[];
  aiInsights: {
    realtimeSummaries: string[];
    tailQuestions: string[];
    contradictions: string[];
  };
}

// 4. 면접관 채점 제출 데이터
export interface EvaluationSubmission {
  id: string;
  candidateId: string;
  roomId: string;
  interviewerName: string;
  submittedAt: string;
  scores: {
    criterionId: string;
    score: number;
    criterionName: string;
    weight: number;
  }[];
  totalWeightedScore: number;
  qualitativeFeedback: {
    strengths: string;
    improvements: string;
    finalVerdict: "PASS" | "FAIL" | "HOLD";
  };
}
```

---

## 📡 5. 백엔드 API 명세서 (API Specification)

| 메서드   | 엔드포인트                     | 설명                                 | 핵심 파라미터 / 반환값                            |
| -------- | ------------------------------ | ------------------------------------ | ------------------------------------------------- |
| `POST`   | `/api/auth/login`              | 면접관/어드민 세션 로그인            | `{ username, password, role }`                    |
| `GET`    | `/api/rooms`                   | 전체 면접실 목록 및 배정 현황 조회   | `InterviewRoomItem[]`                             |
| `POST`   | `/api/rooms`                   | 신규 면접실 개설                     | `{ name, title, minutesPerPerson, interviewers }` |
| `DELETE` | `/api/rooms/:id`               | 면접실 및 연관 데이터 삭제           | `roomId`                                          |
| `GET`    | `/api/criteria`                | 어드민 확정 평가 기준 조회           | `CriteriaConfig`                                  |
| `POST`   | `/api/criteria/confirm`        | 어드민 평가 기준 및 가중치 확정      | `{ items, passCutoff, formula, confirmedBy }`     |
| `GET`    | `/api/candidates`              | 지원자 목록 조회 (방별 필터 지원)    | `?roomId=...` ➔ `Candidate[]`                     |
| `POST`   | `/api/candidates/batch`        | 파싱된 지원자 대량 일괄 등록         | `{ candidates: Candidate[], roomId }`             |
| `PATCH`  | `/api/candidates/:id/status`   | 지원자 면접 진행 상태 갱신           | `{ status: 'IN_PROGRESS' \| 'COMPLETED' }`        |
| `POST`   | `/api/evaluations/submit`      | 면접관 채점표 및 총평 제출           | `EvaluationSubmission`                            |
| `GET`    | `/api/evaluations/leaderboard` | 종합 순위 집계 및 절사평균 연산      | `{ leaderboard: LeaderboardItem[], formula }`     |
| `POST`   | `/api/ai/universal-parser`     | 비정형 텍스트/이미지 시간표 파싱     | `{ rawInput, imageBase64, config }`               |
| `POST`   | `/api/ai/realtime-feedback`    | STT 대화록 기반 꼬리질문/요약 생성   | `{ transcript, candidateProfile }`                |
| `POST`   | `/api/ai/mindmap`              | 지원서 기반 SVG 마인드맵 데이터 추출 | `{ candidateId, documents }`                      |

---

## 🚀 6. 시작하기 (Getting Started)

### 사전 요구사항

- Node.js (v18.x 이상 권장)
- npm 또는 bun

### 1) 저장소 클론 및 패키지 설치

```bash
git clone <this-repository-url>
cd <repository-name>
npm install
```

### 2) 개발 서버 실행

```bash
npm run dev
```

### 3) 프로덕션 빌드

```bash
npm run build
```

---

## 🎨 Build with Lovable

This project is connected to [Lovable](https://lovable.dev).

- **Ship faster**: Describe what you want to build and Lovable handles the code.
- **Stay in sync**: Every change made in Lovable is committed straight to this repository.
- **Full ownership**: This code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.
- Continue developing in the [Lovable editor](https://lovable.dev/projects/8946f89b-3477-41c7-9fa3-8f0df7e887c5).

---

<div align="center">
  <sub>Built with ❤️ for SmartLab Interview Platform.</sub>
</div>
