import { NextResponse } from 'next/server'

export async function GET(){
  const url = process.env.ML_ENGINE_URL ? `${process.env.ML_ENGINE_URL}/api/maintenance/retrain-status` : `http://localhost:8000/api/maintenance/retrain-status`
  try {
    const res = await fetch(url)
    const data = await res.json().catch(() => null)
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch retrain status', message: String(err?.message || err) }, { status: 502 })
  }
}
