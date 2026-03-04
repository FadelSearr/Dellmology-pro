import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || '').toUpperCase();
    const limit = Math.min(100, Math.max(5, Number(searchParams.get('limit') || 25)));

    const values: Array<string | number> = [limit];
    let where = "trade_type IN ('NEGO','CROSS')";
    if (symbol) {
      where += ' AND symbol = $2';
      values.push(symbol);
    }

    const query = `
      SELECT
        timestamp,
        symbol,
        price,
        volume,
        trade_type,
        (price * volume) AS notional
      FROM trades
      WHERE ${where}
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const result = await db.query(query, values);
    const rows = result.rows || [];

    const summary = rows.reduce(
      (acc, row) => {
        const volume = Number(row.volume || 0);
        const notional = Number(row.notional || 0);
        acc.total_volume += volume;
        acc.total_notional += notional;
        if (String(row.trade_type || '').toUpperCase() === 'NEGO') acc.nego_count += 1;
        if (String(row.trade_type || '').toUpperCase() === 'CROSS') acc.cross_count += 1;
        return acc;
      },
      { total_volume: 0, total_notional: 0, nego_count: 0, cross_count: 0 },
    );

    return NextResponse.json({
      symbol: symbol || null,
      count: rows.length,
      summary,
      items: rows,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch negotiated monitor',
        details: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 },
    );
  }
}
