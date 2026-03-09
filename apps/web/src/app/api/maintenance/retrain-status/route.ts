import { NextResponse } from 'next/server'

export async function GET(){
  const url = process.env.ML_ENGINE_URL ? `${process.env.ML_ENGINE_URL}/api/maintenance/retrain-status` : `http://localhost:8000/api/maintenance/retrain-status`
  try {
    const res = await fetch(url)
    const data = await res.json().catch(() => null)
    return NextResponse.json(data, { status: res.status })
  } catch (err: unknown) {
    const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message) : String(err)
    return NextResponse.json({ error: 'Failed to fetch retrain status', message: msg }, { status: 502 })
  }
}
