import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const symbol = body.symbol
    const top_k = body.top_k || 10
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'
    const incomingAuth = req.headers.get('authorization')
    const authHeader = incomingAuth || (process.env.ML_ENGINE_KEY ? `Bearer ${process.env.ML_ENGINE_KEY}` : '')
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (authHeader) headers['Authorization'] = authHeader

    const resp = await fetch(`${ML_ENGINE_URL}/xai/explain`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify({ symbol, top_k }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ success: false, error: text }, { status: resp.status })
    }

    const json = await resp.json()
    return NextResponse.json({ success: true, explanation: json.explanation })
  } catch (err) {
    console.error('XAI proxy error', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
