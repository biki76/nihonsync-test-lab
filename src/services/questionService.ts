// src/services/questionService.ts
// Fetches question sets and questions from Supabase.
// SECURITY: Only queries the `questions_public` view — correct_answer_id
// and explanation are stripped at the DB layer by the view definition.

import { supabase } from './supabaseClient'
import type { QuestionSet, Question, ServiceResult, JlptLevel } from '../types'

// ── Question Sets ─────────────────────────────────────────────────────────────

export async function fetchQuestionSets(
  level?: JlptLevel,
): Promise<ServiceResult<QuestionSet[]>> {
  try {
    let query = supabase
      .from('question_sets')
      .select('id, title, level, status, set_number, is_published, question_count')
      .eq('status', 'published')
      .order('set_number', { ascending: true })

    if (level) {
      query = query.eq('level', level)
    }

    const { data, error } = await query

    if (error) {
      console.error('[questionService] fetchQuestionSets error:', error.message)
      return { success: false, error: 'Failed to load question sets. Please try again.' }
    }

    return { success: true, data: (data ?? []) as QuestionSet[] }
  } catch (err) {
    console.error('[questionService] fetchQuestionSets unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function fetchQuestionSetById(
  setId: string,
): Promise<ServiceResult<QuestionSet>> {
  try {
    const { data, error } = await supabase
      .from('question_sets')
      .select('id, title, level, status, set_number, is_published, question_count')
      .eq('id', setId)
      .eq('status', 'published')
      .single()

    if (error) {
      console.error('[questionService] fetchQuestionSetById error:', error.message)
      return { success: false, error: 'Question set not found.' }
    }

    return { success: true, data: data as QuestionSet }
  } catch (err) {
    console.error('[questionService] fetchQuestionSetById unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ── Questions ─────────────────────────────────────────────────────────────────

export async function fetchQuestions(
  setId: string,
): Promise<ServiceResult<Question[]>> {
  try {
    const { data, error } = await supabase
      .from('questions_public')
      .select(
        'id, set_id, question_number, question_text, japanese_text, target_word, options, section, difficulty',
      )
      .eq('set_id', setId)
      .order('question_number', { ascending: true })

    if (error) {
      console.error('[questionService] fetchQuestions error:', error.message)
      return { success: false, error: 'Failed to load questions. Please try again.' }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No questions found for this set.' }
    }

    return { success: true, data: data as Question[] }
  } catch (err) {
    console.error('[questionService] fetchQuestions unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ── Session creation ───────────────────────────────────────────────────────────

export async function createExamSession(
  setId: string,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        set_id: setId,
        user_type: 'anonymous',
        current_question_index: 0,
        answers: {},
        is_completed: false,
        is_abandoned: false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[questionService] createExamSession error:', error.message)
      return { success: false, error: 'Failed to start exam session.' }
    }

    return { success: true, data: data.id as string }
  } catch (err) {
    console.error('[questionService] createExamSession unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function updateSessionAnswers(
  sessionId: string,
  answers: Record<string, string>,
  currentQuestionIndex: number,
): Promise<ServiceResult<true>> {
  try {
    const { error } = await supabase
      .from('exam_sessions')
      .update({
        answers,
        current_question_index: currentQuestionIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      console.error('[questionService] updateSessionAnswers error:', error.message)
      return { success: false, error: 'Failed to save progress.' }
    }

    return { success: true, data: true }
  } catch (err) {
    console.error('[questionService] updateSessionAnswers unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
