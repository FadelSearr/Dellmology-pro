import { createHash } from 'crypto';
import { db } from '@/lib/db';

export interface RuntimeConfigAuditChainResult {
  valid: boolean;
  checkedRows: number;
  hashMismatches: number;
  linkageMismatches: number;
}

export async function verifyRuntimeConfigAuditChain(): Promise<RuntimeConfigAuditChainResult> {
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

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [tableName]);
  return result.rows[0]?.exists === true;
}
