// src/services/scoringService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Submits completed exam answers to the Supabase Edge Function for
// server-authoritative scoring, then fetches the result from exam_results.
//
// SECURITY CONTRACT:
//   - Answers are sent TO the server; correct answers NEVER come back
//     in a form the client can use to cheat during the exam.
//   - The Edge Function uses the service role key (server-only) to read
//     correct_answer_id from the DB. This service uses only the anon key.
//   - This file must NEVER import answer data or perform any local
//     comparison of user answers against correct answers.
//
// Reference: ARCHITECTURE.md §6, §7 — SECURITY.md §2
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient'
import type { ScoringRequest, ScoringResult, ServiceResult } from '../types'

const SCORING_TIMEOUT_MS = 15_000

export async function submitForScoring(
  request: ScoringRequest,
): Promise<ServiceResult<ScoringResult>> {
  if (!request.session_id) {
    return { success: false, error: 'Invalid session: missing session ID.' }
  }
  if (!request.set_id) {
    return { success: false, error: 'Invalid session: missing set ID.' }
  }
  if (!request.answers || Object.keys(request.answers).length === 0) {
    return { success: false, error: 'No answers to submit.' }
  }

  try {
    const result = await Promise.race([
      callScoringFunction(request),
      timeoutRejection(SCORING_TIMEOUT_MS),
    ])
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[scoringService] submitForScoring failed:', message)

    if (message === 'SCORING_TIMEOUT') {
      return {
        success: false,
        error:
          'Scoring is taking longer than expected. Please check your connection and try again.',
      }
    }

    return {
      success: false,
      error: 'Failed to submit your exam. Please try again.',
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function callScoringFunction(
  request: ScoringRequest,
): Promise<ServiceResult<ScoringResult>> {
  // Step 1: invoke the Edge Function to perform server-side scoring
  const { error: invokeError } = await supabase.functions.invoke('score', {
    body: request,
  })

  if (invokeError) {
    console.error('[scoringService] Edge Function error:', invokeError.message)

    const isNetworkError =
      invokeError.message.toLowerCase().includes('fetch') ||
      invokeError.message.toLowerCase().includes('network')

    return {
      success: false,
      error: isNetworkError
        ? 'Network error — please check your connection and try again.'
        : `Scoring failed: ${invokeError.message}`,
    }
  }

  // Step 2: fetch the resulting row from exam_results by session_id
  const { data, error: fetchError } = await supabase
    .from('exam_results')
    .select('session_id, score, total, percentage, performance_band, section_breakdown, question_results, calculated_at')
    .eq('session_id', request.session_id)
    .single()

  if (fetchError || !data) {
    console.error('[scoringService] Failed to fetch exam_results:', fetchError?.message)
    return {
      success: false,
      error: 'Scoring completed but results could not be retrieved. Please try again.',
    }
  }

  const validated = validateScoringResult(data)
  if (!validated.success) {
    console.error('[scoringService] Invalid scoring response shape:', data)
    return validated
  }

  return { success: true, data: data as ScoringResult }
}

function timeoutRejection(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('SCORING_TIMEOUT')), ms),
  )
}

function validateScoringResult(
  data: unknown,
): ServiceResult<ScoringResult> {
  if (typeof data !== 'object' || data === null) {
    return { success: false, error: 'Invalid scoring response format.' }
  }

  const d = data as Record<string, unknown>

  if (typeof d.session_id !== 'string') {
    return { success: false, error: 'Scoring response missing session_id.' }
  }
  if (typeof d.score !== 'number') {
    return { success: false, error: 'Scoring response missing score.' }
  }
  if (typeof d.total !== 'number') {
    return { success: false, error: 'Scoring response missing total.' }
  }
  if (typeof d.percentage !== 'number') {
    return { success: false, error: 'Scoring response missing percentage.' }
  }
  if (!Array.isArray(d.question_results)) {
    return { success: false, error: 'Scoring response missing question_results.' }
  }

  return { success: true, data: data as ScoringResult }
}

// ── Keep-warm ping ────────────────────────────────────────────────────────────

export async function pingEdgeFunction(): Promise<void> {
  try {
    await supabase.functions.invoke('score/ping', { method: 'GET' } as never)
  } catch {
    // Intentionally silent — ping failure must never surface to the user
  }
}
