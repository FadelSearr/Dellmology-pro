import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type QueueStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

interface QueueBody {
  symbol?: string;
  reason?: string;
  run_date_wib?: string;
  status?: QueueStatus;
  note?: string;
}

export async function GET(request: Request) {
  try {
    await ensureRefetchQueueTable();

    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || '').trim().toUpperCase();
    const status = (searchParams.get('status') || '').trim().toUpperCase();
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));

    const clauses: string[] = [];
    const values: Array<string | number> = [];

    if (symbol) {
      values.push(symbol);
      clauses.push(`symbol = $${values.length}`);
    }

    if (status && ['PENDING', 'PROCESSING', 'DONE', 'FAILED'].includes(status)) {
      values.push(status);
      clauses.push(`status = $${values.length}`);
    }

    values.push(limit);
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await db.query(
      `
        SELECT id, symbol, reason, run_date_wib, status, note, queued_at, updated_at
        FROM maintenance_refetch_queue
        ${whereSql}
        ORDER BY queued_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    const summaryResult = await db.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM maintenance_refetch_queue
        GROUP BY status
      `,
    );

    const summary = {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
      total: 0,
    };

    for (const row of summaryResult.rows) {
      const rowStatus = String(row.status || '').toUpperCase();
      const total = Number(row.total || 0);
      if (rowStatus === 'PENDING') {
        summary.pending = total;
      } else if (rowStatus === 'PROCESSING') {
        summary.processing = total;
      } else if (rowStatus === 'DONE') {
        summary.done = total;
      } else if (rowStatus === 'FAILED') {
        summary.failed = total;
      }
      summary.total += total;
    }

    return NextResponse.json({
      success: true,
      queue: result.rows,
      count: result.rows.length,
      summary,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance refetch-queue GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to read refetch queue' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureRefetchQueueTable();

    const body = (await safeJson(request)) as QueueBody | undefined;
    const symbol = (body?.symbol || '').trim().toUpperCase();

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 });
    }

    const reason = (body?.reason || 'Nightly reconciliation deviation > threshold').trim();
    const runDateWib = (body?.run_date_wib || getWibDateKey()).trim();

    const createResult = await db.query(
      `
        INSERT INTO maintenance_refetch_queue (symbol, reason, run_date_wib, status, note, queued_at, updated_at)
        VALUES ($1, $2, $3, 'PENDING', $4, NOW(), NOW())
        ON CONFLICT (symbol, run_date_wib) DO UPDATE
        SET reason = EXCLUDED.reason,
            note = COALESCE(EXCLUDED.note, maintenance_refetch_queue.note),
            status = CASE
              WHEN maintenance_refetch_queue.status IN ('DONE', 'FAILED') THEN 'PENDING'
              ELSE maintenance_refetch_queue.status
            END,
            updated_at = NOW()
        RETURNING id, symbol, reason, run_date_wib, status, note, queued_at, updated_at
      `,
      [symbol, reason, runDateWib, body?.note || null],
    );

    return NextResponse.json({
      success: true,
      entry: createResult.rows[0],
      queued_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance refetch-queue POST failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to enqueue refetch task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureRefetchQueueTable();

    const body = (await safeJson(request)) as
      | {
          id?: number;
          status?: QueueStatus;
          note?: string;
        }
      | undefined;

    if (!body?.id || !body?.status || !['PENDING', 'PROCESSING', 'DONE', 'FAILED'].includes(body.status)) {
      return NextResponse.json({ success: false, error: 'id and valid status are required' }, { status: 400 });
    }

    const result = await db.query(
      `
        UPDATE maintenance_refetch_queue
        SET status = $2,
            note = COALESCE($3, note),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, symbol, reason, run_date_wib, status, note, queued_at, updated_at
      `,
      [body.id, body.status, body.note || null],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Queue item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry: result.rows[0] });
  } catch (error) {
    console.error('maintenance refetch-queue PATCH failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to update refetch task status' }, { status: 500 });
  }
}

async function ensureRefetchQueueTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_refetch_queue (
      id BIGSERIAL PRIMARY KEY,
      symbol VARCHAR(16) NOT NULL,
      reason TEXT NOT NULL,
      run_date_wib TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      note TEXT,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (symbol, run_date_wib)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_refetch_queue_status_time
      ON maintenance_refetch_queue (status, queued_at DESC)
  `);
}

function getWibDateKey(nowUtc: Date = new Date()) {
  const wib = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
