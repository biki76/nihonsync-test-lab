// src/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central type contract for NihonSync-Test-Lab.
// Matches the REAL Supabase schema.
// All modules import types from HERE ONLY.
// ─────────────────────────────────────────────────────────────────────────────

// ── Domain enums ──────────────────────────────────────────────────────────────

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export type UserType = 'anonymous' | 'authenticated'

export type QuestionSetStatus = 'draft' | 'published' | 'archived'

export type PerformanceBand = 'excellent' | 'good' | 'fair' | 'needs_improvement'

export type AdOutcome = 'completed' | 'skipped' | 'timeout' | 'error'

export type ExamStatus =
  | 'idle'
  | 'loading'
  | 'active'
  | 'submitting'
  | 'complete'
  | 'error'

// ── Question option ──────────────────────────────────────────────────────────

export interface QuestionOption {
  id: string
  text: string
}

// ── Database row types (client-safe, no correct_answer_id) ────────────────────

export interface QuestionSet {
  id: string
  title: string
  level: JlptLevel
  status: QuestionSetStatus
  set_number: number
  is_published: boolean
  question_count: number
}

export interface Question {
  id: string
  set_id: string
  question_number: number
  question_text: string
  japanese_text: string
  target_word: string
  options: QuestionOption[]
  section: string
  difficulty: number
}

// ── Session types ─────────────────────────────────────────────────────────────

export type AnswerMap = Record<string, string>

export interface ExamSession {
  session_id: string | null
  set_id: string | null
  set_title: string | null
  level: JlptLevel | null
  questions: Question[]
  answers: AnswerMap
  current_question_index: number
  started_at: string | null
  status: ExamStatus
}

// ── Scoring types ─────────────────────────────────────────────────────────────

export interface QuestionResult {
  question_id: string
  selected_option_id: string | null
  correct_option_id: string
  is_correct: boolean
  explanation: string
}

export interface SectionBreakdown {
  section: string
  correct: number
  total: number
}

export interface ScoringResult {
  session_id: string
  score: number
  total: number
  percentage: number
  performance_band: PerformanceBand
  section_breakdown: SectionBreakdown[]
  question_results: QuestionResult[]
  calculated_at: string
}

export interface ScoringRequest {
  session_id: string
  set_id: string
  answers: AnswerMap
}

// ── API / service response wrappers ───────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ── UI / component prop types ─────────────────────────────────────────────────

export interface SelectionCardProps {
  set: QuestionSet
  onStart: (setId: string) => void
}

export interface AnswerOptionProps {
  option: QuestionOption
  index: number
  selected: boolean
  onSelect: (optionId: string) => void
  disabled?: boolean
}

export interface ProgressBarProps {
  current: number
  total: number
}

export interface ResultSummaryProps {
  result: ScoringResult
}

// ── Zustand store interface ───────────────────────────────────────────────────

export interface ExamStore {
  session: ExamSession
  scoringResult: ScoringResult | null
  isLoading: boolean
  error: string | null

  startSession: (set: QuestionSet, questions: Question[]) => void
  recordAnswer: (questionId: string, optionId: string) => void
  goToQuestion: (index: number) => void
  setStatus: (status: ExamStatus) => void
  storeScoringResult: (result: ScoringResult) => void
  clearSession: () => void
  setError: (error: string | null) => void
}
