import type { CoolingOffLockState } from '@/lib/security/coolingOff';

interface ImmutableAuditLike {
  checkedRows: number;
  hashMismatches: number;
  linkageMismatches: number;
}

export function buildCoolingOffLockPayload(
  coolingOff: CoolingOffLockState,
  error: string,
  includeSuccess = false,
) {
  const payload = {
    error,
    lock: {
      active_until: coolingOff.activeUntil,
      remaining_seconds: coolingOff.remainingSeconds,
    },
  };

  return includeSuccess ? { success: false, ...payload } : payload;
}

export function buildImmutableAuditLockPayload(
  immutableAudit: ImmutableAuditLike,
  error = 'Runtime config audit chain verification failed',
) {
  return {
    success: false,
    error,
    lock: {
      checked_rows: immutableAudit.checkedRows,
      hash_mismatches: immutableAudit.hashMismatches,
      linkage_mismatches: immutableAudit.linkageMismatches,
    },
  };
}
