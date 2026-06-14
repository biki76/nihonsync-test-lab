// src/stores/examStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ExamStore,
  ExamSession,
  Question,
  QuestionSet,
  ExamStatus,
  ScoringResult,
} from '../types'

const DEFAULT_SESSION: ExamSession = {
  session_id: null,
  set_id: null,
  set_title: null,
  level: null,
  questions: [],
  answers: {},
  current_question_index: 0,
  started_at: null,
  status: 'idle',
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set, get) => ({
      session: DEFAULT_SESSION,
      scoringResult: null,
      isLoading: false,
      error: null,

      startSession: (questionSet: QuestionSet, questions: Question[]) => {
        set({
          session: {
            session_id: null,
            set_id: questionSet.id,
            set_title: questionSet.title,
            level: questionSet.level,
            questions,
            answers: {},
            current_question_index: 0,
            started_at: new Date().toISOString(),
            status: 'active',
          },
          scoringResult: null,
          error: null,
        })
      },

      recordAnswer: (questionId: string, optionId: string) => {
        const { session } = get()
        set({
          session: {
            ...session,
            answers: {
              ...session.answers,
              [questionId]: optionId,
            },
          },
        })
      },

      goToQuestion: (index: number) => {
        const { session } = get()
        const clamped = Math.max(0, Math.min(index, session.questions.length - 1))
        set({ session: { ...session, current_question_index: clamped } })
      },

      setStatus: (status: ExamStatus) => {
        const { session } = get()
        set({ session: { ...session, status } })
      },

      storeScoringResult: (result: ScoringResult) => {
        const { session } = get()
        set({
          scoringResult: result,
          session: { ...session, status: 'complete' },
          isLoading: false,
          error: null,
        })
      },

      clearSession: () => {
        set({
          session: DEFAULT_SESSION,
          scoringResult: null,
          isLoading: false,
          error: null,
        })
      },

      setError: (error: string | null) => {
        set({ error, isLoading: false })
      },
    }),

    {
      name: 'nihonsync-exam-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
        scoringResult: state.scoringResult,
      }),
    },
  ),
)
