// src/services/analyticsService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Consent-gated analytics event logger.
//
// RULES (ARCHITECTURE.md §12.1):
//   1. All events are silently suppressed if consent has not been given.
//   2. Session IDs are hashed (SHA-256) before transmission — never sent raw.
//   3. This service never throws — analytics must never break the app.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient'
import type { UserType } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'nihonsync-consent-v1'
const CONSENT_ACCEPTED = 'accepted'

// ── Event name union ──────────────────────────────────────────────────────────

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

export async function logEvent(
  eventName: EventName,
  properties: Record<string, unknown>,
  sessionId: string,
  userType: UserType,
): Promise<void> {
  // Gate 1: consent check
  if (!hasConsent()) return

  // Gate 2: hash the session ID — never transmit raw UUIDs
  let hashedSessionId: string
  try {
    hashedSessionId = await sha256(sessionId)
  } catch {
    return
  }

  // Gate 3: fire and forget — errors are swallowed
  try {
    await supabase.functions.invoke('log-event', {
      body: {
        event_name: eventName,
        session_id: hashedSessionId,
        user_type: userType,
        properties,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.debug('[analyticsService] Event log failed (suppressed):', err)
  }
}

// ── Consent helpers ───────────────────────────────────────────────────────────

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_ACCEPTED
  } catch {
    return false
  }
}

export function acceptConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, CONSENT_ACCEPTED)
  } catch (err) {
    console.debug('[analyticsService] Could not persist consent:', err)
  }
}

export function rejectConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch (err) {
    console.debug('[analyticsService] Could not clear consent:', err)
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
