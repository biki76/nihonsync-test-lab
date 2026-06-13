// src/pages/AssessmentScreen.tsx
// The active exam screen. Shows one question at a time.
// SECURITY: answers are recorded locally then submitted to the Edge Function.
// Correct answers are NEVER fetched or evaluated here.

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import { useExamSession } from '../hooks/useExamSession'
import { fetchQuestionSetById } from '../services/questionService'
import type { AnswerOption, Question } from '../types'

// ── Option labels ─────────────────────────────────────────────────────────────

const OPTION_LABELS: Record<AnswerOption, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AssessmentScreen() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()

  const {
    session,
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
    clearSession,
  } = useExamSession()

  // ── Bootstrap: load the set and start the session ──────────────────────────

  useEffect(() => {
    if (!setId) {
      navigate('/', { replace: true })
      return
    }

    // If a session is already active for this set, resume it
    if (
      session.status === 'active' &&
      session.set_id === setId
    ) {
      return
    }

    // Otherwise start fresh
    async function init() {
      if (!setId) return
      const result = await fetchQuestionSetById(setId)
      if (!result.success) {
        navigate('/', { replace: true })
        return
      }
      await beginExam(result.data)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId])

  // ── After scoring completes, go to interstitial ────────────────────────────

  useEffect(() => {
    if (session.status === 'complete' && session.session_id) {
      navigate(`/interstitial/${session.session_id}`, { replace: true })
    }
  }, [session.status, session.session_id, navigate])

  // ── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    await submitExam()
    // Navigation handled by the useEffect above once status === 'complete'
  }

  // ── Abandon exam ───────────────────────────────────────────────────────────

  const handleAbandon = () => {
    clearSession()
    navigate('/', { replace: true })
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading || session.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading questions…</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (session.status === 'error' || error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Something went wrong</p>
            <p className="text-slate-400 text-sm mt-1">
              {error ?? 'Failed to load the exam.'}
            </p>
          </div>
          <button
            onClick={handleAbandon}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              bg-slate-800 text-slate-300 text-sm font-medium
              hover:bg-slate-700 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sets
          </button>
        </div>
      </div>
    )
  }

  // ── Submitting state ───────────────────────────────────────────────────────

  if (session.status === 'submitting') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-medium">Submitting your answers…</p>
          <p className="text-slate-400 text-sm">This will only take a moment.</p>
        </div>
      </div>
    )
  }

  // ── No question guard ──────────────────────────────────────────────────────

  if (!currentQuestion) {
    return null
  }

  // ── Active exam UI ─────────────────────────────────────────────────────────

  const questionNumber = session.current_question_index + 1
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-10 pb-4 sm:px-6">
        <button
          onClick={handleAbandon}
          className="flex items-center gap-1 text-slate-400 hover:text-white
            transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Exit exam"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm hidden sm:inline">Exit</span>
        </button>

        <div className="text-center">
          <p className="text-white font-semibold text-sm">
            {session.set_title}
          </p>
          <p className="text-slate-400 text-xs">
            {questionNumber} / {totalQuestions}
          </p>
        </div>

        {/* Answered count */}
        <div className="text-right">
          <p className="text-indigo-400 font-semibold text-sm">
            {answeredCount}/{totalQuestions}
          </p>
          <p className="text-slate-500 text-xs">answered</p>
        </div>
      </header>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── Question ──────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          <QuestionCard question={currentQuestion} />

          {/* ── Answer options ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {([1, 2, 3, 4] as AnswerOption[]).map((optionNum) => {
              const text = getOptionText(currentQuestion, optionNum)
              const isSelected = currentAnswer === optionNum

              return (
                <AnswerButton
                  key={optionNum}
                  label={OPTION_LABELS[optionNum]}
                  text={text}
                  selected={isSelected}
                  onSelect={() =>
                    answerQuestion(currentQuestion.id, optionNum)
                  }
                />
              )
            })}
          </div>

        </div>
      </main>

      {/* ── Bottom navigation ─────────────────────────────────────────────── */}
      <nav className="px-4 pb-8 pt-2 sm:px-6 safe-bottom">
        <div className="max-w-2xl mx-auto flex items-center gap-3">

          {/* Prev */}
          <button
            onClick={prevQuestion}
            disabled={session.current_question_index === 0}
            className="flex items-center justify-center w-12 h-12 rounded-xl
              bg-slate-800 text-slate-300 disabled:opacity-30
              hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
            aria-label="Previous question"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Submit or Next */}
          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="flex-1 flex items-center justify-center gap-2
                h-12 rounded-xl font-semibold text-sm
                bg-indigo-600 text-white
                hover:bg-indigo-500 active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150"
            >
              <Send className="w-4 h-4" />
              {allAnswered
                ? 'Submit exam'
                : `Answer all questions (${totalQuestions - answeredCount} left)`}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="flex-1 flex items-center justify-center gap-2
                h-12 rounded-xl font-semibold text-sm
                bg-slate-800 text-slate-300
                hover:bg-slate-700 active:scale-[0.98]
                transition-all duration-150"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

        </div>
      </nav>

    </div>
  )
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

function QuestionCard({ question }: { question: Question }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">
        Choose the correct reading
      </p>

      {/* Japanese sentence */}
      <p className="font-japanese text-xl sm:text-2xl text-white leading-relaxed">
        {question.sentence.split(question.target_word).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="text-indigo-400 border-b-2 border-indigo-400 pb-0.5">
                {question.target_word}
              </span>
            )}
          </span>
        ))}
      </p>
    </div>
  )
}

// ── AnswerButton ──────────────────────────────────────────────────────────────

interface AnswerButtonProps {
  label: string
  text: string
  selected: boolean
  onSelect: () => void
}

function AnswerButton({ label, text, selected, onSelect }: AnswerButtonProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl
        border transition-all duration-150 min-h-[56px]
        active:scale-[0.98]
        ${selected
          ? 'border-indigo-500 bg-indigo-500/10 text-white'
          : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500'
        }
      `}
    >
      <span className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        text-sm font-bold transition-colors
        ${selected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}
      `}>
        {label}
      </span>
      <span className="font-japanese text-base">{text}</span>
    </button>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getOptionText(question: Question, option: AnswerOption): string {
  const map: Record<AnswerOption, keyof Question> = {
    1: 'option_a',
    2: 'option_b',
    3: 'option_c',
    4: 'option_d',
  }
  return question[map[option]] as string
}
