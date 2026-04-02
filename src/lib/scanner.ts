// src/lib/scanner.ts
// Scan engine with mock mode.
// - If SERPER_API_KEY is absent: returns 3 fixture articles
// - If GEMINI_API_KEY is absent: returns fixture analysis
// Both mock paths insert real rows into the DB for testing.

import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

type Article = {
  headline: string
  url: string
  publishedAt: string | null
  snippet: string
}

type Analysis = {
  summary: string
  score: number       // 1–5
  signal_type: string // 'news' | 'funding' | 'hiring' | 'risk' | 'other'
  opportunity: boolean
}

export type ScanResult = {
  clientId: string
  inserted: number
  skipped: number   // duplicates
  error?: string
}

// ── Mock fixtures ─────────────────────────────────────────────────────────────

function mockArticles(clientName: string): Article[] {
  return [
    {
      headline: `${clientName} announces new product launch`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
    {
      headline: `${clientName} expands into new markets`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
    {
      headline: `${clientName} reports strong quarterly results`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
  ]
}

function mockAnalysis(): Analysis {
  return {
    summary: 'Mock signal for testing. Replace with real analysis by adding GEMINI_API_KEY.',
    score: 3,
    signal_type: 'news',
    opportunity: false,
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

async function searchNews(clientName: string): Promise<Article[]> {
  if (!process.env.SERPER_API_KEY) {
    console.log(`[scanner] SERPER_API_KEY not set — using mock articles for "${clientName}"`)
    return mockArticles(clientName)
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: `"${clientName}"`,
      num: 10,
      tbs: `cdr:1,cd_min:${thirtyDaysAgo}`,
    }),
  })

  if (!res.ok) throw new Error(`Serper API error: ${res.status}`)

  const data = await res.json()
  return ((data.news ?? []) as Record<string, string>[]).map((item) => ({
    headline: item.title ?? '',
    url: item.link ?? '',
    publishedAt: item.date ?? null,
    snippet: item.snippet ?? '',
  }))
}

// ── Analysis ──────────────────────────────────────────────────────────────────

async function analyzeArticle(article: Article, clientName: string): Promise<Analysis> {
  if (!process.env.GEMINI_API_KEY) {
    console.log(`[scanner] GEMINI_API_KEY not set — using mock analysis`)
    return mockAnalysis()
  }

  const prompt = `You are analyzing a news article about a client named "${clientName}".

Article headline: ${article.headline}
Article snippet: ${article.snippet}

Respond with a JSON object only (no markdown):
{
  "summary": "2-3 sentence summary relevant to a sales rep",
  "score": <integer 1-5 where 5 = highly relevant sales opportunity>,
  "signal_type": <one of: "news" | "funding" | "hiring" | "risk" | "other">,
  "opportunity": <true if this represents a sales opportunity, false otherwise>
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  try {
    return JSON.parse(text) as Analysis
  } catch {
    return mockAnalysis()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function scanClient(clientId: string): Promise<ScanResult> {
  const adminSupabase = createAdminClient()

  const { data: client, error: clientError } = await adminSupabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { clientId, inserted: 0, skipped: 0, error: 'Client not found' }
  }

  let articles: Article[]
  try {
    articles = await searchNews(client.name)
  } catch (err) {
    return {
      clientId,
      inserted: 0,
      skipped: 0,
      error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let inserted = 0
  let skipped = 0

  for (const article of articles) {
    let analysis: Analysis
    try {
      analysis = await analyzeArticle(article, client.name)
    } catch {
      analysis = mockAnalysis()
    }

    const { error } = await adminSupabase.from('signals').insert({
      client_id: clientId,
      headline: article.headline,
      source_url: article.url,
      published_at: article.publishedAt,
      summary: analysis.summary,
      score: Math.min(5, Math.max(1, Math.round(analysis.score))),
      signal_type: analysis.signal_type,
      opportunity: analysis.opportunity,
    })

    if (error?.code === '23505') {
      skipped++
    } else if (error) {
      console.error(`[scanner] insert error for ${article.url}:`, error.message)
      skipped++
    } else {
      inserted++
    }
  }

  return { clientId, inserted, skipped }
}
