import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Handles GET requests to fetch broker summary data for a given symbol and date.
 * Example: /api/broker-summary?symbol=BBCA&date=2026-03-01
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const date = searchParams.get("date");

  if (!symbol || !date) {
    return NextResponse.json(
      { success: false, error: "Symbol and date parameters are required." },
      { status: 400 }
    );
  }

  try {
    const client = await db.connect();
    try {
      const query = `
        SELECT broker_id, net_buy_value, avg_buy_price, avg_sell_price
        FROM broker_summaries
        WHERE symbol = $1 AND date = $2
        ORDER BY net_buy_value DESC;
      `;
      const result = await client.query(query, [symbol, date]);
      
      return NextResponse.json(
        { success: true, data: result.rows },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: "Failed to fetch broker summary.", details: errorMessage },
      { status: 500 }
    );
  }
}
