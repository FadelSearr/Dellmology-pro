import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ORCH_STATE_KEY = 'maintenance_orchestrator_state';
const MONTHLY_POSTMORTEM_KEY = 'postmortem_monthly_latest';

type Vote = 'BUY' | 'SELL' | 'NEUTRAL';

interface OrchestratorState {
  last_nightly_run_date_wib?: string | null;
  last_monthly_run_key?: string | null;
  last_error?: string | null;
  nightly?: {
    ran_at?: string;
    pass?: boolean;
    reconciliation_flagged_days?: number;
    failed_symbols?: string[];
    regression_mismatches?: number;
    refetch_queue_added?: number;
    fingerprint?: {
      hard_reset_recommended?: boolean;
      reasons?: string[];
      cross_check_deviation_pct?: number;
      reconciliation_flagged_days?: number;
      threshold_pct?: number;
    };
    worker_hard_reset_requested?: boolean;
    retention?: {
      session_token_flushed?: number;
      trades_purged?: number;
      snapshots_purged?: number;
    };
  };
  monthly?: {
    ran_at?: string;
    month_key?: string;
    evaluated_signals?: number;
    losing_signals?: number;
    loss_rate_pct?: number;
    top_failure_flags?: Array<{ flag: string; count: number }>;
    top_loss_symbols?: Array<{ symbol: string; losses: number }>;
    challenger_swap_recommended?: boolean;
  };
}

export async function GET() {
  try {
    await ensureConfigTable();
    await ensureMonthlyAuditTable();
    await ensureRefetchQueueTable();

    const state = await readJsonConfig<OrchestratorState>(ORCH_STATE_KEY);
    const postmortem = await readJsonConfig<Record<string, unknown>>(MONTHLY_POSTMORTEM_KEY);

    const nowWib = getWibNow();
    const nowDateKey = toDateKey(nowWib);
    const nowMonthKey = toMonthKey(nowWib);

    return NextResponse.json({
      success: true,
      timezone: 'Asia/Jakarta',
      now_wib: nowWib.toISOString(),
      status: {
        nightly_last_date_wib: state?.last_nightly_run_date_wib || null,
        monthly_last_key: state?.last_monthly_run_key || null,
        nightly_due:
          !state?.last_nightly_run_date_wib && isNightlyWindow(nowWib)
            ? true
            : state?.last_nightly_run_date_wib !== nowDateKey && isNightlyWindow(nowWib),
        monthly_due:
          !state?.last_monthly_run_key && isMonthlyWindow(nowWib)
            ? true
            : state?.last_monthly_run_key !== nowMonthKey && isMonthlyWindow(nowWib),
        last_error: state?.last_error || null,
      },
      latest: {
        nightly: state?.nightly || null,
        monthly: state?.monthly || postmortem || null,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance orchestrator GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to read orchestrator status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureConfigTable();
    await ensureMonthlyAuditTable();
    await ensureRefetchQueueTable();

    const body = (await safeJson(request)) as
      | {
          symbol?: string;
          forceNightly?: boolean;
          forceMonthly?: boolean;
        }
      | undefined;

    const symbol = (body?.symbol || 'BBCA').toUpperCase();
    const forceNightly = body?.forceNightly === true;
    const forceMonthly = body?.forceMonthly === true;

    const nowUtc = new Date();
    const nowWib = getWibNow(nowUtc);
    const dateKeyWib = toDateKey(nowWib);
    const monthKeyWib = toMonthKey(nowWib);

    const state = (await readJsonConfig<OrchestratorState>(ORCH_STATE_KEY)) || {};

    const runNightly =
      forceNightly ||
      (isNightlyWindow(nowWib) && state.last_nightly_run_date_wib !== dateKeyWib);
    const runMonthly =
      forceMonthly ||
      (isMonthlyWindow(nowWib) && state.last_monthly_run_key !== monthKeyWib);

    let nightlyResult: OrchestratorState['nightly'] | null = null;
    let monthlyResult: OrchestratorState['monthly'] | null = null;

    if (runNightly) {
      const [reconciliation, regression, retention, fingerprint] = await Promise.all([
        runNightlyReconciliation(symbol, 1, 3),
        runLogicRegression(symbol, 200),
        runRetention(),
        runStatisticalFingerprint(symbol, 2, 1, 3),
      ]);

      let refetchQueueAdded = 0;
      let workerHardResetRequested = false;
      if (reconciliation.failed_symbols.length > 0) {
        refetchQueueAdded = await enqueueRefetchSymbols(
          reconciliation.failed_symbols,
          dateKeyWib,
          `Nightly reconciliation deviation > ${reconciliation.threshold_pct}%`,
        );
      }

      if (fingerprint.hard_reset_recommended) {
        workerHardResetRequested = await requestWorkerHardReset(
          `Fingerprint drift detected: ${fingerprint.reasons.join(' | ')}`,
        );
      }

      nightlyResult = {
        ran_at: nowUtc.toISOString(),
        pass: reconciliation.flagged_days === 0 && regression.mismatches === 0 && !fingerprint.hard_reset_recommended,
        reconciliation_flagged_days: reconciliation.flagged_days,
        failed_symbols: reconciliation.failed_symbols,
        regression_mismatches: regression.mismatches,
        refetch_queue_added: refetchQueueAdded,
        fingerprint,
        worker_hard_reset_requested: workerHardResetRequested,
        retention,
      };

      state.last_nightly_run_date_wib = dateKeyWib;
      state.nightly = nightlyResult;
    }

    if (runMonthly) {
      const [postmortem, modelComparison] = await Promise.all([
        runMonthlyPostMortem(),
        runChampionChallenger(symbol, 30, 1),
      ]);

      monthlyResult = {
        ran_at: nowUtc.toISOString(),
        month_key: monthKeyWib,
        evaluated_signals: postmortem.evaluated_signals,
        losing_signals: postmortem.losing_signals,
        loss_rate_pct: postmortem.loss_rate_pct,
        top_failure_flags: postmortem.top_failure_flags,
        top_loss_symbols: postmortem.top_loss_symbols,
        challenger_swap_recommended: modelComparison.swap_recommended,
      };

      state.last_monthly_run_key = monthKeyWib;
      state.monthly = monthlyResult;

      await writeJsonConfig(MONTHLY_POSTMORTEM_KEY, monthlyResult);
      await writeMonthlyAuditHistory(monthKeyWib, monthlyResult);
    }

    state.last_error = null;
    await writeJsonConfig(ORCH_STATE_KEY, state);

    return NextResponse.json({
      success: true,
      symbol,
      executed: {
        nightly: runNightly,
        monthly: runMonthly,
      },
      nightly: nightlyResult,
      monthly: monthlyResult,
      state,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('maintenance orchestrator POST failed:', error);

    try {
      const current = (await readJsonConfig<OrchestratorState>(ORCH_STATE_KEY)) || {};
      current.last_error = error instanceof Error ? error.message : 'orchestrator_failed';
      await writeJsonConfig(ORCH_STATE_KEY, current);
    } catch (innerError) {
      console.error('maintenance orchestrator error-state update failed:', innerError);
    }

    return NextResponse.json({ success: false, error: 'Failed to run orchestrator' }, { status: 500 });
  }
}

async function runNightlyReconciliation(symbol: string, thresholdPct: number, days: number) {
  const result = await db.query(
    `
      WITH trade_agg AS (
        SELECT
          DATE(timestamp) AS trade_date,
          symbol,
          SUM(volume)::bigint AS internal_volume
        FROM trades
        WHERE symbol = $1
          AND DATE(timestamp) >= CURRENT_DATE - ($3::text || ' day')::interval
        GROUP BY DATE(timestamp), symbol
      )
      SELECT
        d.date AS trade_date,
        d.symbol,
        COALESCE(t.internal_volume, 0)::bigint AS internal_volume,
        d.volume::bigint AS reference_volume,
        CASE
          WHEN d.volume = 0 THEN 0
          ELSE ROUND(ABS(COALESCE(t.internal_volume, 0) - d.volume)::numeric / d.volume::numeric * 100.0, 4)
        END AS deviation_pct
      FROM daily_prices d
      LEFT JOIN trade_agg t
        ON t.trade_date = d.date
       AND t.symbol = d.symbol
      WHERE d.symbol = $1
        AND d.date >= CURRENT_DATE - ($3::text || ' day')::interval
      ORDER BY d.date DESC
    `,
    [symbol, thresholdPct, days],
  );

  const flaggedRows = result.rows.filter((row) => Number(row.deviation_pct || 0) > thresholdPct);
  const failedSymbols = Array.from(new Set(flaggedRows.map((row) => String(row.symbol || '').toUpperCase()).filter(Boolean)));

  return {
    checked_days: result.rows.length,
    flagged_days: flaggedRows.length,
    failed_symbols: failedSymbols,
    threshold_pct: thresholdPct,
  };
}

async function runLogicRegression(symbol: string, limit: number) {
  const result = await db.query(
    `
      SELECT id, symbol, signal, payload
      FROM signal_snapshots
      WHERE symbol = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [symbol, limit],
  );

  let mismatches = 0;

  for (const row of result.rows) {
    const payload = row.payload || {};
    const votes = payload.votes || {};

    const technical = (votes.technical || 'NEUTRAL') as Vote;
    const bandarmology = (votes.bandarmology || 'NEUTRAL') as Vote;
    const sentiment = (votes.sentiment || 'NEUTRAL') as Vote;

    const allVotes = [technical, bandarmology, sentiment];
    const computedBuyVotes = allVotes.filter((vote) => vote === 'BUY').length;
    const computedSellVotes = allVotes.filter((vote) => vote === 'SELL').length;
    const computedSignal: Vote = computedBuyVotes >= 2 ? 'BUY' : computedSellVotes >= 2 ? 'SELL' : 'NEUTRAL';

    const storedBuyVotes = Number(votes.buy_votes ?? computedBuyVotes);
    const storedSellVotes = Number(votes.sell_votes ?? computedSellVotes);

    if (storedBuyVotes !== computedBuyVotes || storedSellVotes !== computedSellVotes || row.signal !== computedSignal) {
      mismatches += 1;
    }
  }

  return {
    checked_cases: result.rows.length,
    mismatches,
    pass: mismatches === 0,
  };
}

async function runRetention() {
  const now = new Date();
  const afterClose = isAfterMarketCloseWib(now);

  let sessionTokenFlushed = 0;
  if (afterClose) {
    const flushResult = await db.query(
      `
        DELETE FROM config
        WHERE key = 'session_token'
      `,
    );
    sessionTokenFlushed = flushResult.rowCount || 0;
  }

  const purgeTrades = await db.query(
    `
      DELETE FROM trades
      WHERE timestamp < NOW() - INTERVAL '7 days'
    `,
  );

  const purgeSnapshots = await db.query(
    `
      DELETE FROM signal_snapshots
      WHERE created_at < NOW() - INTERVAL '90 days'
    `,
  );

  return {
    after_close_wib: afterClose,
    session_token_flushed: sessionTokenFlushed,
    trades_purged: purgeTrades.rowCount || 0,
    snapshots_purged: purgeSnapshots.rowCount || 0,
  };
}

async function runMonthlyPostMortem() {
  const result = await db.query(
    `
      WITH monthly AS (
        SELECT id, symbol, signal, price::numeric AS price, payload, created_at
        FROM signal_snapshots
        WHERE signal IN ('BUY', 'SELL')
          AND price IS NOT NULL
          AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta') - INTERVAL '1 month'
          AND created_at < date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')
      ),
      evaluated AS (
        SELECT
          m.id,
          m.symbol,
          m.signal,
          m.price,
          m.payload,
          future_snap.price AS future_price,
          CASE
            WHEN future_snap.price IS NULL THEN NULL
            WHEN m.signal = 'BUY' THEN (future_snap.price < m.price * (1 + 0.5 / 100.0))
            WHEN m.signal = 'SELL' THEN (future_snap.price > m.price * (1 - 0.5 / 100.0))
            ELSE NULL
          END AS is_loss
        FROM monthly m
        LEFT JOIN LATERAL (
          SELECT s2.price::numeric AS price
          FROM signal_snapshots s2
          WHERE s2.symbol = m.symbol
            AND s2.price IS NOT NULL
            AND s2.created_at >= m.created_at + INTERVAL '30 minutes'
          ORDER BY s2.created_at ASC
          LIMIT 1
        ) AS future_snap ON TRUE
      )
      SELECT
        COUNT(*) FILTER (WHERE is_loss IS NOT NULL)::int AS evaluated_signals,
        COUNT(*) FILTER (WHERE is_loss = TRUE)::int AS losing_signals,
        COUNT(*) FILTER (WHERE is_loss = TRUE AND (payload->'risk'->>'global_risk_mode')::boolean IS TRUE)::int AS loss_global_risk_mode,
        COUNT(*) FILTER (WHERE is_loss = TRUE AND (payload->'context'->>'wash_sale_score')::numeric >= 70)::int AS loss_high_wash_sale,
        COUNT(*) FILTER (WHERE is_loss = TRUE AND (payload->'risk'->>'systemic_risk_high')::boolean IS TRUE)::int AS loss_systemic_risk,
        COUNT(*) FILTER (WHERE is_loss = TRUE AND COALESCE(payload->'context'->>'narrative_confidence', '') = 'LOW')::int AS loss_low_narrative_confidence
      FROM evaluated
    `,
  );

  const summary = result.rows[0] || {};
  const evaluatedSignals = Number(summary.evaluated_signals || 0);
  const losingSignals = Number(summary.losing_signals || 0);
  const lossRatePct = evaluatedSignals > 0 ? Number(((losingSignals / evaluatedSignals) * 100).toFixed(2)) : 0;

  const topFailureFlags = [
    { flag: 'global_risk_mode', count: Number(summary.loss_global_risk_mode || 0) },
    { flag: 'high_wash_sale', count: Number(summary.loss_high_wash_sale || 0) },
    { flag: 'systemic_risk_high', count: Number(summary.loss_systemic_risk || 0) },
    { flag: 'low_narrative_confidence', count: Number(summary.loss_low_narrative_confidence || 0) },
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const topSymbolsResult = await db.query(
    `
      WITH monthly AS (
        SELECT id, symbol, signal, price::numeric AS price, created_at
        FROM signal_snapshots
        WHERE signal IN ('BUY', 'SELL')
          AND price IS NOT NULL
          AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta') - INTERVAL '1 month'
          AND created_at < date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta')
      ),
      evaluated AS (
        SELECT
          m.symbol,
          CASE
            WHEN future_snap.price IS NULL THEN NULL
            WHEN m.signal = 'BUY' THEN (future_snap.price < m.price * (1 + 0.5 / 100.0))
            WHEN m.signal = 'SELL' THEN (future_snap.price > m.price * (1 - 0.5 / 100.0))
            ELSE NULL
          END AS is_loss
        FROM monthly m
        LEFT JOIN LATERAL (
          SELECT s2.price::numeric AS price
          FROM signal_snapshots s2
          WHERE s2.symbol = m.symbol
            AND s2.price IS NOT NULL
            AND s2.created_at >= m.created_at + INTERVAL '30 minutes'
          ORDER BY s2.created_at ASC
          LIMIT 1
        ) AS future_snap ON TRUE
      )
      SELECT symbol, COUNT(*)::int AS losses
      FROM evaluated
      WHERE is_loss = TRUE
      GROUP BY symbol
      ORDER BY losses DESC
      LIMIT 3
    `,
  );

  return {
    evaluated_signals: evaluatedSignals,
    losing_signals: losingSignals,
    loss_rate_pct: lossRatePct,
    top_failure_flags: topFailureFlags,
    top_loss_symbols: topSymbolsResult.rows.map((row) => ({
      symbol: String(row.symbol),
      losses: Number(row.losses || 0),
    })),
  };
}

async function runStatisticalFingerprint(symbol: string, deviationThresholdPct: number, reconThresholdPct: number, reconDays: number) {
  const latestTradeResult = await db.query(
    `
      SELECT price, timestamp
      FROM trades
      WHERE symbol = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `,
    [symbol],
  );

  const latestPrice = Number(latestTradeResult.rows[0]?.price || 0);
  const latestTimestamp = latestTradeResult.rows[0]?.timestamp || null;

  let externalPrice = 0;
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}.JK`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const body = (await response.json()) as {
        quoteResponse?: { result?: Array<{ regularMarketPrice?: number }> };
      };
      externalPrice = Number(body?.quoteResponse?.result?.[0]?.regularMarketPrice || 0);
    }
  } catch {
    externalPrice = 0;
  }

  const crossCheckDeviationPct =
    externalPrice > 0 && latestPrice > 0 ? Number((Math.abs((latestPrice - externalPrice) / externalPrice) * 100).toFixed(4)) : 0;

  const reconciliation = await runNightlyReconciliation(symbol, reconThresholdPct, reconDays);

  const reasons: string[] = [];
  if (crossCheckDeviationPct > deviationThresholdPct) {
    reasons.push(`cross-check deviation ${crossCheckDeviationPct.toFixed(2)}% > ${deviationThresholdPct.toFixed(2)}%`);
  }
  if (reconciliation.flagged_days > 0) {
    reasons.push(`reconciliation flagged ${reconciliation.flagged_days}/${reconciliation.checked_days} day(s)`);
  }

  return {
    hard_reset_recommended: reasons.length > 0,
    reasons,
    latest_trade_at: latestTimestamp,
    local_price: latestPrice,
    external_price: externalPrice,
    cross_check_deviation_pct: crossCheckDeviationPct,
    reconciliation_flagged_days: reconciliation.flagged_days,
    threshold_pct: deviationThresholdPct,
  };
}

async function requestWorkerHardReset(reason: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  await db.query(
    `
      INSERT INTO config (key, value, updated_at)
      VALUES
        ('worker_hard_reset_requested', 'true', NOW()),
        ('worker_hard_reset_reason', $1, NOW()),
        ('worker_hard_reset_requested_at', $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW();
    `,
    [reason, nowIso],
  );
  return true;
}

async function runChampionChallenger(symbol: string, days: number, horizonDays: number) {
  const versions = await resolveVersions(symbol);

  if (!versions.champion || !versions.challenger) {
    return {
      swap_recommended: false,
    };
  }

  const metrics = await db.query(
    `
      WITH scoped AS (
        SELECT
          p.date,
          p.symbol,
          p.prediction,
          p.model_version,
          d0.close::numeric AS close_t,
          d1.close::numeric AS close_t1
        FROM cnn_predictions p
        JOIN daily_prices d0
          ON d0.symbol = p.symbol
         AND d0.date = p.date
        JOIN daily_prices d1
          ON d1.symbol = p.symbol
         AND d1.date = p.date + ($4::text || ' day')::interval
        WHERE p.symbol = $1
          AND p.date >= CURRENT_DATE - ($3::text || ' day')::interval
          AND p.model_version = ANY($2::text[])
      ),
      evaluated AS (
        SELECT
          model_version,
          prediction,
          close_t,
          close_t1,
          ((close_t1 - close_t) / NULLIF(close_t, 0)) * 100.0 AS realized_return_pct,
          CASE
            WHEN prediction = 'UP' AND close_t1 > close_t THEN 1
            WHEN prediction = 'DOWN' AND close_t1 < close_t THEN 1
            ELSE 0
          END AS is_hit
        FROM scoped
      )
      SELECT
        model_version,
        COUNT(*)::int AS total_predictions,
        ROUND((SUM(is_hit)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS accuracy_pct,
        ROUND(AVG(realized_return_pct), 4) AS avg_return_pct
      FROM evaluated
      GROUP BY model_version
    `,
    [symbol, [versions.champion, versions.challenger], days, horizonDays],
  );

  const champion = metrics.rows.find((row) => row.model_version === versions.champion) || null;
  const challenger = metrics.rows.find((row) => row.model_version === versions.challenger) || null;

  if (!champion || !challenger) {
    return {
      swap_recommended: false,
    };
  }

  const championAccuracy = Number(champion.accuracy_pct || 0);
  const challengerAccuracy = Number(challenger.accuracy_pct || 0);
  const championReturn = Number(champion.avg_return_pct || 0);
  const challengerReturn = Number(challenger.avg_return_pct || 0);

  const winner =
    challengerAccuracy > championAccuracy
      ? 'CHALLENGER'
      : challengerAccuracy < championAccuracy
        ? 'CHAMPION'
        : challengerReturn > championReturn
          ? 'CHALLENGER'
          : 'CHAMPION';

  return {
    swap_recommended: winner === 'CHALLENGER',
  };
}

async function resolveVersions(symbol: string) {
  const result = await db.query(
    `
      SELECT model_version, MAX(date) AS last_date
      FROM cnn_predictions
      WHERE symbol = $1
        AND model_version IS NOT NULL
      GROUP BY model_version
      ORDER BY last_date DESC
      LIMIT 2
    `,
    [symbol],
  );

  const discovered = result.rows.map((row) => row.model_version as string).filter(Boolean);
  return {
    champion: discovered[0] || null,
    challenger: discovered[1] || null,
  };
}

async function ensureConfigTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureMonthlyAuditTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_monthly_audit (
      month_key TEXT PRIMARY KEY,
      report JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureRefetchQueueTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_refetch_queue (
      id BIGSERIAL PRIMARY KEY,
      symbol VARCHAR(16) NOT NULL,
      reason TEXT NOT NULL,
      run_date_wib TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      note TEXT,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (symbol, run_date_wib)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_refetch_queue_status_time
      ON maintenance_refetch_queue (status, queued_at DESC)
  `);
}

async function enqueueRefetchSymbols(symbols: string[], runDateWib: string, reason: string) {
  let added = 0;

  for (const symbol of symbols) {
    const result = await db.query(
      `
        INSERT INTO maintenance_refetch_queue (symbol, reason, run_date_wib, status, queued_at, updated_at)
        VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())
        ON CONFLICT (symbol, run_date_wib) DO UPDATE
        SET reason = EXCLUDED.reason,
            status = CASE
              WHEN maintenance_refetch_queue.status IN ('DONE', 'FAILED') THEN 'PENDING'
              ELSE maintenance_refetch_queue.status
            END,
            updated_at = NOW()
        RETURNING id
      `,
      [symbol.toUpperCase(), reason, runDateWib],
    );

    if ((result.rowCount || 0) > 0) {
      added += 1;
    }
  }

  return added;
}

async function writeMonthlyAuditHistory(monthKey: string, report: unknown) {
  await db.query(
    `
      INSERT INTO maintenance_monthly_audit (month_key, report, created_at, updated_at)
      VALUES ($1, $2::jsonb, NOW(), NOW())
      ON CONFLICT (month_key) DO UPDATE
      SET report = EXCLUDED.report, updated_at = NOW()
    `,
    [monthKey, JSON.stringify(report)],
  );
}

async function readJsonConfig<T>(key: string): Promise<T | null> {
  const result = await db.query(
    `
      SELECT value
      FROM config
      WHERE key = $1
      LIMIT 1
    `,
    [key],
  );

  const value = result.rows[0]?.value;
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function writeJsonConfig(key: string, value: unknown) {
  await db.query(
    `
      INSERT INTO config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(value)],
  );
}

function getWibNow(nowUtc: Date = new Date()) {
  return new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
}

function toDateKey(wibDate: Date) {
  return wibDate.toISOString().slice(0, 10);
}

function toMonthKey(wibDate: Date) {
  return wibDate.toISOString().slice(0, 7);
}

function isNightlyWindow(wibDate: Date) {
  const hour = wibDate.getUTCHours();
  return hour >= 20;
}

function isMonthlyWindow(wibDate: Date) {
  const day = wibDate.getUTCDate();
  const hour = wibDate.getUTCHours();
  return day === 1 && hour >= 6;
}

function isAfterMarketCloseWib(now: Date): boolean {
  const nowWib = getWibNow(now);
  const hour = nowWib.getUTCHours();
  const minute = nowWib.getUTCMinutes();
  if (hour > 16) {
    return true;
  }
  if (hour === 16 && minute >= 0) {
    return true;
  }
  return false;
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
