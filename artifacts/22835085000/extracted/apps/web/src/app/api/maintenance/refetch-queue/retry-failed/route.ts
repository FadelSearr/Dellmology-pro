import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RetryBody {
  symbol?: string;
}

export async function POST(request: Request) {
  try {
    await ensureRefetchQueueTable();

    const body = (await safeJson(request)) as RetryBody | undefined;
    const symbol = (body?.symbol || '').trim().toUpperCase();

    const values: Array<string> = [];
    let symbolFilterSql = '';

    if (symbol) {
      values.push(symbol);
      symbolFilterSql = ` AND symbol = $${values.length}`;
    }

    const result = await db.query(
      `
        UPDATE maintenance_refetch_queue
        SET status = 'PENDING',
            note = CASE
              WHEN note IS NULL OR note = '' THEN 'Manual retry requested from dashboard'
              ELSE note || ' | Manual retry requested'
            END,
            updated_at = NOW()
        WHERE status = 'FAILED'
          ${symbolFilterSql}
        RETURNING id, symbol, run_date_wib, status, updated_at
      `,
      values,
    );

    const uniqueSymbols = Array.from(new Set(result.rows.map((row) => String(row.symbol || '').toUpperCase()).filter(Boolean)));

    return NextResponse.json({
      success: true,
      retried_count: result.rowCount || 0,
      symbols: uniqueSymbols,
      symbol_filter: symbol || null,
      retried_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('refetch-queue retry-failed POST failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to retry failed refetch queue' }, { status: 500 });
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
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
