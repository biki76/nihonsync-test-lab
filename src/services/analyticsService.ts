// src/services/analyticsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Consent-gated analytics event logger.
//
// RULES (ARCHITECTURE.md §12.1):
//   1. All events are silently suppressed if consent has not been given.
//   2. Session IDs are hashed (SHA-256) before transmission — never sent raw.
//   3. This service never throws — analytics must never break the app.
//   4. All 11 instrumentation events from ARCHITECTURE.md §12.2 are typed
//      as the EventName union below.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient'
import type { UserType } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'nihonsync-consent-v1'
const CONSENT_ACCEPTED = 'accepted'

// ── Event name union ──────────────────────────────────────────────────────────

/**
 * All valid analytics event names (ARCHITECTURE.md §12.2).
 * Adding a new event requires adding it here first.
 */
export type EventName =
  | 'exam_started'
  | 'question_answered'
  | 'question_time_spent'
  | 'exam_abandoned'
  | 'exam_submitted'
  | 'scoring_error'
  | 'ad_outcome'
  | 'session_recovered'
  | 'session_recovery_failed'
  | 'publish_set'
  | 'publish_attempt_failed'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log an analytics event via the Edge Function.
 *
 * Silently returns if:
 *   - Consent has not been accepted
 *   - The Edge Function call fails (analytics must never break the app)
 *
 * @param eventName  - One of the 11 typed event names
 * @param properties - Arbitrary event metadata (no PII)
 * @param sessionId  - Raw session UUID — hashed before transmission
 * @param userType   - 'anonymous' | 'authenticated'
 */
export async function logEvent(
  eventName: EventName,
  properties: Record<string, unknown>,
  sessionId: string,
  userType: UserType,
): Promise<void> {
  // Gate 1: consent check
  if (!hasConsent()) return

  // Gate 2: hash the session ID — never transmit raw UUIDs
  let hashedSession
