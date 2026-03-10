import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cnn
 * Body: { action: 'train' | 'predict', symbol: string }
 * Forwards the request to the ML engine service.
 */
export async function POST(req: NextRequest) {
  try {
    const { action, symbol } = await req.json();
    if (!action || !symbol) {
      return NextResponse.json({ error: 'action and symbol required' }, { status: 400 });
    }

    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001';
    const endpoint = action === 'train' ? '/cnn/train' : '/cnn/predict';

    const response = await fetch(`${ML_ENGINE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
      },
      body: JSON.stringify({ symbol }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ML Engine error: ${response.status} ${text}`);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('CNN API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
