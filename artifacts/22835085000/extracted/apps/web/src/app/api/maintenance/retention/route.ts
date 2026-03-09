import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const RETENTION_META_KEY = 'maintenance_retention_meta';

export async function GET() {
  try {
    const metaResult = await db.query(
      `
        SELECT value
        FROM config
        WHERE key = $1
        LIMIT 1
      `,
      [RETENTION_META_KEY],
    );

    let meta: Record<string, unknown> | null = null;
    const value = metaResult.rows[0]?.value;
    if (value) {
      try {
        meta = JSON.parse(value);
      } catch {
        meta = null;
      }
    }

    return NextResponse.json({
      success: true,
      market_close_wib: '16:00',
      policy: {
        trades_retention_days: 7,
        snapshots_retention_days: 90,
        flush_session_after_close: true,
      },
      last_run: meta,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance retention GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to read maintenance retention status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const now = new Date();
    const afterClose = isAfterMarketCloseWib(now);

    let sessionTokenFlushed = 0;
    if (afterClose) {
      const flushResult = await db.query(
        `
          DELETE FROM config
          WHERE key = 'session_token'
        `,
      );
      sessionTokenFlushed = flushResult.rowCount || 0;
    }

    const purgeTrades = await db.query(
      `
        DELETE FROM trades
        WHERE timestamp < NOW() - INTERVAL '7 days'
      `,
    );

    const purgeSnapshots = await db.query(
      `
        DELETE FROM signal_snapshots
        WHERE created_at < NOW() - INTERVAL '90 days'
      `,
    );

    const meta = {
      ran_at: now.toISOString(),
      after_close_wib: afterClose,
      session_token_flushed: sessionTokenFlushed,
      trades_purged: purgeTrades.rowCount || 0,
      snapshots_purged: purgeSnapshots.rowCount || 0,
    };

    await db.query(
      `
        INSERT INTO config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [RETENTION_META_KEY, JSON.stringify(meta)],
    );

    return NextResponse.json({
      success: true,
      ...meta,
    });
  } catch (error) {
    console.error('maintenance retention POST failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run maintenance retention' }, { status: 500 });
  }
}

function isAfterMarketCloseWib(now: Date): boolean {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWibMs = now.getTime() + wibOffsetMs;
  const nowWib = new Date(nowWibMs);
  const hour = nowWib.getUTCHours();
  const minute = nowWib.getUTCMinutes();
  if (hour > 16) {
    return true;
  }
  if (hour === 16 && minute >= 0) {
    return true;
  }
  return false;
}
