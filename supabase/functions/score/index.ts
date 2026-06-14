// supabase/functions/score/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScoringRequestBody {
  session_id: string
  set_id: string
  answers: Record<string, string>
}

interface QuestionRow {
  id: string
  options: { id: string; text: string }[]
  correct_answer_id: string
  explanation: string
  section: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body: ScoringRequestBody = await req.json()
    const { session_id, set_id, answers } = body

    if (!session_id || !set_id || !answers) {
      return jsonResponse({ error: 'Missing required fields: session_id, set_id, answers' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id, set_id, is_completed, result_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return jsonResponse({ error: 'Session not found.' }, 404)
    }

    if (session.set_id !== set_id) {
      return jsonResponse({ error: 'Session does not match the provided set.' }, 400)
    }

    if (session.is_completed && session.result_id) {
      const { data: existingResult } = await supabase
        .from('exam_results')
        .select('*')
        .eq('id', session.result_id)
        .single()

      if (existingResult) {
        return jsonResponse(existingResult, 200)
      }
    }

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, options, correct_answer_id, explanation, section')
      .eq('set_id', set_id)
      .order('question_number', { ascending: true })

    if (questionsError || !questions || questions.length === 0) {
      return jsonResponse({ error: 'Failed to load questions for scoring.' }, 500)
    }

    const questionResults = (questions as QuestionRow[]).map((q) => {
      const selectedOptionId = answers[q.id] ?? null
      const isCorrect = selectedOptionId === q.correct_answer_id

      return {
        question_id: q.id,
        selected_option_id: selectedOptionId,
        correct_option_id: q.correct_answer_id,
        is_correct: isCorrect,
        explanation: q.explanation,
        section: q.section,
      }
    })

    const total = questionResults.length
    const score = questionResults.filter((r) => r.is_correct).length
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0

    let performanceBand: string
    if (percentage >= 90) performanceBand = 'excellent'
    else if (percentage >= 70) performanceBand = 'good'
    else if (percentage >= 50) performanceBand = 'fair'
    else performanceBand = 'needs_improvement'

    const sectionMap = new Map<string, { correct: number; total: number }>()
    for (const r of questionResults) {
      const entry = sectionMap.get(r.section) ?? { correct: 0, total: 0 }
      entry.total += 1
      if (r.is_correct) entry.correct += 1
      sectionMap.set(r.section, entry)
    }
    const sectionBreakdown = Array.from(sectionMap.entries()).map(([section, v]) => ({
      section,
      correct: v.correct,
      total: v.total,
    }))

    const cleanedQuestionResults = questionResults.map(
      ({ section: _section, ...rest }) => rest,
    )

    const { data: resultRow, error: insertError } = await supabase
      .from('exam_results')
      .insert({
        session_id,
        set_id,
        score,
        total,
        percentage,
        performance_band: performanceBand,
        section_breakdown: sectionBreakdown,
        question_results: cleanedQuestionResults,
        calculated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError || !resultRow) {
      console.error('Failed to insert exam_results:', insertError)
      return jsonResponse({ error: 'Failed to save scoring results.' }, 500)
    }

    await supabase
      .from('exam_sessions')
      .update({
        is_completed: true,
        result_id: resultRow.id,
        answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)

    return jsonResponse(resultRow, 200)
  } catch (err) {
    console.error('Unexpected error in score function:', err)
    return jsonResponse({ error: 'Internal server error.' }, 500)
  }
})

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
