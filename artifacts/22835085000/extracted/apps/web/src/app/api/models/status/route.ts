import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001'
    const incomingAuth = request.headers.get('authorization')
    const authHeader = incomingAuth || (process.env.ML_ENGINE_KEY ? `Bearer ${process.env.ML_ENGINE_KEY}` : '')
    const headers: Record<string,string> = {}
    if (authHeader) headers['Authorization'] = authHeader

    const resp = await fetch(`${ML_ENGINE_URL}/models/status`, {
      method: 'GET',
      headers: {
        ...headers,
      },
    })
    const json = await resp.json()
    return NextResponse.json(json, { status: resp.status })
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
