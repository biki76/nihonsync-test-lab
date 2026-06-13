// src/stores/examStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ExamStore,
  ExamSession,
  Question,
  QuestionSet,
  AnswerOption,
  ExamStatus,
  ScoringResult,
  LocalAnswer,
} from '../types'

// ── Default / empty session ───────────────────────────────────────────────────

const DEFAULT_SESSION: ExamSession = {
  session_id: null,
  set_id: null,
  set_title: null,
  level: null,
  questions: [],
  answers: [],
  current_question_index: 0,
  started_at: null,
  status: 'idle',
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ───────────────────────────────────────────────────────
      session: DEFAULT_SESSION,
      scoringResult: null,
      isLoading: false,
      error: null,

      // ── Actions ─────────────────────────────────────────────────────────────

      /**
       * Initialise a new exam session. Called after question set is fetched.
       * The session_id comes from the DB row created server-side.
       */
      startSession: (questionSet: QuestionSet, questions: Question[]) => {
        set({
          session: {
            session_id: null,        // Populated after DB insert in questionService
            set_id: questionSet.id,
            set_title: questionSet.title,
            level: questionSet.level,
            questions,
            answers: [],
            current_question_index: 0,
            started_at: new Date().toISOString(),
            status: 'active',
          },
          scoringResult: null,
          error: null,
        })
      },

      /**
       * Record or update the user's answer for a question.
       * If the question was already answered, the answer is replaced.
       */
      recordAnswer: (questionId: string, option: AnswerOption) => {
        const { session } = get()
        const existingIndex = session.answers.findIndex(
          (a: LocalAnswer) => a.question_id === questionId,
        )

        const updatedAnswers: LocalAnswer[] =
          existingIndex >= 0
            ? session.answers.map((a: LocalAnswer, i: number) =>
                i === existingIndex
                  ? { question_id: questionId, selected_option: option }
                  : a,
              )
            : [...session.answers, { question_id: questionId, selected_option: option }]

        set({
          session: {
            ...session,
            answers: updatedAnswers,
          },
        })
      },

      /** Navigate to a specific question by index (0-based). */
      goToQuestion: (index: number) => {
        const { session } = get()
        const clamped = Math.max(0, Math.min(index, session.questions.length - 1))
        set({ session: { ...session, current_question_index: clamped } })
      },

      /** Update the exam lifecycle status. */
      setStatus: (status: ExamStatus) => {
        const { session } = get()
        set({ session: { ...session, status } })
      },

      /**
       * Store the scoring result returned by the Edge Function.
       * Also marks the session as complete.
       */
      storeScoringResult: (result: ScoringResult) => {
        const { session } = get()
        set({
          scoringResult: result,
          session: { ...session, status: 'complete' },
          isLoading: false,
          error: null,
        })
      },

      /**
       * Clear the session completely — called after results are viewed
       * or when the user explicitly starts fresh.
       */
      clearSession: () => {
        set({
          session: DEFAULT_SESSION,
          scoringResult: null,
          isLoading: false,
          error: null,
        })
      },

      /** Surface a human-readable error message. */
      setError: (error: string | null) => {
        set({ error, isLoading: false })
      },
    }),

    // ── Persist config ─────────────────────────────────────────────────────────
    {
      name: 'nihonsync-exam-session',   // localStorage key (ARCHITECTURE.md §1.2)
      storage: createJSONStorage(() => localStorage),

      /**
       * Only persist the session and scoringResult.
       * isLoading and error are transient UI state — always reset on reload.
       */
      partialize: (state) => ({
        session: state.session,
        scoringResult: state.scoringResult,
      }),
    },
  ),
)
