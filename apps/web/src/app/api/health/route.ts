import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * System health check endpoint
 */
export async function GET(request: Request) {
  try {
    let isSystemActive = process.env.SYSTEM_ACTIVE !== 'false';
    let configuredKillReason: string | null = null;
    const heartbeatTimeoutSeconds = 60;

    try {
      const systemConfig = await db.query(
        `
          SELECT key, value
          FROM config
          WHERE key IN ('is_system_active', 'kill_switch_reason')
        `,
      );

      const systemFlag = systemConfig.rows.find((row) => row.key === 'is_system_active')?.value;
      const reasonFlag = systemConfig.rows.find((row) => row.key === 'kill_switch_reason')?.value;

      if (systemFlag === 'true' || systemFlag === 'false') {
        isSystemActive = systemFlag === 'true';
      }

      if (reasonFlag && typeof reasonFlag === 'string') {
        configuredKillReason = reasonFlag;
      }
    } catch (err) {
      console.error('System control check failed:', err);
    }

    // Check database connection
    let dbConnected = false;
    try {
      const result = await db.query('SELECT 1');
      dbConnected = result.rows.length === 1;
    } catch (err) {
      console.error('DB health check failed:', err);
    }

    // Check data integrity (sample)
    let dataIntegrity = true;
    try {
      const tradesResult = await db.query(
        'SELECT COUNT(*) as count FROM trades WHERE symbol = $1 AND timestamp > NOW() - INTERVAL \'1 hour\'',
        ['BBCA']
      );
      
      if (tradesResult.rows[0]?.count < 10) {
        dataIntegrity = false; // Low activity might indicate data issue
      }
    } catch (err) {
      dataIntegrity = false;
    }

    // Check worker heartbeat (local engine online/offline)
    let workerOnline = false;
    let workerLastSeenSeconds: number | null = null;
    try {
      const heartbeatResult = await db.query(
        "SELECT value FROM config WHERE key = 'worker_last_heartbeat' LIMIT 1",
      );
      const heartbeatValue = heartbeatResult.rows[0]?.value;
      if (heartbeatValue) {
        const heartbeatAt = new Date(heartbeatValue);
        if (!Number.isNaN(heartbeatAt.getTime())) {
          workerLastSeenSeconds = Math.max(0, Math.floor((Date.now() - heartbeatAt.getTime()) / 1000));
          workerOnline = workerLastSeenSeconds <= heartbeatTimeoutSeconds;
        }
      }
    } catch (err) {
      console.error('Worker heartbeat check failed:', err);
    }

    const killSwitchReason =
      !isSystemActive
        ? configuredKillReason || 'Cloud kill-switch active'
        : !workerOnline
          ? 'Engine Offline - heartbeat timeout'
          : null;

    return NextResponse.json({
      status: 'OK',
      is_system_active: isSystemActive,
      kill_switch_reason: killSwitchReason,
      sse_connected: true,  // In production, track this from streamer
      db_connected: dbConnected,
      data_integrity: dataIntegrity,
      worker_online: workerOnline,
      worker_last_seen_seconds: workerLastSeenSeconds,
      heartbeat_timeout_seconds: heartbeatTimeoutSeconds,
      api_rate_limit: 65,   // Track from requests
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'UP' : 'DOWN',
        streamer: workerOnline,
        cache: true
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
