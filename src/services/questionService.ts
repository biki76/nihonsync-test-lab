// src/services/questionService.ts
// Fetches question sets and questions from Supabase.
// SECURITY: Only queries the `questions_public` view — `correct_answer`
// and `explanation` are stripped at the DB layer by RLS + view definition.
// This service NEVER sends answers to the client for evaluation.

import { supabase } from './supabaseClient'
import type { QuestionSet, Question, ServiceResult, JlptLevel } from '../types'

// ── Question Sets ─────────────────────────────────────────────────────────────

/**
 * Fetch all published question sets, optionally filtered by JLPT level.
 * Ordered by set_number ascending for consistent display.
 */
export async function fetchQuestionSets(
  level?: JlptLevel,
): Promise<ServiceResult<QuestionSet[]>> {
  try {
    let query = supabase
      .from('question_sets')
      .select('id, level, set_number, title, is_published')
      .eq('is_published', true)
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

/**
 * Fetch a single published question set by ID.
 */
export async function fetchQuestionSetById(
  setId: string,
): Promise<ServiceResult<QuestionSet>> {
  try {
    const { data, error } = await supabase
      .from('question_sets')
      .select('id, level, set_number, title, is_published')
      .eq('id', setId)
      .eq('is_published', true)
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

/**
 * Fetch all questions for a given set from the `questions_public` view.
 *
 * SECURITY NOTE: `questions_public` is a DB view that explicitly excludes
 * `correct_answer` and `explanation`. Even if RLS were misconfigured,
 * the view definition provides a second layer of answer protection.
 * The client NEVER receives correct answers through this function.
 */
export async function fetchQuestions(
  setId: string,
): Promise<ServiceResult<Question[]>> {
  try {
    const { data, error } = await supabase
      .from('questions_public')
      .select(
        'id, set_id, sentence, target_word, option_a, option_b, option_c, option_d',
      )
      .eq('set_id', setId)
      .order('id', { ascending: true })

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

/**
 * Create an exam session row in the DB and return its generated ID.
 * The session is created with status incomplete — scoring updates it.
 */
export async function createExamSession(
  setId: string,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase
      .from('exam_sessions')
      .insert({
        set_id: setId,
        user_type: 'anonymous',
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
