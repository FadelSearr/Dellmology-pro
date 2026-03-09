import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'

    const incomingAuth = req.headers.get('authorization')
    const authHeader = incomingAuth || (process.env.ML_ENGINE_KEY ? `Bearer ${process.env.ML_ENGINE_KEY}` : '')
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (authHeader) headers['Authorization'] = authHeader

    const resp = await fetch(`${ML_ENGINE_URL}/retrain/trigger`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ success: false, error: text }, { status: resp.status })
    }

    const json = await resp.json()
    return NextResponse.json({ success: true, retrain_result: json.retrain_result })
  } catch (err) {
    console.error('Retrain trigger proxy error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
