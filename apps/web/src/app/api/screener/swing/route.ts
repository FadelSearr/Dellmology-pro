import { db } from "@/lib/db";
import { readCoolingOffLockState } from "@/lib/security/coolingOff";
import { buildCoolingOffLockPayload } from "@/lib/security/lockPayloads";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles GET requests for the Swing Screener.
 * This screener finds stocks with the highest net accumulation over the last N days.
 * 
 * Query Params:
 * - days: (optional) The number of days to look back. Defaults to 7.
 * - limit: (optional) The number of stocks to return. Defaults to 10.
 */
export async function GET(request: NextRequest) {
  const coolingOff = await readCoolingOffLockState();
  if (coolingOff.active) {
    return NextResponse.json(buildCoolingOffLockPayload(coolingOff, 'Cooling-off active: screener temporarily locked', true), { status: 423 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(3, Math.min(60, Number(searchParams.get('days') || '7')));
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || '10')));
  const minPrice = Math.max(0, Number(searchParams.get('min_price') || '0'));
  const maxPrice = Math.max(minPrice, Number(searchParams.get('max_price') || '999999999'));

  try {
    const client = await db.connect();
    try {
      // This query calculates the total net buy value for each symbol over the last N days
      // and returns the top M symbols.
      const query = `
        WITH accumulation AS (
          SELECT
            symbol,
            SUM(net_buy_value)::numeric as total_net_accumulation
          FROM broker_summaries
          WHERE date >= NOW() - INTERVAL '1 day' * $1
          GROUP BY symbol
        ),
        latest_price AS (
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
        )
        SELECT
          a.symbol,
          COALESCE(a.total_net_accumulation, 0)::float as total_net_accumulation,
          COALESCE(lp.last_price, 0)::float as last_price,
          COALESCE(
            ROUND((((COALESCE(lp.last_price, 0) - COALESCE(pp.prev_close, COALESCE(lp.last_price, 0))) / NULLIF(COALESCE(pp.prev_close, 0), 0)) * 100)::numeric, 2),
            0
          )::float as change_pct,
          LEAST(100, GREATEST(0,
            CASE
              WHEN a.total_net_accumulation <= 0 THEN 20
              ELSE 50 + LEAST(50, LN(1 + a.total_net_accumulation / 1000000000.0) * 20)
            END
          ))::float as score,
          CASE
            WHEN a.total_net_accumulation > 25000000000 THEN 'Strong Accumulation'
            WHEN a.total_net_accumulation > 5000000000 THEN 'Accumulation'
            WHEN a.total_net_accumulation > 0 THEN 'Early Build-up'
            ELSE 'Distribution Risk'
          END as status
        FROM accumulation a
        LEFT JOIN latest_price lp ON lp.symbol = a.symbol
        LEFT JOIN prev_price pp ON pp.symbol = a.symbol
        WHERE COALESCE(lp.last_price, 0) BETWEEN $2 AND $3
        ORDER BY score DESC, a.total_net_accumulation DESC
        LIMIT $4;
      `;
      const result = await client.query(query, [days, minPrice, maxPrice, limit]);
      
      return NextResponse.json(
        {
          success: true,
          mode: 'swing',
          filters: {
            days,
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
      { success: false, error: "Failed to run Swing Screener.", details: errorMessage },
      { status: 500 }
    );
  }
}
