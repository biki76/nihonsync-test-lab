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

const AD_TIMEOUT_MS = 4_000

export async function showInterstitial(): Promise<AdOutcome> {
  const zoneId = import.meta.env.VITE_ADSTERRA_ZONE_ID

  if (!zoneId) {
    console.info('[adService] No VITE_ADSTERRA_ZONE_ID set — skipping ad.')
    return 'skipped'
  }

  return new Promise<AdOutcome>((resolve) => {
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
        onSkipped: () => safeResolve('skipped'),
        onError: () => safeResolve('error'),
      })
    } catch (err) {
      console.error('[adService] Failed to load ad script:', err)
      safeResolve('error')
    }
  })
}

interface AdsterraCallbacks {
  onCompleted: () => void
  onSkipped: () => void
  onError: () => void
}

function loadAdsterraScript(
  zoneId: string,
  callbacks: AdsterraCallbacks,
): void {
  const existingScript = document.getElementById('adsterra-interstitial')
  if (existingScript) {
    existingScript.remove()
  }

  const script = document.createElement('script')
  script.id = 'adsterra-interstitial'
  script.async = true
  script.src = `https://www.highperformanceformat.com/${zoneId}/invoke.js`

  script.onload = () => {
    try {
      const adsterra = (window as unknown as Record<string, unknown>)['adsterra']

      if (typeof adsterra === 'object' && adsterra !== null) {
        const ctrl = adsterra as Record<string, unknown>

        if (typeof ctrl['show'] === 'function') {
          ;(ctrl['show'] as (opts: Record<string, unknown>) => void)({
            onComplete: callbacks.onCompleted,
            onSkip: callbacks.onSkipped,
            onError: callbacks.onError,
          })
        } else {
          callbacks.onCompleted()
        }
      } else {
        callbacks.onCompleted()
      }
    } catch (err) {
      console.error('[adService] Error invoking Adsterra show():', err)
      callbacks.onError()
    }
  }

  script.onerror = () => {
    console.error('[adService] Adsterra script failed to load')
    callbacks.onError()
  }

  document.head.appendChild(script)
}
