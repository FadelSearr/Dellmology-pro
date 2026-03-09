import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SnapshotRow {
  id: number;
  symbol: string;
  timeframe: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  price: string | number | null;
  unified_power_score: number | null;
  payload: unknown;
  payload_hash: string | null;
  previous_hash: string | null;
  record_hash: string | null;
  hash_version: number | null;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(10, Number(searchParams.get('limit') || 200)));
    const symbolParam = (searchParams.get('symbol') || '').trim().toUpperCase();
    const symbol = symbolParam.length > 0 ? symbolParam : null;

    const result = await db.query(
      `
        SELECT
          id,
          symbol,
          timeframe,
          signal,
          price,
          unified_power_score,
          payload,
          payload_hash,
          previous_hash,
          record_hash,
          hash_version,
          created_at
        FROM signal_snapshots
        WHERE ($1::text IS NULL OR symbol = $1)
        ORDER BY id DESC
        LIMIT $2
      `,
      [symbol, limit],
    );

    const rows = [...(result.rows as SnapshotRow[])].reverse();
    let linkageFailures = 0;
    let checksumFailures = 0;
    let upgradedRows = 0;
    const issues: Array<{ id: number; type: 'LINK' | 'CHECKSUM'; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const previousRow = index > 0 ? rows[index - 1] : null;

      if (previousRow && row.previous_hash !== previousRow.record_hash) {
        linkageFailures += 1;
        if (issues.length < 20) {
          issues.push({
            id: row.id,
            type: 'LINK',
            message: 'previous_hash does not match prior record_hash',
          });
        }
      }

      if ((row.hash_version || 1) >= 2) {
        upgradedRows += 1;
        const normalizedPayload = stableStringify(row.payload);
        const expectedPayloadHash = sha256(normalizedPayload);
        const expectedRecordHash = sha256(
          [
            row.previous_hash || 'GENESIS',
            row.symbol,
            row.timeframe,
            row.signal,
            row.price ?? 'NULL',
            row.unified_power_score ?? 'NULL',
            expectedPayloadHash,
          ].join('|'),
        );

        const hasPayloadHashMismatch = (row.payload_hash || '') !== expectedPayloadHash;
        const hasRecordHashMismatch = (row.record_hash || '') !== expectedRecordHash;

        if (hasPayloadHashMismatch || hasRecordHashMismatch) {
          checksumFailures += 1;
          if (issues.length < 20) {
            issues.push({
              id: row.id,
              type: 'CHECKSUM',
              message: hasPayloadHashMismatch
                ? 'payload_hash mismatch'
                : 'record_hash mismatch',
            });
          }
        }
      }
    }

    const total = rows.length;
    const valid = total > 0 && linkageFailures === 0 && checksumFailures === 0;

    return NextResponse.json({
      valid,
      symbol,
      checked_rows: total,
      upgraded_rows: upgradedRows,
      linkage_failures: linkageFailures,
      checksum_failures: checksumFailures,
      issues,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('signal-snapshots integrity GET failed:', error);
    return NextResponse.json({ error: 'Failed to audit signal snapshot integrity' }, { status: 500 });
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`;
}
