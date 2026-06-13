// src/hooks/useEdgeFunctionPing.ts
// Fires a keep-warm ping every 4 minutes while an exam is active.
// Prevents cold-start latency on the scoring Edge Function.
// ARCHITECTURE.md §11.3

import { useEffect } from 'react'
import { pingEdgeFunction } from '../services/scoringService'
import type { ExamStatus } from '../types'

const PING_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes

export function useEdgeFunctionPing(status: ExamStatus): void {
  useEffect(() => {
    // Only ping while exam is actively in progress
    if (status !== 'active') return

    // Ping immediately on mount so the function is warm from the start
    pingEdgeFunction()

    const interval = setInterval(pingEdgeFunction, PING_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status])
}
