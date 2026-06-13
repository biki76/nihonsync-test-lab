// src/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central type contract for NihonSync-Test-Lab.
// All modules import types from HERE ONLY — no inline type definitions
// in component or service files (ARCHITECTURE.md §10.2).
// ─────────────────────────────────────────────────────────────────────────────

// ── Domain enums ──────────────────────────────────────────────────────────────

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export type UserType = 'anonymous' | 'authenticated'

/** 1-indexed to match the DB column (option_a=1, option_b=2, option_c=3, option_d=4) */
export type AnswerOption = 1 | 2 | 3 | 4

export type AdOutcome = 'completed' | 'skipped' | 'timeout' | 'error'

export type ExamStatus =
  | 'idle'        // No session in progress
  | 'loading'     // Fetching question set
  | 'active'      // Exam in progress
  | 'submitting'  // Waiting for Edge Function score response
  | 'complete'    // Score received, session done
  | 'error'       // Unrecoverable error state

// ── Database row types (client-safe, no correct_answer) ───────────────────────

/**
 * A question set as returned by the `question_sets` table.
 * Only published sets are fetched by the client.
 */
export interface QuestionSet {
  id: string
  level: JlptLevel
  set_number: number
  title: string
  is_published: boolean
}

/**
 * A single question as returned by the `questions_public` DB view.
 * The `correct_answer` column is NEVER present on this type —
 * it is stripped at the database layer by RLS + the view definition.
 */
export interface Question {
  id: string
  set_id: string
  sentence: string       // Full Japanese sentence with target word
  target_word: string    // The kanji/word being tested
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  // ⛔ correct_answer is intentionally absent — server-side only
  // ⛔ explanation is intentionally absent — revealed only after scoring
}

/**
 * A question with its explanation — returned ONLY by the scoring
 * Edge Function after submission. Never fetched directly by the client.
 */
export interface ScoredQuestion extends Question {
  explanation: string
  correct_answer: AnswerOption   // Safe here: received post-submission, read-only
  user_answer: AnswerOption | null
  is_correct: boolean
}

// ── Session types ─────────────────────────────────────────────────────────────

/**
 * A single answer recorded locally during the exam.
 * Sent in bulk to the Edge Function on submission.
 */
export interface LocalAnswer {
  question_id: string
  selected_option: AnswerOption
}

/**
 * The full exam session state persisted in Zustand + localStorage.
 * localStorage key: 'nihonsync-exam-session' (ARCHITECTURE.md §1.2)
 */
export interface ExamSession {
  session_id: string | null      // UUID assigned by DB on session creation
  set_id: string | null
  set_title: string | null
  level: JlptLevel | null
  questions: Question[]
  answers: LocalAnswer[]         // Grows as user selects options
  current_question_index: number
  started_at: string | null      // ISO 8601 timestamp
  status: ExamStatus
}

// ── Scoring types ─────────────────────────────────────────────────────────────

/**
 * The response payload from POST /functions/v1/score
 * Returned by the Edge Function after server-side scoring.
 */
export interface ScoringResult {
  session_id: string
  score: number              // Correct answer count
  total: number              // Total question count
  percentage: number         // 0–100
  passed: boolean            // percentage >= 60 (PRD passing threshold)
  scored_questions: ScoredQuestion[]
  completed_at: string       // ISO 8601 timestamp
}

/**
 * The request payload sent TO POST /functions/v1/score
 */
export interface ScoringRequest {
  session_id: string
  set_id: string
  answers: LocalAnswer[]
}

// ── API / service response wrappers ───────────────────────────────────────────

/**
 * Generic result wrapper used by all service functions.
 * Avoids throwing in service layer — errors surface as typed values.
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ── UI / component prop types ─────────────────────────────────────────────────

export interface SelectionCardProps {
  set: QuestionSet
  onStart: (setId: string) => void
}

export interface AnswerOptionProps {
  label: 'A' | 'B' | 'C' | 'D'
  optionNumber: AnswerOption
  text: string
  selected: boolean
  onSelect: (option: AnswerOption) => void
  disabled?: boolean
}

export interface ProgressBarProps {
  current: number   // 1-indexed current question
  total: number
}

export interface ResultSummaryProps {
  result: ScoringResult
}

// ── Zustand store interface ───────────────────────────────────────────────────

export interface ExamStore {
  // State
  session: ExamSession
  scoringResult: ScoringResult | null
  isLoading: boolean
  error: string | null

  // Actions
  startSession: (set: QuestionSet, questions: Question[]) => void
  recordAnswer: (questionId: string, option: AnswerOption) => void
  goToQuestion: (index: number) => void
  setStatus: (status: ExamStatus) => void
  storeScoringResult: (result: ScoringResult) => void
  clearSession: () => void
  setError: (error: string | null) => void
}
