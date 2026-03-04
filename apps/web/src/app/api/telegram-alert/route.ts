import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

interface AlertPayload {
  type: 'trading' | 'market' | 'broker' | 'wash_sale' | 'screener' | 'backtest';
  symbol: string;
  data: Record<string, any>;
}

/**
 * POST /api/telegram-alert
 * Send alerts to Telegram via ML engine service
 */
export async function POST(req: NextRequest) {
  try {
    const immutableAudit = await verifyRuntimeConfigAuditChain();
    if (!immutableAudit.valid) {
      return NextResponse.json(
        {
          error: 'Immutable audit chain lock active; telegram alert blocked',
          lock: true,
          checked_rows: immutableAudit.checkedRows,
          hash_mismatches: immutableAudit.hashMismatches,
          linkage_mismatches: immutableAudit.linkageMismatches,
        },
        { status: 423 },
      );
    }

    const payload: AlertPayload = await req.json();

    // Validation
    if (!payload.type || !payload.symbol || !payload.data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Forward to Python ML engine
    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${ML_ENGINE_URL}/telegram/alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`ML Engine error: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      alert_type: payload.type,
      symbol: payload.symbol,
      sent_at: new Date().toISOString(),
      details: result,
    });
  } catch (error) {
    console.error('Telegram alert error:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send alert',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telegram-alert
 * Get alert status/history
 */
export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get('symbol');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

    const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:8001';
    
    const query = new URLSearchParams();
    if (symbol) query.append('symbol', symbol);
    query.append('limit', limit.toString());

    const response = await fetch(`${ML_ENGINE_URL}/telegram/history?${query}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`ML Engine error: ${response.status}`);
    }

    const history = await response.json();

    return NextResponse.json({
      alerts: history,
      count: Array.isArray(history) ? history.length : 0,
    });
  } catch (error) {
    console.error('Error fetching alert history:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch history',
      },
      { status: 500 }
    );
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [tableName]);
  return result.rows[0]?.exists === true;
}

async function verifyRuntimeConfigAuditChain(): Promise<{
  valid: boolean;
  checkedRows: number;
  hashMismatches: number;
  linkageMismatches: number;
}> {
  const hasAuditTable = await tableExists('runtime_config_audit');
  if (!hasAuditTable) {
    return {
      valid: false,
      checkedRows: 0,
      hashMismatches: 1,
      linkageMismatches: 1,
    };
  }

  const result = await db.query(
    `
      SELECT id, config_key, old_value, new_value, actor, source, payload_hash, previous_hash, record_hash
      FROM runtime_config_audit
      ORDER BY id ASC
    `,
  );

  let previousRecordHash: string | null = null;
  let hashMismatches = 0;
  let linkageMismatches = 0;

  for (const row of result.rows as Array<{
    id: number;
    config_key: string;
    old_value: string | null;
    new_value: string;
    actor: string | null;
    source: string | null;
    payload_hash: string | null;
    previous_hash: string | null;
    record_hash: string;
  }>) {
    const expectedRecordHash = sha256(
      [
        row.previous_hash || 'GENESIS',
        row.config_key,
        row.old_value ?? 'NULL',
        row.new_value,
        row.actor || '',
        row.source || '',
        row.payload_hash || '',
      ].join('|'),
    );

    if (expectedRecordHash !== row.record_hash) {
      hashMismatches += 1;
    }

    if (row.previous_hash !== (previousRecordHash || null)) {
      linkageMismatches += 1;
    }

    previousRecordHash = row.record_hash;
  }

  return {
    valid: hashMismatches === 0 && linkageMismatches === 0,
    checkedRows: result.rows.length,
    hashMismatches,
    linkageMismatches,
  };
}
