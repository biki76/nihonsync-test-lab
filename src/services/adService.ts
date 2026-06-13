// src/services/adService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Adsterra interstitial wrapper.
//
// GUARANTEES (ARCHITECTURE.md §13.1):
//   1. The ad script is NEVER in the initial bundle — loaded dynamically only
//      when showInterstitial() is called.
//   2. A hard 4-second timeout ensures navigation to results is NEVER blocked
//      by a slow, failed, or missing ad.
//   3. The AdOutcome value is logged for analytics but has NO effect on
//      whether the user sees their results.
// ─────────────────────────────────────────────────────────────────────────────

import type { AdOutcome } from '../types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Hard cap on ad display time in ms (PRD §14.1) */
const AD_TIMEOUT_MS = 4_000

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to show an Adsterra interstitial ad.
 *
 * Always resolves — never rejects. The returned AdOutcome tells the caller
 * what happened, but the caller MUST navigate to results regardless of outcome.
 *
 * @returns Promise<AdOutcome> — 'completed' | 'skipped' | 'timeout' | 'error'
 */
export async function showInterstitial(): Promise<AdOutcome> {
  const zoneId = import.meta.env.VITE_ADSTERRA_ZONE_ID

  // If no zone ID is configured (e.g. development), skip silently
  if (!zoneId) {
    console.info('[adService] No VITE_ADSTERRA_ZONE_ID set — skipping ad.')
    return 'skipped'
  }

  return new Promise<AdOutcome>((resolve) => {
    // Hard timeout — fires unconditionally after AD_TIMEOUT_MS
    const timeout = setTimeout(() => {
      console.warn('[adService] Ad timed out after', AD_TIMEOUT_MS, 'ms')
      resolve('timeout')
    }, AD_TIMEOUT_MS)

    const safeResolve = (outcome: AdOutcome) => {
      clearTimeout(timeout)
      resolve(outcome)
    }

    try {
      loadAdsterraScript(zoneId, {
        onCompleted: () => safeResolve('completed'),
        onSkipped: () =>
