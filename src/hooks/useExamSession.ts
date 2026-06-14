// src/hooks/useExamSession.ts
// Central hook that orchestrates the full exam lifecycle:
//   load questions -> create session -> record answers -> submit -> store result
// All scoring is delegated to scoringService (Edge Function).
// This hook NEVER evaluates answers locally.

import { useCallback } from 'react'
import { useExamStore } from '../stores/examStore'
import { fetchQuestions, createExamSession, updateSessionAnswers } from '../services/questionService'
import { submitForScoring } from '../services/scoringService'
import { logEvent } from '../services/analyticsService'
import { useEdgeFunctionPing } from './useEdgeFunctionPing'
import type { QuestionSet } from '../types'

export function useExamSession() {
  const {
    session,
    scoringResult,
    isLoading,
    error,
    startSession,
    recordAnswer,
    goToQuestion,
    setStatus,
    storeScoringResult,
    clearSession,
    setError,
  } = useExamStore()

  useEdgeFunctionPing(session.status)

  // ── Start exam ──────────────────────────────────────────────────────────────

  const beginExam = useCallback(
    async (questionSet: QuestionSet) => {
      useExamStore.setState({ isLoading: true, error: null })
      setStatus('loading')

      const questionsResult = await fetchQuestions(questionSet.id)
      if (!questionsResult.success) {
        setError(questionsResult.error)
        setStatus('error')
        return
      }

      const sessionResult = await createExamSession(questionSet.id)
      if (!sessionResult.success) {
        setError(sessionResult.error)
        setStatus('error')
        return
      }

      startSession(questionSet, questionsResult.data)

      useExamStore.setState((state) => ({
        session: { ...state.session, session_id: sessionResult.data },
        isLoading: false,
      }))

      await logEvent(
        'exam_started',
        { set_id: questionSet.id, level: questionSet.level },
        sessionResult.data,
        'anonymous',
      )
    },
    [startSession, setStatus, setError],
  )

  // ── Answer a question ───────────────────────────────────────────────────────

  const answerQuestion = useCallback(
    async (questionId: string, optionId: string) => {
      recordAnswer(questionId, optionId)

      const { session: current } = useExamStore.getState()

      if (current.session_id) {
        // Persist progress to DB (fire and forget)
        updateSessionAnswers(
          current.session_id,
          current.answers,
          current.current_question_index,
        )

        await logEvent(
          'question_answered',
          { question_id: questionId, selected_option_id: optionId },
          current.session_id,
          'anonymous',
        )
      }
    },
    [recordAnswer],
  )

  // ── Submit exam ─────────────────────────────────────────────────────────────

  const submitExam = useCallback(async () => {
    const { session_id, set_id, answers } = session

    if (!session_id || !set_id) {
      setError('Session data is missing. Please restart the exam.')
      return
    }

    setStatus('submitting')
    useExamStore.setState({ isLoading: true })

    await logEvent(
      'exam_submitted',
      { set_id, answer_count: Object.keys(answers).length },
      session_id,
      'anonymous',
    )

    const result = await submitForScoring({ session_id, set_id, answers })

    if (!result.success) {
      setStatus('error')
      setError(result.error)

      await logEvent(
        'scoring_error',
        { error: result.error },
        session_id,
        'anonymous',
      )
      return
    }

    storeScoringResult(result.data)
  }, [session, setStatus, setError, storeScoringResult])

  // ── Navigate questions ──────────────────────────────────────────────────────

  const nextQuestion = useCallback(() => {
    goToQuestion(session.current_question_index + 1)
  }, [goToQuestion, session.current_question_index])

  const prevQuestion = useCallback(() => {
    goToQuestion(session.current_question_index - 1)
  }, [goToQuestion, session.current_question_index])

  // ── Derived state ───────────────────────────────────────────────────────────

  const currentQuestion =
    session.questions[session.current_question_index] ?? null

  const currentAnswer: string | null =
    currentQuestion ? session.answers[currentQuestion.id] ?? null : null

  const isLastQuestion =
    session.current_question_index === session.questions.length - 1

  const answeredCount = Object.keys(session.answers).length
  const totalQuestions = session.questions.length
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0

  return {
    session,
    scoringResult,
    isLoading,
    error,
    currentQuestion,
    currentAnswer,
    isLastQuestion,
    answeredCount,
    totalQuestions,
    allAnswered,

    beginExam,
    answerQuestion,
    submitExam,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    clearSession,
  }
}
