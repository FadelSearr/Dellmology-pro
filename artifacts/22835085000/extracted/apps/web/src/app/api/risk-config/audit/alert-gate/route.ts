import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type EventType = 'LOCK' | 'UNLOCK';

interface AlertGateBody {
  chain_key?: string;
  event_type?: EventType;
  cooldown_ms?: number;
}

export async function POST(request: Request) {
  let client;
  try {
    const body = (await request.json()) as AlertGateBody;
    const chainKey = (body.chain_key || '__GLOBAL__').trim() || '__GLOBAL__';
    const eventType = body.event_type;
    const cooldownMs = Math.min(60 * 60 * 1000, Math.max(30 * 1000, Number(body.cooldown_ms || 10 * 60 * 1000)));

    if (eventType !== 'LOCK' && eventType !== 'UNLOCK') {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
    }

    await ensureConfigChainStateTables();

    client = await db.connect();
    await client.query('BEGIN');

    await client.query(
      `
        INSERT INTO runtime_config_chain_state (
          chain_key,
          is_valid,
          checked_rows,
          hash_mismatches,
          linkage_mismatches,
          last_verified_at,
          updated_at
        ) VALUES ($1, TRUE, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (chain_key) DO NOTHING
      `,
      [chainKey],
    );

    const state = await client.query(
      `
        SELECT last_lock_alert_at, last_unlock_alert_at
        FROM runtime_config_chain_state
        WHERE chain_key = $1
        LIMIT 1
        FOR UPDATE
      `,
      [chainKey],
    );

    const row = state.rows[0] as { last_lock_alert_at?: string | null; last_unlock_alert_at?: string | null } | undefined;
    const lastAlertAtRaw = eventType === 'LOCK' ? row?.last_lock_alert_at || null : row?.last_unlock_alert_at || null;
    const nowMs = Date.now();
    const lastMs = lastAlertAtRaw ? new Date(lastAlertAtRaw).getTime() : 0;
    const elapsedMs = lastMs > 0 ? Math.max(0, nowMs - lastMs) : Number.POSITIVE_INFINITY;
    const allowed = elapsedMs >= cooldownMs;

    if (allowed) {
      const updateColumn = eventType === 'LOCK' ? 'last_lock_alert_at' : 'last_unlock_alert_at';
      await client.query(
        `
          UPDATE runtime_config_chain_state
          SET ${updateColumn} = NOW(), updated_at = NOW()
          WHERE chain_key = $1
        `,
        [chainKey],
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      chain_key: chainKey,
      event_type: eventType,
      cooldown_ms: cooldownMs,
      allowed,
      remaining_ms: allowed ? 0 : Math.max(0, cooldownMs - elapsedMs),
      last_alert_at: lastAlertAtRaw,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // noop
      }
    }
    console.error('risk-config alert-gate POST failed:', error);
    return NextResponse.json({ error: 'Failed to evaluate alert cooldown gate' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
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
    ALTER TABLE runtime_config_chain_state
    ADD COLUMN IF NOT EXISTS last_lock_alert_at TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE runtime_config_chain_state
    ADD COLUMN IF NOT EXISTS last_unlock_alert_at TIMESTAMPTZ
  `);
}
