import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ComparisonRow {
  model_version: string;
  total_predictions: number;
  hits: number;
  misses: number;
  accuracy_pct: number;
  avg_return_pct: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days') || 30)));
    const horizonDays = Math.min(10, Math.max(1, Number(searchParams.get('horizonDays') || 1)));
    const championVersion = (searchParams.get('champion') || '').trim();
    const challengerVersion = (searchParams.get('challenger') || '').trim();

    const versions = await resolveVersions(symbol, championVersion, challengerVersion);

    if (!versions.champion || !versions.challenger) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not enough model versions found for champion-challenger comparison',
        },
        { status: 404 },
      );
    }

    const metrics = await db.query(
      `
        WITH scoped AS (
          SELECT
            p.date,
            p.symbol,
            p.prediction,
            p.model_version,
            d0.close::numeric AS close_t,
            d1.close::numeric AS close_t1
          FROM cnn_predictions p
          JOIN daily_prices d0
            ON d0.symbol = p.symbol
           AND d0.date = p.date
          JOIN daily_prices d1
            ON d1.symbol = p.symbol
           AND d1.date = p.date + ($4::text || ' day')::interval
          WHERE p.symbol = $1
            AND p.date >= CURRENT_DATE - ($3::text || ' day')::interval
            AND p.model_version = ANY($2::text[])
        ),
        evaluated AS (
          SELECT
            model_version,
            prediction,
            close_t,
            close_t1,
            ((close_t1 - close_t) / NULLIF(close_t, 0)) * 100.0 AS realized_return_pct,
            CASE
              WHEN prediction = 'UP' AND close_t1 > close_t THEN 1
              WHEN prediction = 'DOWN' AND close_t1 < close_t THEN 1
              ELSE 0
            END AS is_hit
          FROM scoped
        )
        SELECT
          model_version,
          COUNT(*)::int AS total_predictions,
          SUM(is_hit)::int AS hits,
          (COUNT(*) - SUM(is_hit))::int AS misses,
          ROUND((SUM(is_hit)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS accuracy_pct,
          ROUND(AVG(realized_return_pct), 4) AS avg_return_pct
        FROM evaluated
        GROUP BY model_version
      `,
      [symbol, [versions.champion, versions.challenger], days, horizonDays],
    );

    const rows = metrics.rows as ComparisonRow[];
    const champion = rows.find((row) => row.model_version === versions.champion) || null;
    const challenger = rows.find((row) => row.model_version === versions.challenger) || null;

    if (!champion || !challenger) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient realized outcome data for comparison window',
        },
        { status: 404 },
      );
    }

    const winner =
      challenger.accuracy_pct > champion.accuracy_pct
        ? 'CHALLENGER'
        : challenger.accuracy_pct < champion.accuracy_pct
          ? 'CHAMPION'
          : challenger.avg_return_pct > champion.avg_return_pct
            ? 'CHALLENGER'
            : 'CHAMPION';

    return NextResponse.json({
      success: true,
      symbol,
      days,
      horizon_days: horizonDays,
      champion,
      challenger,
      decision: {
        winner,
        swap_recommended: winner === 'CHALLENGER',
        reason:
          winner === 'CHALLENGER'
            ? 'Challenger outperforms champion on realized accuracy/return in current window'
            : 'Champion remains stronger in current window',
      },
      compared_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('champion-challenger GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to compute model comparison' }, { status: 500 });
  }
}

async function resolveVersions(symbol: string, champion?: string, challenger?: string) {
  if (champion && challenger) {
    return { champion, challenger };
  }

  const result = await db.query(
    `
      SELECT model_version, MAX(date) AS last_date
      FROM cnn_predictions
      WHERE symbol = $1
        AND model_version IS NOT NULL
      GROUP BY model_version
      ORDER BY last_date DESC
      LIMIT 2
    `,
    [symbol],
  );

  const discovered = result.rows.map((row) => row.model_version as string).filter(Boolean);
  return {
    champion: champion || discovered[0] || null,
    challenger: challenger || discovered[1] || null,
  };
}
