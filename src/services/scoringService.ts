// src/services/scoringService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Submits completed exam answers to the Supabase Edge Function for
// server-authoritative scoring.
//
// SECURITY CONTRACT:
//   - Answers are sent TO the server; correct answers NEVER come back
//     in a form the client can use to cheat.
//   - The Edge Function uses the service role key (server-only) to read
//     correct_answer from the DB. This service uses only the anon key.
//   - This file must NEVER import answer data or perform any local
//     comparison of user answers against correct answers.
//
// Reference: ARCHITECTURE.md §6, §7 — SECURITY.md §2
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient'
import type { ScoringRequest, ScoringResult, ServiceResult } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Timeout in ms for the scoring Edge Function call (ARCHITECTURE.md §11.3) */
const SCORING_TIMEOUT_MS = 15_000

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Submit a completed exam to the Edge Function for server-side scoring.
 *
 * Implements a hard timeout so the UI never hangs indefinitely.
 * On timeout or network failure, returns a typed error — the caller
 * is responsible for showing a retry UI.
 *
 * @param request - The session ID, set ID, and array of user answers
 * @returns A ServiceResult containing the full ScoringResult on success
 */
export async function submitForScoring(
  request: ScoringRequest,
): Promise<ServiceResult<ScoringResult>> {
  // Validate before sending — catch obvious client bugs early
  if (!request.session_id) {
    return { success: false, error: 'Invalid session: missing session ID.' }
  }
  if (!request.set_id) {
    return { success: false, error: 'Invalid session: missing set ID.' }
  }
  if (!request.answers || request.answers.length === 0) {
    return { success: false, error: 'No answers to submit.' }
  }

  // Race the Edge Function call against a hard timeout
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

/**
 * Invokes the Supabase Edge Function at /functions/v1/score
 * The function name 'score' matches supabase/functions/score/index.ts
 */
async function callScoringFunction(
  request: ScoringRequest,
): Promise<ServiceResult<ScoringResult>> {
  const { data, error } = await supabase.functions.invoke<ScoringResult>('score', {
    body: request,
  })

  if (error) {
    console.error('[scoringService] Edge Function error:', error.message)

    // Distinguish between network errors and application-level rejections
    const isNetworkError =
      error.message.toLowerCase().includes('fetch') ||
      error.message.toLowerCase().includes('network')

    return {
      success: false,
      error: isNetworkError
        ? 'Network error — please check your connection and try again.'
        : `Scoring failed: ${error.message}`,
    }
  }

  if (!data) {
    return {
      success: false,
      error: 'Scoring returned an empty response. Please try again.',
    }
  }

  // Validate the response shape before trusting it
  const validated = validateScoringResult(data)
  if (!validated.success) {
    console.error('[scoringService] Invalid scoring response shape:', data)
    return validated
  }

  return { success: true, data }
}

/**
 * Returns a promise that rejects after `ms` milliseconds.
 * Used with Promise.race to implement a hard timeout.
 */
function timeoutRejection(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('SCORING_TIMEOUT')), ms),
  )
}

/**
 * Runtime validation of the ScoringResult shape.
 * Guards against malformed Edge Function responses.
 */
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
  if (typeof d.passed !== 'boolean') {
    return { success: false, error: 'Scoring response missing passed flag.' }
  }
  if (!Array.isArray(d.scored_questions)) {
    return { success: false, error: 'Scoring response missing scored_questions.' }
  }

  return { success: true, data: data as ScoringResult }
}

// ── Keep-warm ping ────────────────────────────────────────────────────────────

/**
 * Pings the Edge Function keep-warm endpoint.
 * Called every 4 minutes during an active exam to avoid cold-start latency.
 * (ARCHITECTURE.md §11.3)
 *
 * Silently swallows all errors — a failed ping has no user-visible effect.
 */
export async function pingEdgeFunction(): Promise<void> {
  try {
    await supabase.functions.invoke('score/ping', { method: 'GET' } as never)
  } catch {
    // Intentionally silent — ping failure must never surface to the user
  }
}
