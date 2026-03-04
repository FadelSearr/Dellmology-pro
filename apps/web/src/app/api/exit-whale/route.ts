import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sourceMeta } from '@/lib/source-adapter';

export const dynamic = 'force-dynamic';

type ExitWhaleSignal = 'ACCUMULATION' | 'EXIT_DISTRIBUTION' | 'NEUTRAL';

function classifyExitWhale(input: {
  strongEventCount: number;
  netDistributionValue: number;
  totalEventCount: number;
}): {
  signal: ExitWhaleSignal;
  warning: boolean;
  confidence: number;
  reason: string;
} {
  const strong = Math.max(0, Number(input.strongEventCount || 0));
  const netDist = Math.max(0, Number(input.netDistributionValue || 0));
  const total = Math.max(0, Number(input.totalEventCount || 0));

  const density = total > 0 ? strong / total : 0;
  let score = 0;

  if (strong >= 4) score += 35;
  else if (strong >= 2) score += 20;
  else if (strong >= 1) score += 8;

  if (netDist >= 50_000_000_000) score += 45;
  else if (netDist >= 20_000_000_000) score += 28;
  else if (netDist >= 10_000_000_000) score += 12;

  if (density >= 0.5) score += 15;
  else if (density >= 0.3) score += 8;

  const confidence = Math.max(0, Math.min(100, score));

  if (confidence >= 55) {
    return {
      signal: 'EXIT_DISTRIBUTION',
      warning: true,
      confidence,
      reason: `Distribusi institusi terdeteksi (${strong} strong events, net ${Math.round(netDist / 1_000_000_000)}B).`,
    };
  }

  if (strong === 0 && netDist <= 2_000_000_000) {
    return {
      signal: 'ACCUMULATION',
      warning: false,
      confidence: Math.max(40, 100 - confidence),
      reason: 'Tidak ada tekanan exit whale signifikan pada window observasi.',
    };
  }

  return {
    signal: 'NEUTRAL',
    warning: false,
    confidence,
    reason: 'Sinyal exit whale belum konklusif.',
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const symbol = String(searchParams.get('symbol') || '').toUpperCase();
    const requestedDays = Number.parseInt(searchParams.get('days') || '7', 10);
    const days = Number.isFinite(requestedDays) ? Math.min(90, Math.max(1, requestedDays)) : 7;

    const query = `
      SELECT symbol, broker_id, net_value, z_score, note, time
      FROM exit_whale_events
      WHERE ($1 = '' OR symbol = $1)
        AND time >= NOW() - $2::interval
      ORDER BY time DESC
    `;
    const result = await db.query(query, [symbol, `${days} days`]);

    const events = (result.rows || []).map((row) => ({
      ...row,
      net_value: Number(row.net_value || 0),
      z_score: Number(row.z_score || 0),
    }));

    const strongEvents = events.filter((event) =>
      Number(event.net_value) < 0 && (Number(event.z_score) <= -1.5 || /distribution|exit|liquidity|hunt|sell/i.test(String(event.note || ''))),
    );

    const netDistributionValue = Math.abs(
      strongEvents.reduce((sum, event) => sum + Math.min(0, Number(event.net_value || 0)), 0),
    );

    const classified = classifyExitWhale({
      strongEventCount: strongEvents.length,
      netDistributionValue: netDistributionValue,
      totalEventCount: events.length,
    });

    return NextResponse.json({
      symbol,
      days,
      events,
      summary: {
        event_count: events.length,
        strong_event_count: strongEvents.length,
        net_distribution_value: netDistributionValue,
        warning: classified.warning,
        signal: classified.signal,
        confidence: classified.confidence,
        reason: classified.reason,
      },
      degraded: false,
      reason: null,
      data_source: sourceMeta({
        provider: 'PRIMARY_DB',
        degraded: false,
        reason: null,
        fallbackDelayMinutes: 0,
        diagnostics: {
          primary_latency_ms: Math.max(0, Date.now() - startedAt),
          fallback_latency_ms: null,
          primary_error: null,
          selected_source: 'PRIMARY_DB',
          checked_at: new Date().toISOString(),
        },
      }),
    });
  } catch (err) {
    console.error('Error fetching exit whale events', err);
    return NextResponse.json({
      events: [],
      summary: {
        event_count: 0,
        strong_event_count: 0,
        net_distribution_value: 0,
        warning: false,
        signal: 'NEUTRAL' as ExitWhaleSignal,
        confidence: 0,
        reason: 'failed to fetch exit whale events',
      },
      degraded: true,
      reason: 'failed to fetch exit whale events',
      data_source: sourceMeta({
        provider: 'FALLBACK_EMPTY',
        degraded: true,
        reason: 'failed to fetch exit whale events',
        fallbackDelayMinutes: 15,
        diagnostics: {
          primary_latency_ms: Math.max(0, Date.now() - startedAt),
          fallback_latency_ms: null,
          primary_error: err instanceof Error ? err.message : 'unknown error',
          selected_source: 'FALLBACK_EMPTY',
          checked_at: new Date().toISOString(),
        },
      }),
    });
  }
}
