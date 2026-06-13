// src/services/supabaseClient.ts
// ─────────────────────────────────────────────────────────────────────────────
// Supabase browser client — uses the PUBLISHABLE anon key only.
//
// ██████████████████████████████████████████████████████████████████████████
// ██  SECURITY CONTRACT — READ BEFORE MODIFYING THIS FILE               ██
// ██                                                                     ██
// ██  1. ONLY the anon (publishable) key belongs in the frontend.        ██
// ██     This key is intentionally public; it is scoped by Row Level     ██
// ██     Security (RLS) policies that block access to correct_answer.    ██
// ██                                                                     ██
// ██  2. The SERVICE ROLE (secret) key MUST NEVER be placed in:         ██
// ██       • Any VITE_* environment variable                             ██
// ██       • Any file inside the /src directory                          ██
// ██       • Any file committed to the repository                        ██
// ██     The service role key bypasses ALL RLS policies, which would     ██
// ██     expose correct exam answers to any user — destroying the        ██
// ██     integrity of the entire assessment platform.                    ██
// ██                                                                     ██
// ██  3. Correct answers are NEVER fetched by the client. Scoring is     ██
// ██     handled server-side via the Supabase Edge Function at           ██
// ██     /functions/v1/score (Deno, service role, no client access).     ██
// ██                                                                     ██
// ██  Reference: ARCHITECTURE.md §1.1, §7 — SECURITY.md §2              ██
// ██████████████████████████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Environment variable validation ───────────────────────────────────────────

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error(
    '[NihonSync] Missing VITE_SUPABASE_URL.\n' +
    'Copy .env.example to .env.local and set the correct value.',
  )
}

if (!supabaseAnonKey) {
  throw new Error(
    '[NihonSync] Missing VITE_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env.local and set the correct value.',
  )
}

// Development-only guard: catch accidental leaks of the service role key.
// The service role key format begins with "sb_secret_" in Supabase's
// new key format, or is a long JWT that decodes to role:"service_role".
// Either way, it must NEVER end up in a VITE_* variable.
if (import.meta.env.DEV) {
  if (
    supabaseAnonKey.startsWith('sb_secret_') ||
    supabaseAnonKey.includes('service_role')
  ) {
    throw new Error(
      '[NihonSync] ⛔ CRITICAL SECURITY VIOLATION ⛔\n' +
      'VITE_SUPABASE_ANON_KEY appears to contain the SERVICE ROLE (secret) key.\n' +
      'This key bypasses Row Level Security and would expose correct answers.\n' +
      'Use ONLY the publishable anon key in frontend environment variables.\n' +
      'The service role key belongs exclusively in Supabase Edge Functions.',
    )
  }
}

// ── Client instantiation ───────────────────────────────────────────────────────

/**
 * The singleton Supabase browser client.
 *
 * Configured with the PUBLISHABLE anon key only.
 * All database access is scoped by RLS — the `correct_answer` column and
 * the `explanation` column are never returned to this client.
 *
 * For authenticated users, the Supabase Auth session JWT is attached
 * automatically by the client on every request.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in localStorage so the user stays logged in
    // across page refreshes. Safe for the anon/user JWT; the service role
    // key is never stored here.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      // Identifies the client in Supabase logs — useful for debugging.
      'x-nihonsync-client': 'web-frontend',
    },
  },
})

// ── Type re-export convenience ─────────────────────────────────────────────────
// Re-export the SupabaseClient type so other modules can type-check against it
// without a direct @supabase/supabase-js import everywhere.
export type { SupabaseClient }
