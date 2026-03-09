import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();

    const [latestTradeRes, recentAvgRes] = await Promise.all([
      db.query(
        `SELECT timestamp, price FROM trades WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
        [symbol],
      ),
      db.query(
        `
        SELECT AVG(price)::numeric AS avg_price
        FROM trades
        WHERE symbol = $1
          AND timestamp >= NOW() - INTERVAL '30 minutes'
        `,
        [symbol],
      ),
    ]);

    const latestTrade = latestTradeRes.rows?.[0] || null;
    const avgPrice = Number(recentAvgRes.rows?.[0]?.avg_price || 0);
    const latestPrice = Number(latestTrade?.price || 0);

    const staleSeconds = latestTrade?.timestamp
      ? Math.max(0, Math.floor((Date.now() - new Date(latestTrade.timestamp).getTime()) / 1000))
      : 9999;

    const heartbeatStatus = staleSeconds <= 60 ? 'healthy' : staleSeconds <= 300 ? 'degraded' : 'offline';

    let crossCheckDeviationPct = 0;
    let externalPrice = 0;
    try {
      const yahooResp = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}.JK`, {
        cache: 'no-store',
      });
      if (yahooResp.ok) {
        const yahooJson = await yahooResp.json();
        externalPrice = Number(yahooJson?.quoteResponse?.result?.[0]?.regularMarketPrice || 0);
        if (externalPrice > 0 && latestPrice > 0) {
          crossCheckDeviationPct = Math.abs((latestPrice - externalPrice) / externalPrice) * 100;
        }
      }
    } catch {
      // ignore external check failures
    }

    const executionLock = crossCheckDeviationPct > 2;

    return NextResponse.json({
      symbol,
      heartbeat: {
        status: heartbeatStatus,
        stale_seconds: staleSeconds,
      },
      fallback_orchestrator: {
        active_source: heartbeatStatus === 'offline' ? 'FALLBACK_DELAYED' : 'PRIMARY_STREAM',
        switched: heartbeatStatus === 'offline',
      },
      cross_check: {
        local_price: latestPrice,
        external_price: externalPrice,
        deviation_pct: Number(crossCheckDeviationPct.toFixed(3)),
        execution_lock: executionLock,
      },
      concentration_warning: {
        artificial_liquidity_warning: false,
        reason: 'Use /api/broker-flow stats.artificial_liquidity_warning for full broker-based signal',
      },
      checked_at: new Date().toISOString(),
      baseline_30m_avg: avgPrice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to evaluate system guardrails',
        details: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 },
    );
  }
}
