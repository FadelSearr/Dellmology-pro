import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || '';
    const days = parseInt(searchParams.get('days') || '7');

    const query = `
      SELECT symbol, broker_id, net_value, z_score, note, time
      FROM exit_whale_events
      WHERE ($1 = '' OR symbol = $1)
        AND time >= NOW() - $2::interval
      ORDER BY time DESC
    `;
    const result = await db.query(query, [symbol, `${days} days`]);

    return NextResponse.json({ events: result.rows });
  } catch (err) {
    console.error('Error fetching exit whale events', err);
    return NextResponse.json({ error: 'failed to fetch exit whale events' }, { status: 500 });
  }
}
