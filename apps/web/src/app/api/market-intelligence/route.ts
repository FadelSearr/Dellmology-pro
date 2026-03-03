import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/market-intelligence?symbol=BBCA&timeframe=1h
 * Returns real-time market intelligence data:
 * - HAKA/HAKI ratio
 * - Buy/Sell volume
 * - Order flow heatmap data
 * - Volatility metrics
 * - UPS (Unified Power Score)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BBCA';
    const timeframe = searchParams.get('timeframe') || '1h';
    const fallbackDelayMinutes = 15;

    const timeWindows: { [key: string]: string } = {
      '15m': '15 minutes',
      '1h': '1 hour',
      '4h': '4 hours',
      '1d': '1 day'
    };

    const window = timeWindows[timeframe] || '1 hour';
    const primary = await buildFromPrimaryTrades(symbol, window);
    const usedFallback = !primary;
    const result = primary || (await buildFromFallbackDailyPrices(symbol));

    if (!result) {
      return NextResponse.json(
        {
          error: 'No market data available from primary or fallback source',
          data_source: {
            provider: 'NONE',
            degraded: true,
            reason: 'No data in trades and daily_prices',
          },
        },
        { status: 404 },
      );
    }

    const { metrics, volatility, upsScore, signal, sourceReason } = result;

    return NextResponse.json({
      symbol,
      timeframe,
      metrics,
      volatility,
      unified_power_score: {
        score: Math.round(upsScore),
        signal,
        components: {
          haka_strength: Math.min((metrics.haka_ratio / 50) * 40, 40),
          volume_momentum: Math.min((metrics.total_volume / 10000) * 30, 30),
          price_strength: Math.min(Math.abs(metrics.pressure_index) / 2.5, 20),
          consistency: (metrics.haka_count / (metrics.haka_count + metrics.haki_count || 1)) * 10,
        }
      },
      data_source: {
        provider: usedFallback ? 'FALLBACK_DAILY_PRICES' : 'PRIMARY_TRADES',
        degraded: usedFallback,
        reason: sourceReason,
        fallback_delay_minutes: usedFallback ? fallbackDelayMinutes : 0,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market intelligence data' },
      { status: 500 }
    );
  }
}

async function buildFromPrimaryTrades(symbol: string, window: string) {
  try {
    const tradesQuery = `
      SELECT
        trade_type,
        COUNT(*) as count,
        SUM(volume) as total_volume
      FROM trades
      WHERE symbol = $1
        AND timestamp >= NOW() - INTERVAL '${window}'
      GROUP BY trade_type
    `;
    const tradesResult = await db.query(tradesQuery, [symbol]);

    if (!tradesResult.rows.length) {
      return null;
    }

    let hakaVolume = 0;
    let hakiVolume = 0;
    let normalVolume = 0;
    let hakaCount = 0;
    let hakiCount = 0;

    tradesResult.rows.forEach((row: any) => {
      if (row.trade_type === 'HAKA') {
        hakaVolume = Number(row.total_volume || 0);
        hakaCount = Number(row.count || 0);
      } else if (row.trade_type === 'HAKI') {
        hakiVolume = Number(row.total_volume || 0);
        hakiCount = Number(row.count || 0);
      } else {
        normalVolume = Number(row.total_volume || 0);
      }
    });

    const totalVolume = hakaVolume + hakiVolume + normalVolume;
    if (totalVolume <= 0) {
      return null;
    }

    const volatilityQuery = `
      SELECT
        MAX(price) - MIN(price) as range,
        AVG(price) as avg
      FROM trades
      WHERE symbol = $1
        AND timestamp >= NOW() - INTERVAL '${window}'
    `;
    const volatilityResult = await db.query(volatilityQuery, [symbol]);
    const priceRange = Number(volatilityResult.rows[0]?.range || 0);
    const avgPrice = Number(volatilityResult.rows[0]?.avg || 0);
    const volatilityPct = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 0;

    const metrics = {
      haka_volume: hakaVolume,
      haki_volume: hakiVolume,
      normal_volume: normalVolume,
      total_volume: totalVolume,
      haka_ratio: totalVolume > 0 ? (hakaVolume / totalVolume) * 100 : 0,
      haki_ratio: totalVolume > 0 ? (hakiVolume / totalVolume) * 100 : 0,
      pressure_index: totalVolume > 0 ? ((hakaVolume - hakiVolume) / totalVolume) * 100 : 0,
      haka_count: hakaCount,
      haki_count: hakiCount,
    };

    const upsScore = computeUps(metrics);
    const signal = computeSignal(upsScore);

    return {
      metrics,
      volatility: {
        percentage: volatilityPct,
        range: priceRange,
        classification: volatilityPct > 3 ? 'HIGH' : volatilityPct > 1.5 ? 'MEDIUM' : 'LOW',
      },
      upsScore,
      signal,
      sourceReason: null as string | null,
    };
  } catch {
    return null;
  }
}

async function buildFromFallbackDailyPrices(symbol: string) {
  const fallbackQuery = `
    SELECT date, open, high, low, close, volume
    FROM daily_prices
    WHERE symbol = $1
    ORDER BY date DESC
    LIMIT 20
  `;

  const fallbackResult = await db.query(fallbackQuery, [symbol]);
  if (!fallbackResult.rows.length) {
    return null;
  }

  const latest = fallbackResult.rows[0];
  const earliest = fallbackResult.rows[fallbackResult.rows.length - 1];
  const latestClose = Number(latest.close || 0);
  const earliestClose = Number(earliest.close || latestClose || 0);
  const totalVolume = fallbackResult.rows.reduce((sum: number, row: any) => sum + Number(row.volume || 0), 0);
  const avgVolume = fallbackResult.rows.length > 0 ? totalVolume / fallbackResult.rows.length : 0;
  const trendPct = earliestClose > 0 ? ((latestClose - earliestClose) / earliestClose) * 100 : 0;

  const bullishBias = Math.max(0, Math.min(1, 0.5 + trendPct / 20));
  const hakaVolume = avgVolume * bullishBias;
  const hakiVolume = avgVolume * (1 - bullishBias);
  const normalVolume = Math.max(0, avgVolume - hakaVolume - hakiVolume);

  const highMax = Math.max(...fallbackResult.rows.map((row: any) => Number(row.high || 0)));
  const lowMin = Math.min(...fallbackResult.rows.map((row: any) => Number(row.low || 0)));
  const priceRange = Math.max(0, highMax - lowMin);
  const volatilityPct = latestClose > 0 ? (priceRange / latestClose) * 100 : 0;

  const metrics = {
    haka_volume: hakaVolume,
    haki_volume: hakiVolume,
    normal_volume: normalVolume,
    total_volume: Math.max(1, avgVolume),
    haka_ratio: avgVolume > 0 ? (hakaVolume / avgVolume) * 100 : 50,
    haki_ratio: avgVolume > 0 ? (hakiVolume / avgVolume) * 100 : 50,
    pressure_index: trendPct,
    haka_count: Math.round(10 * bullishBias),
    haki_count: Math.round(10 * (1 - bullishBias)),
  };

  const upsScore = computeUps(metrics);
  const signal = computeSignal(upsScore);

  return {
    metrics,
    volatility: {
      percentage: volatilityPct,
      range: priceRange,
      classification: volatilityPct > 3 ? 'HIGH' : volatilityPct > 1.5 ? 'MEDIUM' : 'LOW',
    },
    upsScore,
    signal,
    sourceReason: 'Primary stream unavailable; using delayed fallback daily prices',
  };
}

function computeUps(metrics: {
  haka_ratio: number;
  total_volume: number;
  pressure_index: number;
  haka_count: number;
  haki_count: number;
}) {
  const hakaStrength = Math.min((metrics.haka_ratio / 50) * 40, 40);
  const volumeMomentum = Math.min((metrics.total_volume / 10000) * 30, 30);
  const priceStrength = Math.min(Math.abs(metrics.pressure_index) / 2.5, 20);
  const consistency = (metrics.haka_count / (metrics.haka_count + metrics.haki_count || 1)) * 10;
  return Math.min(hakaStrength + volumeMomentum + priceStrength + consistency, 100);
}

function computeSignal(upsScore: number) {
  if (upsScore > 70) return 'STRONG_BUY';
  if (upsScore > 60) return 'BUY';
  if (upsScore < 30) return 'STRONG_SELL';
  if (upsScore < 40) return 'SELL';
  return 'NEUTRAL';
}
