import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();
    const lookbackMinutes = Math.min(240, Math.max(5, Number(searchParams.get('lookbackMinutes') || 30)));
    const maxJumpPct = Math.min(50, Math.max(1, Number(searchParams.get('maxJumpPct') || 25)));

    const result = await db.query(
      `
        SELECT id, timestamp, price::numeric AS price, volume
        FROM trades
        WHERE symbol = $1
          AND timestamp >= NOW() - ($2::text || ' minutes')::interval
        ORDER BY timestamp ASC
        LIMIT 2000
      `,
      [symbol, lookbackMinutes],
    );

    const rows = result.rows;
    if (!rows.length) {
      return NextResponse.json({
        success: true,
        symbol,
        contaminated: false,
        checked_points: 0,
        issues: [],
        reason: 'No recent trade data',
        checked_at: new Date().toISOString(),
      });
    }

    const issues: Array<{ id: string; type: 'PRICE_JUMP' | 'INVALID_VALUE'; detail: string }> = [];
    let previousPrice: number | null = null;

    for (const row of rows) {
      const price = Number(row.price || 0);
      const volume = Number(row.volume || 0);

      if (price <= 0 || volume < 0) {
        if (issues.length < 20) {
          issues.push({
            id: String(row.id),
            type: 'INVALID_VALUE',
            detail: `Invalid price/volume at ${row.timestamp}`,
          });
        }
        continue;
      }

      if (previousPrice !== null && previousPrice > 0) {
        const jumpPct = Math.abs(((price - previousPrice) / previousPrice) * 100);
        if (jumpPct > maxJumpPct) {
          if (issues.length < 20) {
            issues.push({
              id: String(row.id),
              type: 'PRICE_JUMP',
              detail: `Price jump ${jumpPct.toFixed(2)}% exceeds ${maxJumpPct}%`,
            });
          }
        }
      }

      previousPrice = price;
    }

    const contaminated = issues.length > 0;

    return NextResponse.json({
      success: true,
      symbol,
      contaminated,
      checked_points: rows.length,
      max_jump_pct: maxJumpPct,
      lock_recommended: contaminated,
      issues,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('data-sanity GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run data sanity checks' }, { status: 500 });
  }
}
