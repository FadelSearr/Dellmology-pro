import { NextResponse } from 'next/server'

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'
const ML_ENGINE_KEY = process.env.ML_ENGINE_KEY || ''

export async function GET() {
  try {
    const url = new URL(`${ML_ENGINE_URL}/api/admin/audit/verify`)

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ML_ENGINE_KEY}`,
      },
    })
    const json = await resp.json()
    return NextResponse.json(json, { status: resp.status })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'unknown' }, { status: 500 })
  }
}
