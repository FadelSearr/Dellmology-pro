import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdPct = Math.min(10, Math.max(0.1, Number(searchParams.get('thresholdPct') || 2)));
    const symbolsParam = (searchParams.get('symbols') || 'BBCA,ASII,TLKM')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);

    if (!symbolsParam.length) {
      return NextResponse.json({ success: false, error: 'No symbols provided' }, { status: 400 });
    }

    const result = await db.query(
      `
        WITH latest_trades AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            price::numeric AS internal_price,
            timestamp AS internal_timestamp
          FROM trades
          WHERE symbol = ANY($1::text[])
          ORDER BY symbol, timestamp DESC
        ),
        latest_refs AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            close::numeric AS reference_price,
            date AS reference_date
          FROM daily_prices
          WHERE symbol = ANY($1::text[])
          ORDER BY symbol, date DESC
        )
        SELECT
          COALESCE(t.symbol, r.symbol) AS symbol,
          t.internal_price,
          t.internal_timestamp,
          r.reference_price,
          r.reference_date,
          CASE
            WHEN r.reference_price IS NULL OR r.reference_price = 0 OR t.internal_price IS NULL THEN NULL
            ELSE ROUND(ABS(t.internal_price - r.reference_price) / r.reference_price * 100.0, 4)
          END AS deviation_pct
        FROM latest_trades t
        FULL OUTER JOIN latest_refs r ON r.symbol = t.symbol
        ORDER BY symbol
      `,
      [symbolsParam],
    );

    const rows = result.rows.map((row) => {
      const deviation = row.deviation_pct === null ? null : Number(row.deviation_pct);
      return {
        symbol: row.symbol,
        internal_price: row.internal_price === null ? null : Number(row.internal_price),
        internal_timestamp: row.internal_timestamp,
        reference_price: row.reference_price === null ? null : Number(row.reference_price),
        reference_date: row.reference_date,
        deviation_pct: deviation,
        flagged: deviation !== null && deviation > thresholdPct,
      };
    });

    const flagged = rows.filter((row) => row.flagged);

    return NextResponse.json({
      success: true,
      threshold_pct: thresholdPct,
      checked_symbols: rows.length,
      flagged_symbols: flagged.map((row) => row.symbol),
      lock_recommended: flagged.length > 0,
      rows,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('price-cross-check GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run price cross-check' }, { status: 500 });
  }
}
