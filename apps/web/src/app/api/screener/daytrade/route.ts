import { db } from "@/lib/db";
import { readCoolingOffLockState } from "@/lib/security/coolingOff";
import { buildCoolingOffLockPayload } from "@/lib/security/lockPayloads";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles GET requests for the Daytrade Screener.
 * This screener finds stocks with a high ratio of aggressive buy trades (HAKA)
 * in the last N minutes, indicating strong buying pressure.
 * 
 * Query Params:
 * - minutes: (optional) The number of minutes to look back. Defaults to 30.
 * - limit: (optional) The number of stocks to return. Defaults to 10.
 * - min_trades: (optional) The minimum number of trades for a stock to be considered. Defaults to 20.
 */
export async function GET(request: NextRequest) {
  const coolingOff = await readCoolingOffLockState();
  if (coolingOff.active) {
    return NextResponse.json(buildCoolingOffLockPayload(coolingOff, 'Cooling-off active: screener temporarily locked', true), { status: 423 });
  }

  const { searchParams } = new URL(request.url);
  const minutes = Math.max(5, Math.min(240, Number(searchParams.get('minutes') || '30')));
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || '10')));
  const minTrades = Math.max(5, Math.min(2000, Number(searchParams.get('min_trades') || '20')));
  const minPrice = Math.max(0, Number(searchParams.get('min_price') || '0'));
  const maxPrice = Math.max(minPrice, Number(searchParams.get('max_price') || '999999999'));

  try {
    const client = await db.connect();
    try {
      // This query identifies stocks with high recent buying pressure.
      // It calculates the ratio of 'HAKA' (aggressive buy) trades to total trades
      // for each stock in a recent time window.
      const query = `
        WITH recent_trades AS (
          SELECT
            symbol,
            trade_type,
            price,
            volume
          FROM
            trades
          WHERE
            timestamp >= NOW() - INTERVAL '1 minute' * $1
        ),
        trade_counts AS (
          SELECT
            symbol,
            COUNT(*) as total_trades,
            SUM(CASE WHEN trade_type = 'HAKA' THEN 1 ELSE 0 END) as haka_trades,
            SUM(COALESCE(volume, 0)) as total_volume
          FROM
            recent_trades
          GROUP BY
            symbol
        ),
        latest_trade AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            price::numeric as last_price
          FROM trades
          ORDER BY symbol, timestamp DESC
        ),
        prev_close AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            close::numeric as prev_close
          FROM daily_prices
          ORDER BY symbol, date DESC
        )
        SELECT
          t.symbol,
          ROUND((t.haka_trades::float / NULLIF(t.total_trades::float, 0))::numeric, 4) as haka_ratio,
          t.total_trades,
          t.total_volume,
          COALESCE(l.last_price, 0)::float as last_price,
          COALESCE(
            ROUND((((COALESCE(l.last_price, 0) - COALESCE(p.prev_close, COALESCE(l.last_price, 0))) / NULLIF(COALESCE(p.prev_close, 0), 0)) * 100)::numeric, 2),
            0
          )::float as change_pct,
          LEAST(100, GREATEST(0, ((t.haka_trades::float / NULLIF(t.total_trades::float, 0)) * 70) + LEAST(t.total_trades / 2.0, 30)))::float as score,
          CASE
            WHEN (t.haka_trades::float / NULLIF(t.total_trades::float, 0)) >= 0.7 THEN 'HAKA Dominance'
            WHEN (t.haka_trades::float / NULLIF(t.total_trades::float, 0)) >= 0.55 THEN 'Momentum Watch'
            ELSE 'Balanced Flow'
          END as status
        FROM
          trade_counts t
          LEFT JOIN latest_trade l ON l.symbol = t.symbol
          LEFT JOIN prev_close p ON p.symbol = t.symbol
        WHERE
          t.total_trades >= $2
          AND COALESCE(l.last_price, 0) BETWEEN $3 AND $4
        ORDER BY
          score DESC,
          haka_ratio DESC,
          t.total_trades DESC
        LIMIT $5;
      `;
      const result = await client.query(query, [minutes, minTrades, minPrice, maxPrice, limit]);
      
      return NextResponse.json(
        {
          success: true,
          mode: 'daytrade',
          filters: {
            minutes,
            min_trades: minTrades,
            min_price: minPrice,
            max_price: maxPrice,
            limit,
          },
          data: result.rows,
        },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: "Failed to run Daytrade Screener.", details: errorMessage },
      { status: 500 }
    );
  }
}
