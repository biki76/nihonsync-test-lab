import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Lazy-loaded pages — each is its own chunk (ARCHITECTURE.md §11.2)
const SetCatalogueScreen   = lazy(() => import('./pages/SetCatalogueScreen'))
const AssessmentScreen     = lazy(() => import('./pages/AssessmentScreen'))
const AdInterstitialScreen = lazy(() => import('./pages/AdInterstitialScreen'))
const ResultsDashboardScreen = lazy(() => import('./pages/ResultsDashboardScreen'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                        element={<SetCatalogueScreen />} />
          <Route path="/exam/:setId"             element={<AssessmentScreen />} />
          <Route path="/interstitial/:sessionId" element={<AdInterstitialScreen />} />
          <Route path="/results/:sessionId"      element={<ResultsDashboardScreen />} />
          {/* Fallback */}
          <Route path="*"                        element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
