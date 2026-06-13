// src/pages/SetCatalogueScreen.tsx
// Home screen — lists published question sets by JLPT level.
// User picks a set → navigates to /exam/:setId

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchQuestionSets } from '../services/questionService'
import type { QuestionSet, JlptLevel } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const LEVEL_DESCRIPTIONS: Record<JlptLevel, string> = {
  N5: 'Beginner — basic kanji and vocabulary',
  N4: 'Elementary — everyday expressions',
  N3: 'Intermediate — broader reading ability',
  N2: 'Upper intermediate — near-fluent comprehension',
  N1: 'Advanced — full professional proficiency',
}

const LEVEL_COLORS: Record<JlptLevel, string> = {
  N5: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  N4: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  N3: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  N2: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  N1: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SetCatalogueScreen() {
  const navigate = useNavigate()

  const [sets, setSets] = useState<QuestionSet[]>([])
  const [activeLevel, setActiveLevel] = useState<JlptLevel>('N5')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch all published sets once on mount ──────────────────────────────────

  const loadSets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await fetchQuestionSets()

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    setSets(result.data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadSets()
  }, [loadSets])

  // ── Derived state ───────────────────────────────────────────────────────────

  const filteredSets = sets.filter((s) => s.level === activeLevel)

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartExam = (setId: string) => {
    navigate(`/exam/${setId}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="px-4 pt-12 pb-6 sm:px-6 sm:pt-16">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
              NihonSync
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            JLPT Kanji
            <br />
            <span className="text-indigo-400">Practice Tests</span>
          </h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            Choose a level and a set to begin your assessment.
          </p>
        </div>
      </header>

      {/* ── Level tabs ──────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setActiveLevel(level)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold
                  border transition-all duration-150 min-h-[44px]
                  ${activeLevel === level
                    ? LEVEL_COLORS[level]
                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
                  }
                `}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Level description */}
          <p className="mt-3 text-xs text-slate-500">
            {LEVEL_DESCRIPTIONS[activeLevel]}
          </p>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="max-w-2xl mx-auto">

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Loading question sets…</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <p className="text-white font-medium">Failed to load sets</p>
                <p className="text-slate-400 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={loadSets}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                  bg-slate-800 text-slate-300 text-sm font-medium
                  hover:bg-slate-700 transition-colors min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && filteredSets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="text-4xl font-japanese">準備中</div>
              <p className="text-white font-medium">No sets available yet</p>
              <p className="text-slate-400 text-sm">
                {activeLevel} question sets are being prepared. Check back soon.
              </p>
            </div>
          )}

          {/* Set cards */}
          {!isLoading && !error && filteredSets.length > 0 && (
            <div className="flex flex-col gap-3">
              {filteredSets.map((set) => (
                <SetCard
                  key={set.id}
                  set={set}
                  onStart={handleStartExam}
                />
              ))}
            </div>
          )}

        </div>
      </main>

    </div>
  )
}

// ── SetCard ───────────────────────────────────────────────────────────────────

interface SetCardProps {
  set: QuestionSet
  onStart: (setId: string) => void
}

function SetCard({ set, onStart }: SetCardProps) {
  return (
    <button
      onClick={() => onStart(set.id)}
      className="w-full text-left flex items-center gap-4 p-4 sm:p-5
        rounded-2xl border border-slate-800 bg-slate-900/60
        hover:border-indigo-500/50 hover:bg-slate-900
        active:scale-[0.98] transition-all duration-150
        min-h-[44px] group"
    >
      {/* Set number badge */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl
        bg-indigo-500/10 border border-indigo-500/20
        flex items-center justify-center">
        <span className="text-indigo-400 font-bold text-sm">
          #{set.set_number}
        </span>
      </div>

      {/* Title and level */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{set.title}</p>
        <p className="text-slate-400 text-sm mt-0.5">{set.level} · Practice Set</p>
      </div>

      {/* Arrow */}
      <ChevronRight className="flex-shrink-0 w-5 h-5 text-slate-600
        group-hover:text-indigo-400 transition-colors" />
    </button>
  )
}
