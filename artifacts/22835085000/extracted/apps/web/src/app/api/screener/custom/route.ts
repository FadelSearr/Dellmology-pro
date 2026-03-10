import { db } from '@/lib/db';
import { readCoolingOffLockState } from '@/lib/security/coolingOff';
import { buildCoolingOffLockPayload } from '@/lib/security/lockPayloads';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const coolingOff = await readCoolingOffLockState();
  if (coolingOff.active) {
    return NextResponse.json(buildCoolingOffLockPayload(coolingOff, 'Cooling-off active: screener temporarily locked', true), { status: 423 });
  }

  const { searchParams } = new URL(request.url);
  const minPrice = Math.max(0, Number(searchParams.get('min_price') || '100'));
  const maxPrice = Math.max(minPrice, Number(searchParams.get('max_price') || '500'));
  const days = Math.max(3, Math.min(30, Number(searchParams.get('days') || '7')));
  const minutes = Math.max(5, Math.min(240, Number(searchParams.get('minutes') || '30')));
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || '15')));

  try {
    const client = await db.connect();
    try {
      const query = `
        WITH latest_price AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            close::numeric as last_price,
            date
          FROM daily_prices
          ORDER BY symbol, date DESC
        ),
        prev_price AS (
          SELECT p1.symbol, p1.close::numeric as prev_close
          FROM daily_prices p1
          JOIN (
            SELECT symbol, MAX(date) as max_date
            FROM daily_prices
            GROUP BY symbol
          ) m ON m.symbol = p1.symbol
          WHERE p1.date = m.max_date - INTERVAL '1 day'
        ),
        recent_trades AS (
          SELECT symbol, trade_type
          FROM trades
          WHERE timestamp >= NOW() - INTERVAL '1 minute' * $1
        ),
        trade_flow AS (
          SELECT
            symbol,
            COUNT(*)::int as total_trades,
            SUM(CASE WHEN trade_type = 'HAKA' THEN 1 ELSE 0 END)::int as haka_trades
          FROM recent_trades
          GROUP BY symbol
        ),
        accumulation AS (
          SELECT
            symbol,
            SUM(net_buy_value)::numeric as total_net_accumulation
          FROM broker_summaries
          WHERE date >= NOW() - INTERVAL '1 day' * $2
          GROUP BY symbol
        )
        SELECT
          lp.symbol,
          COALESCE(lp.last_price, 0)::float as last_price,
          COALESCE(
            ROUND((((COALESCE(lp.last_price, 0) - COALESCE(pp.prev_close, COALESCE(lp.last_price, 0))) / NULLIF(COALESCE(pp.prev_close, 0), 0)) * 100)::numeric, 2),
            0
          )::float as change_pct,
          COALESCE(tf.total_trades, 0)::int as total_trades,
          COALESCE(tf.haka_trades, 0)::int as haka_trades,
          COALESCE(a.total_net_accumulation, 0)::float as total_net_accumulation,
          LEAST(100, GREATEST(0,
            (COALESCE(tf.haka_trades::float / NULLIF(tf.total_trades::float, 0), 0) * 45)
            + (CASE WHEN COALESCE(a.total_net_accumulation, 0) <= 0 THEN 15 ELSE 35 + LEAST(35, LN(1 + COALESCE(a.total_net_accumulation, 0) / 1000000000.0) * 12) END)
            + LEAST(20, COALESCE(tf.total_trades, 0) / 5.0)
          ))::float as score,
          CASE
            WHEN COALESCE(a.total_net_accumulation, 0) > 5000000000 AND COALESCE(tf.haka_trades::float / NULLIF(tf.total_trades::float, 0), 0) >= 0.55 THEN 'Range Breakout Candidate'
            WHEN COALESCE(a.total_net_accumulation, 0) > 0 THEN 'Range Accumulation'
            ELSE 'Range Watch'
          END as status
        FROM latest_price lp
        LEFT JOIN prev_price pp ON pp.symbol = lp.symbol
        LEFT JOIN trade_flow tf ON tf.symbol = lp.symbol
        LEFT JOIN accumulation a ON a.symbol = lp.symbol
        WHERE COALESCE(lp.last_price, 0) BETWEEN $3 AND $4
        ORDER BY score DESC, COALESCE(a.total_net_accumulation, 0) DESC
        LIMIT $5
      `;

      const result = await client.query(query, [minutes, days, minPrice, maxPrice, limit]);

      return NextResponse.json(
        {
          success: true,
          mode: 'custom',
          filters: {
            minutes,
            days,
            min_price: minPrice,
            max_price: maxPrice,
            limit,
          },
          data: result.rows,
        },
        { status: 200 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: 'Failed to run Custom Screener.', details: errorMessage },
      { status: 500 },
    );
  }
}
