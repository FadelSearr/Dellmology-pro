import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_CONFIG = {
  ihsg_risk_trigger_pct: -1.5,
  ups_min_normal: 70,
  ups_min_risk: 90,
  roc_threshold_pct: -5,
  roc_haki_ratio: 0.6,
  roc_min_trades: 5,
  confidence_window: 20,
  confidence_required_signals: 10,
  confidence_miss_threshold: 7,
  confidence_horizon_minutes: 30,
  confidence_slippage_pct: 0.5,
} as const;

type ConfigKey = keyof typeof DEFAULT_CONFIG;

export async function GET() {
  try {
    await ensureConfigTable();

    const result = await db.query(
      `
        SELECT key, value
        FROM system_runtime_config
        WHERE key = ANY($1::text[])
      `,
      [Object.keys(DEFAULT_CONFIG)],
    );

    const merged: Record<string, number> = { ...DEFAULT_CONFIG };
    for (const row of result.rows as Array<{ key: string; value: string }>) {
      const key = row.key as ConfigKey;
      if (!(key in DEFAULT_CONFIG)) {
        continue;
      }
      const parsed = Number(row.value);
      if (Number.isFinite(parsed)) {
        merged[key] = parsed;
      }
    }

    return NextResponse.json({
      config: merged,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('risk-config GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch risk config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Record<ConfigKey, number>>;
    await ensureConfigTable();

    const entries = Object.entries(body).filter(([key, value]) => {
      if (!(key in DEFAULT_CONFIG)) {
        return false;
      }
      return Number.isFinite(Number(value));
    }) as Array<[ConfigKey, number]>;

    for (const [key, value] of entries) {
      await db.query(
        `
          INSERT INTO system_runtime_config (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [key, String(value)],
      );
    }

    return GET();
  } catch (error) {
    console.error('risk-config POST failed:', error);
    return NextResponse.json({ error: 'Failed to update risk config' }, { status: 500 });
  }
}

async function ensureConfigTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_runtime_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
