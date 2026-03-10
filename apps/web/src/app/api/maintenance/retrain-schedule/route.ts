import { NextRequest, NextResponse } from 'next/server'

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const incomingAuth = request.headers.get('authorization') || ''
    const token = incomingAuth || (process.env.NEXT_PUBLIC_ADMIN_TOKEN ? `Bearer ${process.env.NEXT_PUBLIC_ADMIN_TOKEN}` : '')
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (token) headers['authorization'] = token

    const resp = await fetch(`${ML_ENGINE_URL}/api/maintenance/retrain-schedule`, {
      method: 'POST', headers, body: JSON.stringify(body)
    })
    const json = await resp.json().catch(() => null)
    return NextResponse.json(json, { status: resp.status })
  } catch (err: unknown) {
    const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
    return NextResponse.json({ error: 'Failed to proxy retrain schedule', message: msg }, { status: 500 })
  }
}
