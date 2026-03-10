import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key')?.trim() || '__GLOBAL__';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

    await ensureConfigChainStateTables();

    const result = await db.query(
      `
        SELECT id, chain_key, event_type, checked_rows, hash_mismatches, linkage_mismatches, note, created_at
        FROM runtime_config_lock_events
        WHERE chain_key = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [key, limit],
    );

    return NextResponse.json({
      success: true,
      key,
      count: result.rows.length,
      events: result.rows,
    });
  } catch (error) {
    console.error('risk-config lock-events GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch risk-config lock events' }, { status: 500 });
  }
}

async function ensureConfigChainStateTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_config_chain_state (
      chain_key TEXT PRIMARY KEY,
      is_valid BOOLEAN NOT NULL DEFAULT TRUE,
      checked_rows INTEGER NOT NULL DEFAULT 0,
      hash_mismatches INTEGER NOT NULL DEFAULT 0,
      linkage_mismatches INTEGER NOT NULL DEFAULT 0,
      last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_config_lock_events (
      id BIGSERIAL PRIMARY KEY,
      chain_key TEXT NOT NULL,
      event_type TEXT NOT NULL,
      checked_rows INTEGER NOT NULL DEFAULT 0,
      hash_mismatches INTEGER NOT NULL DEFAULT 0,
      linkage_mismatches INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_runtime_config_lock_events_key_time
      ON runtime_config_lock_events (chain_key, created_at DESC)
  `);
}
