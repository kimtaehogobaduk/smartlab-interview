export interface EvaluationCriterion {
  id: string;
  name: string;
  weight: number;
  description: string;
  maxScore: number;
}

export type Formula = "trimmed" | "weighted" | "median" | "mean";

export interface CriteriaConfig {
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  formula: Formula;
  passCutoff: number;
  items: EvaluationCriterion[];
}

export interface Interviewer {
  id: string;
  name: string;
  role: string;
}

export interface InterviewRoomItem {
  id: string;
  name: string;
  title: string;
  minutesPerPerson: number;
  interviewers: Interviewer[];
  status: "READY" | "IN_PROGRESS" | "COMPLETED";
}

export type CandidateStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ABSENT";

export interface CandidateDocument {
  id: string;
  title: string;
  type: string;
  contentSnippet: string;
  rawText: string;
}

export interface TranscriptLine {
  id: string;
  speaker: "interviewer" | "candidate";
  text: string;
  timestamp: string;
}

export interface MindMapNode {
  id: string;
  category: "STRENGTH" | "PROJECT" | "TECH" | "VERIFY";
  label: string;
  evidence: string;
}

export interface Candidate {
  id: string;
  roomId: string;
  name: string;
  track: string;
  studentId: string;
  phone: string;
  email: string;
  timeslot: { start: string; end: string; room: string };
  status: CandidateStatus;
  documents: CandidateDocument[];
  sttTranscript: TranscriptLine[];
  aiInsights: {
    realtimeSummaries: string[];
    tailQuestions: string[];
    contradictions: string[];
  };
  mindMap: MindMapNode[];
}

export interface EvaluationSubmission {
  id: string;
  candidateId: string;
  roomId: string;
  interviewerName: string;
  submittedAt: string;
  scores: {
    criterionId: string;
    criterionName: string;
    score: number;
    bonusPoints: number;
    weight: number;
  }[];
  totalWeightedScore: number;
  qualitativeFeedback: {
    strengths: string;
    improvements: string;
  };
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface ParsedCandidateRow {
  name: string;
  track: string;
  studentId: string;
  phone: string;
  email: string;
  start: string;
  end: string;
}
