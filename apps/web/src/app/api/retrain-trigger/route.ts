import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'

    const resp = await fetch(`${ML_ENGINE_URL}/retrain/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
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
