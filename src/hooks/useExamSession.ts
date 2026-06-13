// src/hooks/useExamSession.ts
// Central hook that orchestrates the full exam lifecycle:
//   load questions → create session → record answers → submit → store result
// All scoring is delegated to scoringService (Edge Function).
// This hook NEVER evaluates answers locally.

import { useCallback } from 'react'
import { useExamStore } from '../stores/examStore'
import { fetchQuestions, createExamSession } from '../services/questionService'
import { submitForScoring } from '../services/scoringService'
import { logEvent } from '../services/analyticsService'
import { useEdgeFunctionPing } from './useEdgeFunctionPing'
import type { QuestionSet, AnswerOption } from '../types'

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

  // Keep Edge Function warm while exam is active
  useEdgeFunctionPing(session.status)

  // ── Start exam ──────────────────────────────────────────────────────────────

  const beginExam = useCallback(
    async (questionSet: QuestionSet) => {
      useExamStore.setState({ isLoading: true, error: null })
      setStatus('loading')

      // 1. Fetch questions (correct_answer never returned)
      const questionsResult = await fetchQuestions(questionSet.id)
      if (!questionsResult.success) {
        setError(questionsResult.error)
        setStatus('error')
        return
      }

      // 2. Create session row in DB and get the session UUID
      const sessionResult = await createExamSession(questionSet.id)
      if (!sessionResult.success) {
        setError(sessionResult.error)
        setStatus('error')
        return
      }

      // 3. Hydrate store with questions and set status to active
      startSession(questionSet, questionsResult.data)

      // 4. Patch the session_id from DB into the store
      useExamStore.setState((state) => ({
        session: { ...state.session, session_id: sessionResult.data },
        isLoading: false,
      }))

      // 5. Log analytics event
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
    async (questionId: string, option: AnswerOption) => {
      recordAnswer(questionId, option)

      if (session.session_id) {
        await logEvent(
          'question_answered',
          { question_id: questionId, selected_option: option },
          session.session_id,
          'anonymous',
        )
      }
    },
    [recordAnswer, session.session_id],
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

    // Log submission attempt before the call
    await logEvent(
      'exam_submitted',
      { set_id, answer_count: answers.length },
      session_id,
      'anonymous',
    )

    // Call Edge Function — never evaluate answers locally
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

    // Store the scored result — navigating to results is the caller's job
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

  const currentAnswer =
    session.answers.find(
      (a) => a.question_id === currentQuestion?.id,
    )?.selected_option ?? null

  const isLastQuestion =
    session.current_question_index === session.questions.length - 1

  const answeredCount = session.answers.length
  const totalQuestions = session.questions.length
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0

  return {
    // State
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

    // Actions
    beginExam,
    answerQuestion,
    submitExam,
    nextQuestion,
    prevQuestion,
    goToQuestion,
    clearSession,
  }
}
