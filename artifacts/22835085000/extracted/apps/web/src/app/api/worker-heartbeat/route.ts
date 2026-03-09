import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const HEARTBEAT_KEY = 'worker_last_heartbeat';
const HEARTBEAT_META_KEY = 'worker_heartbeat_meta';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      source?: string;
      note?: string;
      state?: string;
    };

    const nowIso = new Date().toISOString();
    const meta = {
      source: body.source || 'local-worker',
      state: body.state || 'alive',
      note: body.note || null,
      ts: nowIso,
    };

    await db.query(
      `
        INSERT INTO config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [HEARTBEAT_KEY, nowIso],
    );

    await db.query(
      `
        INSERT INTO config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [HEARTBEAT_META_KEY, JSON.stringify(meta)],
    );

    return NextResponse.json({ success: true, heartbeat_at: nowIso });
  } catch (error) {
    console.error('worker-heartbeat POST failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to store worker heartbeat' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeoutSeconds = Math.min(300, Math.max(10, Number(searchParams.get('timeoutSeconds') || 60)));

    const result = await db.query(
      `
        SELECT key, value
        FROM config
        WHERE key IN ($1, $2)
      `,
      [HEARTBEAT_KEY, HEARTBEAT_META_KEY],
    );

    const heartbeatValue = result.rows.find((row) => row.key === HEARTBEAT_KEY)?.value || null;
    const metaValue = result.rows.find((row) => row.key === HEARTBEAT_META_KEY)?.value || null;

    const heartbeatAt = heartbeatValue ? new Date(heartbeatValue) : null;
    const lastSeenSeconds = heartbeatAt ? Math.max(0, Math.floor((Date.now() - heartbeatAt.getTime()) / 1000)) : null;
    const online = lastSeenSeconds !== null && lastSeenSeconds <= timeoutSeconds;

    let meta: Record<string, unknown> | null = null;
    if (metaValue) {
      try {
        meta = JSON.parse(metaValue);
      } catch {
        meta = null;
      }
    }

    return NextResponse.json({
      success: true,
      online,
      timeout_seconds: timeoutSeconds,
      heartbeat_at: heartbeatAt ? heartbeatAt.toISOString() : null,
      last_seen_seconds: lastSeenSeconds,
      meta,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('worker-heartbeat GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch worker heartbeat status' }, { status: 500 });
  }
}
