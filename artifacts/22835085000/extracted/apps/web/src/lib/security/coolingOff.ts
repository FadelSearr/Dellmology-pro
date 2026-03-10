import { db } from '@/lib/db';

const ACTIVE_UNTIL_KEY = 'cooling_off_active_until';

export interface CoolingOffLockState {
  active: boolean;
  activeUntil: string | null;
  remainingSeconds: number;
}

export async function readCoolingOffLockState(): Promise<CoolingOffLockState> {
  const result = await db.query(
    `
      SELECT value
      FROM config
      WHERE key = $1
      LIMIT 1
    `,
    [ACTIVE_UNTIL_KEY],
  );

  const rawValue = result.rows[0]?.value as string | undefined;
  if (!rawValue) {
    return {
      active: false,
      activeUntil: null,
      remainingSeconds: 0,
    };
  }

  const activeUntil = new Date(rawValue);
  if (Number.isNaN(activeUntil.getTime())) {
    return {
      active: false,
      activeUntil: null,
      remainingSeconds: 0,
    };
  }

  const remainingSeconds = Math.max(0, Math.floor((activeUntil.getTime() - Date.now()) / 1000));
  return {
    active: remainingSeconds > 0,
    activeUntil: activeUntil.toISOString(),
    remainingSeconds,
  };
}
