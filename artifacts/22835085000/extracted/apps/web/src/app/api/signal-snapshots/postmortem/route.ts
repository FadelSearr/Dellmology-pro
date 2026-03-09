import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PostmortemRow {
  rule_engine_mode: string | null;
  rule_engine_version: string | null;
  rule_engine_source: string | null;
  total_signals: number;
  evaluated_signals: number;
  hits: number;
  misses: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const symbolParam = (searchParams.get('symbol') || '').trim().toUpperCase();
    const symbol = symbolParam.length > 0 ? symbolParam : null;

    const ruleEngineModeParam = (searchParams.get('rule_engine_mode') || '').trim().toUpperCase();
    const ruleEngineMode = ruleEngineModeParam.length > 0 ? ruleEngineModeParam : null;

    const ruleEngineVersionParam = (searchParams.get('rule_engine_version') || '').trim();
    const ruleEngineVersion = ruleEngineVersionParam.length > 0 ? ruleEngineVersionParam : null;

    const window = clampNumber(searchParams.get('window'), 200, 20, 1000);
    const horizonMinutes = clampNumber(searchParams.get('horizonMinutes'), 30, 1, 240);
    const slippagePct = clampNumber(searchParams.get('slippagePct'), 0.5, 0, 5);
    const minEvaluated = clampNumber(searchParams.get('minEvaluated'), 1, 0, 1000);
    const top = clampNumber(searchParams.get('top'), 20, 1, 100);

    const result = await db.query(
      `
        WITH base AS (
          SELECT
            id,
            symbol,
            signal,
            price::numeric AS price,
            created_at,
            COALESCE(
              payload->'snapshot_context'->'rule_engine'->>'mode',
              payload->'rule_engine_versioning'->>'mode',
              'UNKNOWN'
            ) AS rule_engine_mode,
            COALESCE(
              payload->'snapshot_context'->'rule_engine'->>'version',
              payload->'rule_engine_versioning'->>'version',
              'UNKNOWN'
            ) AS rule_engine_version,
            COALESCE(
              payload->'snapshot_context'->'rule_engine'->>'source',
              payload->'rule_engine_versioning'->>'source',
              'UNKNOWN'
            ) AS rule_engine_source
          FROM signal_snapshots
          WHERE signal IN ('BUY', 'SELL')
            AND price IS NOT NULL
            AND ($1::text IS NULL OR symbol = $1)
            AND (
              $2::text IS NULL OR COALESCE(
                payload->'snapshot_context'->'rule_engine'->>'mode',
                payload->'rule_engine_versioning'->>'mode'
              ) = $2
            )
            AND (
              $3::text IS NULL OR COALESCE(
                payload->'snapshot_context'->'rule_engine'->>'version',
                payload->'rule_engine_versioning'->>'version'
              ) = $3
            )
          ORDER BY created_at DESC
          LIMIT $4
        ),
        evaluated AS (
          SELECT
            b.rule_engine_mode,
            b.rule_engine_version,
            b.rule_engine_source,
            CASE
              WHEN future_snap.price IS NULL THEN NULL
              WHEN b.signal = 'BUY' THEN (future_snap.price >= b.price * (1 + $5::numeric / 100.0))
              WHEN b.signal = 'SELL' THEN (future_snap.price <= b.price * (1 - $5::numeric / 100.0))
              ELSE NULL
            END AS is_hit
          FROM base b
          LEFT JOIN LATERAL (
            SELECT s2.price::numeric AS price
            FROM signal_snapshots s2
            WHERE s2.symbol = b.symbol
              AND s2.price IS NOT NULL
              AND s2.created_at >= b.created_at + ($6::text || ' minutes')::interval
            ORDER BY s2.created_at ASC
            LIMIT 1
          ) AS future_snap ON TRUE
        )
        SELECT
          rule_engine_mode,
          rule_engine_version,
          rule_engine_source,
          COUNT(*)::int AS total_signals,
          COUNT(*) FILTER (WHERE is_hit IS NOT NULL)::int AS evaluated_signals,
          COUNT(*) FILTER (WHERE is_hit = TRUE)::int AS hits,
          COUNT(*) FILTER (WHERE is_hit = FALSE)::int AS misses
        FROM evaluated
        GROUP BY rule_engine_mode, rule_engine_version, rule_engine_source
        HAVING COUNT(*) FILTER (WHERE is_hit IS NOT NULL) >= $7
        ORDER BY evaluated_signals DESC, total_signals DESC, rule_engine_version ASC
        LIMIT $8
      `,
      [symbol, ruleEngineMode, ruleEngineVersion, window, slippagePct, horizonMinutes, minEvaluated, top],
    );

    const rows = (result.rows as PostmortemRow[]).map((row) => {
      const totalSignals = Number(row.total_signals || 0);
      const evaluatedSignals = Number(row.evaluated_signals || 0);
      const hits = Number(row.hits || 0);
      const misses = Number(row.misses || 0);
      const pending = Math.max(0, totalSignals - evaluatedSignals);
      const accuracyPct = evaluatedSignals > 0 ? Number(((hits / evaluatedSignals) * 100).toFixed(1)) : 0;

      return {
        rule_engine_mode: row.rule_engine_mode || 'UNKNOWN',
        rule_engine_version: row.rule_engine_version || 'UNKNOWN',
        rule_engine_source: row.rule_engine_source || 'UNKNOWN',
        total_signals: totalSignals,
        evaluated_signals: evaluatedSignals,
        hits,
        misses,
        pending,
        accuracy_pct: accuracyPct,
      };
    });

    const summary = rows.reduce(
      (acc, row) => {
        acc.total_signals += row.total_signals;
        acc.evaluated_signals += row.evaluated_signals;
        acc.hits += row.hits;
        acc.misses += row.misses;
        return acc;
      },
      {
        total_signals: 0,
        evaluated_signals: 0,
        hits: 0,
        misses: 0,
      },
    );

    return NextResponse.json({
      success: true,
      filters: {
        symbol,
        rule_engine_mode: ruleEngineMode,
        rule_engine_version: ruleEngineVersion,
        window,
        horizon_minutes: horizonMinutes,
        slippage_pct: slippagePct,
        min_evaluated: minEvaluated,
        top,
      },
      summary: {
        ...summary,
        accuracy_pct:
          summary.evaluated_signals > 0
            ? Number(((summary.hits / summary.evaluated_signals) * 100).toFixed(1))
            : 0,
      },
      rows,
      count: rows.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('signal-snapshots postmortem GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to compute postmortem summary' }, { status: 500 });
  }
}

function clampNumber(rawValue: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}
