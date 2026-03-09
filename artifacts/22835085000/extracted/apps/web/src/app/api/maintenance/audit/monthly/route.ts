import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureMonthlyAuditTable();

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || 6)));
    const monthKey = (searchParams.get('month') || '').trim();

    if (monthKey) {
      const single = await db.query(
        `
          SELECT month_key, report, created_at, updated_at
          FROM maintenance_monthly_audit
          WHERE month_key = $1
          LIMIT 1
        `,
        [monthKey],
      );

      return NextResponse.json({
        success: true,
        month_key: monthKey,
        report: single.rows[0]?.report || null,
        found: single.rows.length > 0,
        checked_at: new Date().toISOString(),
      });
    }

    const list = await db.query(
      `
        SELECT month_key, report, created_at, updated_at
        FROM maintenance_monthly_audit
        ORDER BY month_key DESC
        LIMIT $1
      `,
      [limit],
    );

    const rows = list.rows.map((row) => ({
      month_key: row.month_key as string,
      report: row.report,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      reports: rows,
      count: rows.length,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance monthly audit GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to read monthly audit reports' }, { status: 500 });
  }
}

async function ensureMonthlyAuditTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_monthly_audit (
      month_key TEXT PRIMARY KEY,
      report JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
