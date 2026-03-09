import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();
    const thresholdPct = Math.min(10, Math.max(0.1, Number(searchParams.get('thresholdPct') || 1)));
    const days = Math.min(7, Math.max(1, Number(searchParams.get('days') || 3)));

    const result = await db.query(
      `
        WITH trade_agg AS (
          SELECT
            DATE(timestamp) AS trade_date,
            symbol,
            SUM(volume)::bigint AS internal_volume
          FROM trades
          WHERE symbol = $1
            AND DATE(timestamp) >= CURRENT_DATE - ($3::text || ' day')::interval
          GROUP BY DATE(timestamp), symbol
        )
        SELECT
          d.date AS trade_date,
          d.symbol,
          COALESCE(t.internal_volume, 0)::bigint AS internal_volume,
          d.volume::bigint AS reference_volume,
          CASE
            WHEN d.volume = 0 THEN 0
            ELSE ROUND(ABS(COALESCE(t.internal_volume, 0) - d.volume)::numeric / d.volume::numeric * 100.0, 4)
          END AS deviation_pct
        FROM daily_prices d
        LEFT JOIN trade_agg t
          ON t.trade_date = d.date
         AND t.symbol = d.symbol
        WHERE d.symbol = $1
          AND d.date >= CURRENT_DATE - ($3::text || ' day')::interval
        ORDER BY d.date DESC
      `,
      [symbol, thresholdPct, days],
    );

    const rows = result.rows.map((row) => ({
      date: row.trade_date,
      symbol: row.symbol,
      internal_volume: Number(row.internal_volume || 0),
      reference_volume: Number(row.reference_volume || 0),
      deviation_pct: Number(row.deviation_pct || 0),
      flagged: Number(row.deviation_pct || 0) > thresholdPct,
    }));

    const flaggedDays = rows.filter((row) => row.flagged);

    return NextResponse.json({
      success: true,
      symbol,
      threshold_pct: thresholdPct,
      checked_days: rows.length,
      flagged_days: flaggedDays.length,
      lock_recommended: flaggedDays.length > 0,
      rows,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('data-reconciliation GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run data reconciliation' }, { status: 500 });
  }
}
