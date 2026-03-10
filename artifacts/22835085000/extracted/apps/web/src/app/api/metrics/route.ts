import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'
    const params = req.nextUrl.search
    const resp = await fetch(`${ML_ENGINE_URL}/metrics${params}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
      },
    })

    if (!resp.ok) {
      const text = await resp.text()
      // if upstream returns 404 because symbol not found or endpoint missing, return empty list
      if (resp.status === 404) {
        return NextResponse.json({ success: true, metrics: [] });
      }
      return NextResponse.json({ success: false, error: text }, { status: resp.status })
    }

    const json = await resp.json()
    return NextResponse.json({ success: true, metrics: json.metrics })
  } catch (err) {
    console.error('Metrics proxy error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
