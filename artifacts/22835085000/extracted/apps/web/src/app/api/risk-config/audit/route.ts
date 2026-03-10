import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key')?.trim() || null;
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

    await ensureConfigAuditTable();

    const params: Array<string | number> = [limit];
    let whereClause = '';

    if (key) {
      params.unshift(key);
      whereClause = 'WHERE config_key = $1';
    }

    const query = key
      ? `
        SELECT id, config_key, old_value, new_value, actor, source, payload_hash, previous_hash, record_hash, hash_version, created_at
        FROM runtime_config_audit
        ${whereClause}
        ORDER BY id DESC
        LIMIT $2
      `
      : `
        SELECT id, config_key, old_value, new_value, actor, source, payload_hash, previous_hash, record_hash, hash_version, created_at
        FROM runtime_config_audit
        ORDER BY id DESC
        LIMIT $1
      `;

    const result = await db.query(query, params);

    return NextResponse.json({
      success: true,
      key,
      count: result.rows.length,
      audit: result.rows,
    });
  } catch (error) {
    console.error('risk-config audit GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch risk-config audit' }, { status: 500 });
  }
}

async function ensureConfigAuditTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS runtime_config_audit (
      id BIGSERIAL PRIMARY KEY,
      config_key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      actor TEXT,
      source TEXT,
      payload_hash TEXT,
      previous_hash TEXT,
      record_hash TEXT NOT NULL,
      hash_version SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_runtime_config_audit_key_time
      ON runtime_config_audit (config_key, created_at DESC)
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_config_audit_record_hash
      ON runtime_config_audit (record_hash)
  `);
}
