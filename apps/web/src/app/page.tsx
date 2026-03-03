'use client';

import { useEffect, useRef, useState } from 'react';
import { Calculator, Send, Bell, FileDown, FlaskConical } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AINarrativeDisplay } from '@/components/intelligence/AINarrativeDisplay';
import { MarketIntelligenceCanvas } from '@/components/dashboard/MarketIntelligenceCanvas';

import { Section0_CommandBar } from '@/components/sections/Section0_CommandBar';

interface ProcessedTrade {
  id: string;
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  type: 'HAKA' | 'HAKI' | 'NORMAL';
}

const MAX_TRADES_IN_LIST = 50;
const STREAM_URL = 'http://localhost:8080/stream';

interface BrokerEntry {
  broker_id: string;
  net_buy_value: number;
  active_days?: number;
  consistency_score?: number;
  avg_buy_price?: number;
  z_score?: number;
  is_whale?: boolean;
  is_retail?: boolean;
  daily_heatmap?: number[];
}

type ConsensusVote = 'BUY' | 'SELL' | 'NEUTRAL';

interface NarrativeConsensusResponse {
  confidence_score?: number;
  confidence_label?: 'LOW' | 'MEDIUM' | 'HIGH';
  market_bias?: ConsensusVote;
  market_bias_score?: number;
}

interface HealthResponse {
  is_system_active?: boolean;
  kill_switch_reason?: string | null;
  sse_connected?: boolean;
  db_connected?: boolean;
  data_integrity?: boolean;
  worker_online?: boolean;
  worker_last_seen_seconds?: number | null;
  heartbeat_timeout_seconds?: number;
}

interface CoolingState {
  active: boolean;
  until: string | null;
}

interface GlobalCorrelationResponse {
  change_ihsg?: number;
  change_dji?: number;
  global_sentiment?: 'BULLISH' | 'BEARISH';
  correlation_strength?: number;
}

interface GoldenRecordResponse {
  is_system_safe?: boolean;
  trigger_kill_switch?: boolean;
  failed_symbols?: string[];
  max_allowed_deviation_pct?: number;
}

interface ModelConfidenceResponse {
  evaluated_signals?: number;
  hits?: number;
  misses?: number;
  pending?: number;
  accuracy_pct?: number;
  confidence_label?: 'LOW' | 'MEDIUM' | 'HIGH';
  recalibration_required?: boolean;
  warning?: string | null;
}

interface SnapshotIntegrityResponse {
  valid?: boolean;
  checked_rows?: number;
  upgraded_rows?: number;
  linkage_failures?: number;
  checksum_failures?: number;
}

interface RiskConfigResponse {
  config?: {
    ihsg_risk_trigger_pct?: number;
    ups_min_normal?: number;
    ups_min_risk?: number;
    roc_threshold_pct?: number;
    roc_haki_ratio?: number;
    roc_min_trades?: number;
    confidence_window?: number;
    confidence_required_signals?: number;
    confidence_miss_threshold?: number;
    confidence_horizon_minutes?: number;
    confidence_slippage_pct?: number;
  };
}

interface ModelComparisonResponse {
  success?: boolean;
  champion?: {
    model_version: string;
    accuracy_pct: number;
    avg_return_pct: number;
    total_predictions: number;
  };
  challenger?: {
    model_version: string;
    accuracy_pct: number;
    avg_return_pct: number;
    total_predictions: number;
  };
  decision?: {
    winner?: 'CHAMPION' | 'CHALLENGER';
    swap_recommended?: boolean;
    reason?: string;
  };
}

interface DataReconciliationResponse {
  success?: boolean;
  threshold_pct?: number;
  checked_days?: number;
  flagged_days?: number;
  lock_recommended?: boolean;
}

interface LogicRegressionResponse {
  success?: boolean;
  checked_cases?: number;
  mismatches?: number;
  pass?: boolean;
  deployment_blocked?: boolean;
}

interface PriceCrossCheckResponse {
  success?: boolean;
  threshold_pct?: number;
  checked_symbols?: number;
  flagged_symbols?: string[];
  lock_recommended?: boolean;
}

interface DataSanityResponse {
  success?: boolean;
  contaminated?: boolean;
  checked_points?: number;
  max_jump_pct?: number;
  lock_recommended?: boolean;
  issues?: Array<{ detail: string }>;
}

interface MaintenanceRetentionResponse {
  success?: boolean;
  ran_at?: string;
  after_close_wib?: boolean;
  session_token_flushed?: number;
  trades_purged?: number;
  snapshots_purged?: number;
}

interface MaintenanceOrchestratorResponse {
  success?: boolean;
  status?: {
    nightly_last_date_wib?: string | null;
    monthly_last_key?: string | null;
    nightly_due?: boolean;
    monthly_due?: boolean;
    last_error?: string | null;
  };
  latest?: {
    nightly?: {
      pass?: boolean;
      reconciliation_flagged_days?: number;
      failed_symbols?: string[];
      regression_mismatches?: number;
      refetch_queue_added?: number;
    } | null;
    monthly?: {
      loss_rate_pct?: number;
      challenger_swap_recommended?: boolean;
      top_failure_flags?: Array<{ flag: string; count: number }>;
    } | null;
  };
}

interface MaintenanceRefetchQueueResponse {
  success?: boolean;
  queue?: Array<{
    id: number;
    symbol: string;
    reason: string;
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
    run_date_wib: string;
    note?: string | null;
    queued_at?: string;
    updated_at?: string;
  }>;
  summary?: {
    pending?: number;
    processing?: number;
    done?: number;
    failed?: number;
    total?: number;
  };
}

interface RetryFailedQueueResponse {
  success?: boolean;
  retried_count?: number;
  symbols?: string[];
  symbol_filter?: string | null;
  retried_at?: string;
  error?: string;
}

interface BetaPosition {
  symbol: string;
  weightPct: number;
  beta: number;
}

/**
 * Main Dashboard - Dellmology Command Center (Bento Grid)
 */
export default function Home() {
  const [symbol, setSymbol] = useState('BBCA');
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [trades, setTrades] = useState<ProcessedTrade[]>([]);
  const [brokerData, setBrokerData] = useState<BrokerEntry[]>([]);
  const [washSaleScore, setWashSaleScore] = useState(0);
  const [screenerMode, setScreenerMode] = useState<'DAYTRADE' | 'SWING' | 'CUSTOM'>('DAYTRADE');
  const [customRange, setCustomRange] = useState({ min: 100, max: 500 });
  const [positionInputs, setPositionInputs] = useState({ entry: 100, stopLoss: 2.5, atr: 4.5 });
  const [liquidityInputs, setLiquidityInputs] = useState({ avgDailyVolumeLots: 2_000_000, participationCapPct: 0.8 });
  const [narrativeSignal, setNarrativeSignal] = useState<{
    vote: ConsensusVote;
    score: number;
    label: 'LOW' | 'MEDIUM' | 'HIGH';
  }>({ vote: 'NEUTRAL', score: 50, label: 'LOW' });
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [killSwitchReason, setKillSwitchReason] = useState<string | null>(null);
  const [portfolioDrawdown, setPortfolioDrawdown] = useState(-1.2);
  const [cooling, setCooling] = useState<CoolingState>({ active: false, until: null });
  const [globalCorrelation, setGlobalCorrelation] = useState<{
    ihsgChangePct: number;
    djiChangePct: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    correlationStrength: number;
  }>({ ihsgChangePct: 0, djiChangePct: 0, sentiment: 'SIDEWAYS', correlationStrength: 0.5 });
  const [goldenRecord, setGoldenRecord] = useState<{
    lock: boolean;
    failedSymbols: string[];
    maxDeviationPct: number;
  }>({ lock: false, failedSymbols: [], maxDeviationPct: 2 });
  const [snapshotInfo, setSnapshotInfo] = useState<{ lastSavedAt: string | null; error: string | null }>({
    lastSavedAt: null,
    error: null,
  });
  const [modelConfidence, setModelConfidence] = useState<{
    evaluatedSignals: number;
    hits: number;
    misses: number;
    pending: number;
    accuracyPct: number;
    label: 'LOW' | 'MEDIUM' | 'HIGH';
    recalibrationRequired: boolean;
    warning: string | null;
  }>({
    evaluatedSignals: 0,
    hits: 0,
    misses: 0,
    pending: 0,
    accuracyPct: 0,
    label: 'LOW',
    recalibrationRequired: false,
    warning: null,
  });
  const [snapshotIntegrity, setSnapshotIntegrity] = useState<{
    valid: boolean;
    checkedRows: number;
    upgradedRows: number;
    linkageFailures: number;
    checksumFailures: number;
  }>({
    valid: true,
    checkedRows: 0,
    upgradedRows: 0,
    linkageFailures: 0,
    checksumFailures: 0,
  });
  const [riskConfig, setRiskConfig] = useState({
    ihsgRiskTriggerPct: -1.5,
    upsMinNormal: 70,
    upsMinRisk: 90,
    rocThresholdPct: -5,
    rocHakiRatio: 0.6,
    rocMinTrades: 5,
    confidenceWindow: 20,
    confidenceRequiredSignals: 10,
    confidenceMissThreshold: 7,
    confidenceHorizonMinutes: 30,
    confidenceSlippagePct: 0.5,
  });
  const [modelComparison, setModelComparison] = useState<{
    championVersion: string;
    challengerVersion: string;
    championAccuracy: number;
    challengerAccuracy: number;
    swapRecommended: boolean;
    winner: 'CHAMPION' | 'CHALLENGER';
  }>({
    championVersion: '-',
    challengerVersion: '-',
    championAccuracy: 0,
    challengerAccuracy: 0,
    swapRecommended: false,
    winner: 'CHAMPION',
  });
  const [reconciliation, setReconciliation] = useState<{
    checkedDays: number;
    flaggedDays: number;
    thresholdPct: number;
    lockRecommended: boolean;
  }>({
    checkedDays: 0,
    flaggedDays: 0,
    thresholdPct: 1,
    lockRecommended: false,
  });
  const [logicRegression, setLogicRegression] = useState<{
    checkedCases: number;
    mismatches: number;
    pass: boolean;
    deploymentBlocked: boolean;
  }>({
    checkedCases: 0,
    mismatches: 0,
    pass: true,
    deploymentBlocked: false,
  });
  const [priceCrossCheck, setPriceCrossCheck] = useState<{
    checkedSymbols: number;
    flaggedSymbols: string[];
    thresholdPct: number;
    lockRecommended: boolean;
  }>({
    checkedSymbols: 0,
    flaggedSymbols: [],
    thresholdPct: 2,
    lockRecommended: false,
  });
  const [workerHeartbeat, setWorkerHeartbeat] = useState<{
    online: boolean;
    lastSeenSeconds: number | null;
    timeoutSeconds: number;
  }>({
    online: true,
    lastSeenSeconds: null,
    timeoutSeconds: 60,
  });
  const [dataSanity, setDataSanity] = useState<{
    contaminated: boolean;
    checkedPoints: number;
    maxJumpPct: number;
    lockRecommended: boolean;
    firstIssue: string | null;
  }>({
    contaminated: false,
    checkedPoints: 0,
    maxJumpPct: 25,
    lockRecommended: false,
    firstIssue: null,
  });
  const [maintenanceRetention, setMaintenanceRetention] = useState<{
    lastRunAt: string | null;
    afterCloseWib: boolean;
    tokenFlushed: number;
    tradesPurged: number;
    snapshotsPurged: number;
  }>({
    lastRunAt: null,
    afterCloseWib: false,
    tokenFlushed: 0,
    tradesPurged: 0,
    snapshotsPurged: 0,
  });
  const [orchestratorStatus, setOrchestratorStatus] = useState<{
    nightlyLastDate: string | null;
    monthlyLastKey: string | null;
    nightlyDue: boolean;
    monthlyDue: boolean;
    lastError: string | null;
    nightlyPass: boolean;
    nightlyFlaggedDays: number;
    nightlyFailedSymbols: string[];
    nightlyMismatches: number;
    nightlyRefetchQueueAdded: number;
    monthlyLossRatePct: number;
    monthlySwapRecommended: boolean;
    monthlyTopFailureFlag: string | null;
  }>({
    nightlyLastDate: null,
    monthlyLastKey: null,
    nightlyDue: false,
    monthlyDue: false,
    lastError: null,
    nightlyPass: true,
    nightlyFlaggedDays: 0,
    nightlyFailedSymbols: [],
    nightlyMismatches: 0,
    nightlyRefetchQueueAdded: 0,
    monthlyLossRatePct: 0,
    monthlySwapRecommended: false,
    monthlyTopFailureFlag: null,
  });
  const lastSnapshotKeyRef = useRef<string>('');
  const workerOnlineRef = useRef<boolean | null>(null);
  const orchestratorNightlyLockRef = useRef<boolean | null>(null);
  const refetchLockRef = useRef<boolean | null>(null);
  const [refetchQueue, setRefetchQueue] = useState<{
    pendingForSymbol: boolean;
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | null;
    reason: string | null;
    runDateWib: string | null;
  }>({
    pendingForSymbol: false,
    status: null,
    reason: null,
    runDateWib: null,
  });
  const [refetchQueueSummary, setRefetchQueueSummary] = useState<{
    pending: number;
    processing: number;
    done: number;
    failed: number;
    total: number;
  }>({
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
    total: 0,
  });
  const [retryFailedState, setRetryFailedState] = useState<{
    inProgress: boolean;
    lastMessage: string | null;
  }>({
    inProgress: false,
    lastMessage: null,
  });
  const [betaPositions, setBetaPositions] = useState<BetaPosition[]>([
    { symbol: 'BBCA', weightPct: 40, beta: 1.1 },
    { symbol: 'ASII', weightPct: 35, beta: 1.25 },
    { symbol: 'TLKM', weightPct: 25, beta: 0.9 },
  ]);

  // System health state
  const [systemHealth, setSystemHealth] = useState({
    sse: false,
    db: true,
    shield: true,
  });

  const unifiedPowerScore = Math.max(
    40,
    Math.min(95, 62 + Math.round((brokerData.slice(0, 3).reduce((sum, b) => sum + (b.consistency_score || 0), 0) / 3 || 0) * 20)),
  );
  const riskCapital = 5_000_000;
  const riskBasedLot = Math.max(
    0,
    Math.floor(riskCapital / Math.max(1, positionInputs.entry * (positionInputs.stopLoss / 100) * 100)),
  );
  const participationCapLot = Math.max(
    0,
    Math.floor(liquidityInputs.avgDailyVolumeLots * (liquidityInputs.participationCapPct / 100)),
  );
  const recommendedLot = Math.max(0, Math.min(riskBasedLot, participationCapLot));
  const requestedImpactPct = liquidityInputs.avgDailyVolumeLots > 0 ? (riskBasedLot / liquidityInputs.avgDailyVolumeLots) * 100 : 0;
  const finalImpactPct = liquidityInputs.avgDailyVolumeLots > 0 ? (recommendedLot / liquidityInputs.avgDailyVolumeLots) * 100 : 0;
  const isHighImpactOrder = requestedImpactPct > 5;
  const isCapApplied = riskBasedLot > participationCapLot;
  const totalWeightPct = betaPositions.reduce((sum, position) => sum + Math.max(0, position.weightPct), 0);
  const portfolioBeta =
    totalWeightPct > 0
      ? betaPositions.reduce((sum, position) => sum + (Math.max(0, position.weightPct) / totalWeightPct) * Math.max(0, position.beta), 0)
      : 0;
  const isSystemicRiskHigh = portfolioBeta > 1.5;
  const watchlist = [symbol, 'BBCA', 'ASII'];
  const topWhales = brokerData.filter((b) => b.is_whale).slice(0, 2);
  const flowRows = brokerData.slice(0, 2);
  const heatmapSeries = brokerData[0]?.daily_heatmap?.slice(-8) || [30, 45, -20, 35, -10, 55, 25, -30];
  const netWhaleFlow = topWhales.reduce((sum, whale) => sum + (whale.net_buy_value || 0), 0);
  const isGlobalRiskMode = globalCorrelation.ihsgChangePct <= riskConfig.ihsgRiskTriggerPct;
  const upsMinThreshold = isGlobalRiskMode ? riskConfig.upsMinRisk : riskConfig.upsMinNormal;
  const rocThresholdPct = riskConfig.rocThresholdPct;

  const recentTrades5m = trades.filter((trade) => {
    if (!trade.timestamp) {
      return false;
    }
    const tradeTime = new Date(trade.timestamp).getTime();
    if (Number.isNaN(tradeTime)) {
      return false;
    }
    return Date.now() - tradeTime <= 5 * 60 * 1000;
  });

  const latestPrice = recentTrades5m[0]?.price || 0;
  const oldestPrice = recentTrades5m[recentTrades5m.length - 1]?.price || latestPrice;
  const roc5mPct = oldestPrice > 0 ? ((latestPrice - oldestPrice) / oldestPrice) * 100 : 0;

  const total5mVolume = recentTrades5m.reduce((sum, trade) => sum + (trade.volume || 0), 0);
  const haki5mVolume = recentTrades5m
    .filter((trade) => trade.type === 'HAKI')
    .reduce((sum, trade) => sum + (trade.volume || 0), 0);
  const haki5mRatio = total5mVolume > 0 ? haki5mVolume / total5mVolume : 0;
  const rocKillSwitch =
    recentTrades5m.length >= riskConfig.rocMinTrades &&
    roc5mPct <= rocThresholdPct &&
    haki5mRatio >= riskConfig.rocHakiRatio;
  const isAiConfidenceLow = modelConfidence.recalibrationRequired;
  const snapshotIntegrityLock = snapshotIntegrity.checkedRows > 0 && !snapshotIntegrity.valid;
  const reconciliationLock = reconciliation.lockRecommended;
  const logicRegressionWarn = logicRegression.deploymentBlocked;
  const priceCrossCheckLock = priceCrossCheck.lockRecommended;
  const workerOfflineLock = workerHeartbeat.online === false;
  const dataSanityLock = dataSanity.lockRecommended;
  const tradeTimestamps = trades
    .map((trade) => new Date(trade.timestamp).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)
    .slice(0, 30);
  let maxStreamGapSeconds = 0;
  for (let index = 1; index < tradeTimestamps.length; index += 1) {
    const gap = Math.max(0, (tradeTimestamps[index - 1] - tradeTimestamps[index]) / 1000);
    if (gap > maxStreamGapSeconds) {
      maxStreamGapSeconds = gap;
    }
  }
  const dataGapLock = maxStreamGapSeconds > 5;
  const refetchSymbolLock = refetchQueue.pendingForSymbol;
  const orchestratorNightlyLock =
    Boolean(orchestratorStatus.nightlyLastDate) &&
    (orchestratorStatus.nightlyPass === false || Boolean(orchestratorStatus.lastError));
  const isCombatMode =
    positionInputs.atr >= 6 ||
    Math.abs(globalCorrelation.ihsgChangePct) >= Math.abs(riskConfig.ihsgRiskTriggerPct) ||
    rocKillSwitch;

  const technicalVote: ConsensusVote = unifiedPowerScore >= upsMinThreshold ? 'BUY' : unifiedPowerScore <= 40 ? 'SELL' : 'NEUTRAL';
  const bandarmologyVote: ConsensusVote =
    washSaleScore >= 70 ? 'NEUTRAL' : netWhaleFlow > 0 ? 'BUY' : netWhaleFlow < 0 ? 'SELL' : 'NEUTRAL';
  const sentimentVote: ConsensusVote = narrativeSignal.vote;

  const votes = [technicalVote, bandarmologyVote, sentimentVote];
  const buyVotes = votes.filter((vote) => vote === 'BUY').length;
  const sellVotes = votes.filter((vote) => vote === 'SELL').length;
  const consensusSignal: ConsensusVote = buyVotes >= 2 ? 'BUY' : sellVotes >= 2 ? 'SELL' : 'NEUTRAL';
  const blockedByGlobalRisk = isGlobalRiskMode && unifiedPowerScore < upsMinThreshold && consensusSignal === 'BUY';
  const blockedByVolatilitySpike = rocKillSwitch && consensusSignal === 'BUY';
  const shouldStandAside = consensusSignal === 'NEUTRAL' || blockedByGlobalRisk || blockedByVolatilitySpike;
  const isGloballyLocked = !isSystemActive || !systemHealth.db || !systemHealth.shield;
  const isActionLocked =
    shouldStandAside ||
    isGloballyLocked ||
    workerOfflineLock ||
    cooling.active ||
    goldenRecord.lock ||
    rocKillSwitch ||
    snapshotIntegrityLock ||
    reconciliationLock ||
    priceCrossCheckLock ||
    dataSanityLock ||
    dataGapLock ||
    refetchSymbolLock ||
    orchestratorNightlyLock;
  const isScreenerLocked = cooling.active;

  const retryFailedRefetchQueue = async () => {
    if (retryFailedState.inProgress) {
      return;
    }

    try {
      setRetryFailedState({ inProgress: true, lastMessage: null });

      const response = await fetch('/api/maintenance/refetch-queue/retry-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = (await response.json()) as RetryFailedQueueResponse;
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || `Retry failed (${response.status})`);
      }

      const queueParams = new URLSearchParams({ symbol, limit: '1' });
      const queueResponse = await fetch(`/api/maintenance/refetch-queue?${queueParams.toString()}`);
      if (queueResponse.ok) {
        const queueData = (await queueResponse.json()) as MaintenanceRefetchQueueResponse;
        const item = queueData.queue?.[0];
        const status = item?.status || null;
        const pendingForSymbol = status === 'PENDING' || status === 'PROCESSING';
        setRefetchQueue({
          pendingForSymbol,
          status,
          reason: item?.reason || null,
          runDateWib: item?.run_date_wib || null,
        });
        setRefetchQueueSummary({
          pending: Number(queueData.summary?.pending || 0),
          processing: Number(queueData.summary?.processing || 0),
          done: Number(queueData.summary?.done || 0),
          failed: Number(queueData.summary?.failed || 0),
          total: Number(queueData.summary?.total || 0),
        });
      }

      setRetryFailedState({
        inProgress: false,
        lastMessage: `Retry queued: ${Number(result.retried_count || 0)} item(s)`,
      });
    } catch (error) {
      setRetryFailedState({
        inProgress: false,
        lastMessage: error instanceof Error ? `Retry error: ${error.message}` : 'Retry error',
      });
    }
  };

  // Fetch trades via SSE
  useEffect(() => {
    const eventSource = new EventSource(STREAM_URL);

    eventSource.onopen = () => {
      setSystemHealth((prev) => ({ ...prev, sse: true }));
    };

    eventSource.onmessage = (event) => {
      try {
        const trade = JSON.parse(event.data) as ProcessedTrade;
        setTrades((prevTrades) => {
          const newTrades = [trade, ...prevTrades];
          return newTrades.slice(0, MAX_TRADES_IN_LIST);
        });
      } catch (error) {
        console.error('Failed to parse trade data:', error);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setSystemHealth((prev) => ({ ...prev, sse: false }));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('dellmology.cooling_until');
    if (!saved) {
      return;
    }
    const untilDate = new Date(saved);
    if (Number.isNaN(untilDate.getTime())) {
      localStorage.removeItem('dellmology.cooling_until');
      return;
    }
    if (untilDate.getTime() > Date.now()) {
      setCooling({ active: true, until: untilDate.toISOString() });
      return;
    }
    localStorage.removeItem('dellmology.cooling_until');
  }, []);

  useEffect(() => {
    if (portfolioDrawdown > -5) {
      return;
    }

    const currentUntil = cooling.until ? new Date(cooling.until).getTime() : 0;
    if (currentUntil > Date.now()) {
      return;
    }

    const untilDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setCooling({ active: true, until: untilDate.toISOString() });
    localStorage.setItem('dellmology.cooling_until', untilDate.toISOString());
  }, [portfolioDrawdown, cooling.until]);

  useEffect(() => {
    if (!cooling.active || !cooling.until) {
      return;
    }

    const untilTime = new Date(cooling.until).getTime();
    const tick = () => {
      if (Date.now() >= untilTime) {
        setCooling({ active: false, until: null });
        localStorage.removeItem('dellmology.cooling_until');
      }
    };

    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [cooling.active, cooling.until]);

  useEffect(() => {
    const fetchBrokerFlow = async () => {
      try {
        const response = await fetch(`/api/broker-flow?symbol=${encodeURIComponent(symbol)}&days=7&filter=mix`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setBrokerData(data.brokers || []);
        setWashSaleScore(data.stats?.wash_sale_score || 0);
      } catch (error) {
        console.error('Broker flow fetch failed:', error);
        setBrokerData([]);
        setWashSaleScore(0);
      }
    };

    fetchBrokerFlow();
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchRiskConfig = async () => {
      try {
        const response = await fetch('/api/risk-config');
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as RiskConfigResponse;
        if (!mounted || !data.config) {
          return;
        }

        setRiskConfig((prev) => ({
          ihsgRiskTriggerPct: Number(data.config?.ihsg_risk_trigger_pct ?? prev.ihsgRiskTriggerPct),
          upsMinNormal: Number(data.config?.ups_min_normal ?? prev.upsMinNormal),
          upsMinRisk: Number(data.config?.ups_min_risk ?? prev.upsMinRisk),
          rocThresholdPct: Number(data.config?.roc_threshold_pct ?? prev.rocThresholdPct),
          rocHakiRatio: Number(data.config?.roc_haki_ratio ?? prev.rocHakiRatio),
          rocMinTrades: Number(data.config?.roc_min_trades ?? prev.rocMinTrades),
          confidenceWindow: Number(data.config?.confidence_window ?? prev.confidenceWindow),
          confidenceRequiredSignals: Number(data.config?.confidence_required_signals ?? prev.confidenceRequiredSignals),
          confidenceMissThreshold: Number(data.config?.confidence_miss_threshold ?? prev.confidenceMissThreshold),
          confidenceHorizonMinutes: Number(data.config?.confidence_horizon_minutes ?? prev.confidenceHorizonMinutes),
          confidenceSlippagePct: Number(data.config?.confidence_slippage_pct ?? prev.confidenceSlippagePct),
        }));
      } catch (error) {
        console.error('Risk config fetch failed:', error);
      }
    };

    fetchRiskConfig();
    const interval = setInterval(fetchRiskConfig, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyOrchestratorResponse = (data: MaintenanceOrchestratorResponse) => {
      setOrchestratorStatus((prev) => ({
        nightlyLastDate: data.status?.nightly_last_date_wib || prev.nightlyLastDate,
        monthlyLastKey: data.status?.monthly_last_key || prev.monthlyLastKey,
        nightlyDue: data.status?.nightly_due === true,
        monthlyDue: data.status?.monthly_due === true,
        lastError: data.status?.last_error || null,
        nightlyPass: data.latest?.nightly?.pass !== false,
        nightlyFlaggedDays: Number(data.latest?.nightly?.reconciliation_flagged_days || 0),
        nightlyFailedSymbols: data.latest?.nightly?.failed_symbols || [],
        nightlyMismatches: Number(data.latest?.nightly?.regression_mismatches || 0),
        nightlyRefetchQueueAdded: Number(data.latest?.nightly?.refetch_queue_added || 0),
        monthlyLossRatePct: Number(data.latest?.monthly?.loss_rate_pct || 0),
        monthlySwapRecommended: data.latest?.monthly?.challenger_swap_recommended === true,
        monthlyTopFailureFlag: data.latest?.monthly?.top_failure_flags?.[0]?.flag || null,
      }));
    };

    const syncOrchestrator = async () => {
      try {
        const postResponse = await fetch('/api/maintenance/orchestrator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });

        if (postResponse.ok && mounted) {
          const postData = (await postResponse.json()) as MaintenanceOrchestratorResponse;
          applyOrchestratorResponse(postData);
        }

        const getResponse = await fetch('/api/maintenance/orchestrator');
        if (!getResponse.ok || !mounted) {
          return;
        }

        const getData = (await getResponse.json()) as MaintenanceOrchestratorResponse;
        if (!mounted || getData.success !== true) {
          return;
        }

        applyOrchestratorResponse(getData);
      } catch (error) {
        console.error('Maintenance orchestrator sync failed:', error);
      }
    };

    syncOrchestrator();
    const interval = setInterval(syncOrchestrator, 5 * 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchRefetchQueue = async () => {
      try {
        const params = new URLSearchParams({
          symbol,
          limit: '1',
        });
        const response = await fetch(`/api/maintenance/refetch-queue?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as MaintenanceRefetchQueueResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        const item = data.queue?.[0];
        const status = item?.status || null;
        const pendingForSymbol = status === 'PENDING' || status === 'PROCESSING';
        setRefetchQueue({
          pendingForSymbol,
          status,
          reason: item?.reason || null,
          runDateWib: item?.run_date_wib || null,
        });
        setRefetchQueueSummary({
          pending: Number(data.summary?.pending || 0),
          processing: Number(data.summary?.processing || 0),
          done: Number(data.summary?.done || 0),
          failed: Number(data.summary?.failed || 0),
          total: Number(data.summary?.total || 0),
        });
      } catch (error) {
        console.error('Refetch queue fetch failed:', error);
      }
    };

    fetchRefetchQueue();
    const interval = setInterval(fetchRefetchQueue, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    const previous = refetchLockRef.current;
    refetchLockRef.current = refetchQueue.pendingForSymbol;

    if (previous === true && refetchQueue.pendingForSymbol === false && refetchQueue.status === 'DONE') {
      fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market',
          symbol,
          data: {
            alert: 'RE-FETCH RECOVERY COMPLETE',
            symbol,
            run_date_wib: refetchQueue.runDateWib,
            reason: refetchQueue.reason,
            queue_status: refetchQueue.status,
          },
        }),
      }).catch((error) => {
        console.error('Refetch recovery Telegram alert failed:', error);
      });
    }
  }, [symbol, refetchQueue.pendingForSymbol, refetchQueue.status, refetchQueue.reason, refetchQueue.runDateWib]);

  useEffect(() => {
    const previous = workerOnlineRef.current;
    workerOnlineRef.current = workerHeartbeat.online;

    if (previous === true && workerHeartbeat.online === false) {
      fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market',
          symbol: 'SYSTEM',
          data: {
            alert: 'DELLMOLOGY OFFLINE - CHECK POSITION MANUALLY!',
            reason: killSwitchReason || 'Worker heartbeat timeout',
            heartbeat_timeout_seconds: workerHeartbeat.timeoutSeconds,
            last_seen_seconds: workerHeartbeat.lastSeenSeconds,
          },
        }),
      }).catch((error) => {
        console.error('Offline emergency Telegram alert failed:', error);
      });
    }
  }, [workerHeartbeat.online, workerHeartbeat.timeoutSeconds, workerHeartbeat.lastSeenSeconds, killSwitchReason]);

  useEffect(() => {
    const previous = orchestratorNightlyLockRef.current;
    orchestratorNightlyLockRef.current = orchestratorNightlyLock;

    if (previous === false && orchestratorNightlyLock === true) {
      fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'market',
          symbol: 'SYSTEM',
          data: {
            alert: 'DELLMOLOGY NIGHTLY GUARDRAIL FAILED',
            nightly_date: orchestratorStatus.nightlyLastDate,
            reconciliation_flagged_days: orchestratorStatus.nightlyFlaggedDays,
            regression_mismatches: orchestratorStatus.nightlyMismatches,
            monthly_last_key: orchestratorStatus.monthlyLastKey,
            monthly_loss_rate_pct: orchestratorStatus.monthlyLossRatePct,
            top_failure_flag: orchestratorStatus.monthlyTopFailureFlag,
            error: orchestratorStatus.lastError,
          },
        }),
      }).catch((error) => {
        console.error('Orchestrator emergency Telegram alert failed:', error);
      });
    }
  }, [
    orchestratorNightlyLock,
    orchestratorStatus.nightlyLastDate,
    orchestratorStatus.nightlyFlaggedDays,
    orchestratorStatus.nightlyMismatches,
    orchestratorStatus.monthlyLastKey,
    orchestratorStatus.monthlyLossRatePct,
    orchestratorStatus.monthlyTopFailureFlag,
    orchestratorStatus.lastError,
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok || !mounted) {
          return;
        }

        const health = (await response.json()) as HealthResponse;
        if (!mounted) {
          return;
        }

        setIsSystemActive(health.is_system_active !== false);
        setKillSwitchReason(health.kill_switch_reason || null);
        setWorkerHeartbeat({
          online: health.worker_online !== false,
          lastSeenSeconds: health.worker_last_seen_seconds ?? null,
          timeoutSeconds: Number(health.heartbeat_timeout_seconds || 60),
        });
        setSystemHealth((prev) => ({
          ...prev,
          sse: typeof health.sse_connected === 'boolean' ? health.sse_connected : prev.sse,
          db: typeof health.db_connected === 'boolean' ? health.db_connected : prev.db,
          shield: typeof health.data_integrity === 'boolean' ? health.data_integrity : prev.shield,
        }));
      } catch (error) {
        console.error('Health poll failed:', error);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (consensusSignal === 'NEUTRAL') {
      return;
    }

    const snapshotKey = `${symbol}:${timeframe}:${consensusSignal}`;
    if (lastSnapshotKeyRef.current === snapshotKey) {
      return;
    }

    const saveSnapshot = async () => {
      try {
        const currentPrice = trades[0]?.price || 0;
        const payload = {
          votes: {
            technical: technicalVote,
            bandarmology: bandarmologyVote,
            sentiment: sentimentVote,
            buy_votes: buyVotes,
            sell_votes: sellVotes,
          },
          risk: {
            cooling_active: cooling.active,
            global_lock: isGloballyLocked,
            golden_record_lock: goldenRecord.lock,
            high_impact_order: isHighImpactOrder,
            portfolio_beta: portfolioBeta,
            systemic_risk_high: isSystemicRiskHigh,
          },
          market: {
            ihsg_change_pct: globalCorrelation.ihsgChangePct,
            dji_change_pct: globalCorrelation.djiChangePct,
            global_risk_mode: isGlobalRiskMode,
            ups_threshold: upsMinThreshold,
          },
          context: {
            wash_sale_score: washSaleScore,
            net_whale_flow: netWhaleFlow,
            narrative_confidence: narrativeSignal.label,
            narrative_score: narrativeSignal.score,
          },
          timestamp_client: new Date().toISOString(),
        };

        const response = await fetch('/api/signal-snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            timeframe,
            signal: consensusSignal,
            price: currentPrice,
            unified_power_score: unifiedPowerScore,
            payload,
          }),
        });

        if (!response.ok) {
          throw new Error(`Snapshot save failed (${response.status})`);
        }

        lastSnapshotKeyRef.current = snapshotKey;
        setSnapshotInfo({ lastSavedAt: new Date().toISOString(), error: null });
      } catch (error) {
        console.error('Snapshot-on-signal failed:', error);
        setSnapshotInfo({
          lastSavedAt: snapshotInfo.lastSavedAt,
          error: error instanceof Error ? error.message : 'Snapshot failed',
        });
      }
    };

    saveSnapshot();
  }, [
    consensusSignal,
    symbol,
    timeframe,
    trades,
    technicalVote,
    bandarmologyVote,
    sentimentVote,
    buyVotes,
    sellVotes,
    cooling.active,
    isGloballyLocked,
    goldenRecord.lock,
    isHighImpactOrder,
    portfolioBeta,
    isSystemicRiskHigh,
    globalCorrelation.ihsgChangePct,
    globalCorrelation.djiChangePct,
    isGlobalRiskMode,
    upsMinThreshold,
    washSaleScore,
    netWhaleFlow,
    narrativeSignal.label,
    narrativeSignal.score,
    unifiedPowerScore,
    snapshotInfo.lastSavedAt,
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchGoldenRecordValidation = async () => {
      try {
        const response = await fetch('/api/golden-record');
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as GoldenRecordResponse;
        if (!mounted) {
          return;
        }

        const shouldLock = data.trigger_kill_switch === true || data.is_system_safe === false;
        setGoldenRecord({
          lock: shouldLock,
          failedSymbols: data.failed_symbols || [],
          maxDeviationPct: Number(data.max_allowed_deviation_pct || 2),
        });
      } catch (error) {
        console.error('Golden record validation failed:', error);
      }
    };

    fetchGoldenRecordValidation();
    const interval = setInterval(fetchGoldenRecordValidation, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchGlobalCorrelation = async () => {
      try {
        const response = await fetch('/api/global-correlation');
        if (!response.ok || !mounted) {
          return;
        }
        const data = (await response.json()) as GlobalCorrelationResponse;
        if (!mounted) {
          return;
        }

        const ihsgChange = Number(data.change_ihsg || 0);
        const djiChange = Number(data.change_dji || 0);
        const sentiment =
          data.global_sentiment === 'BULLISH' || data.global_sentiment === 'BEARISH'
            ? data.global_sentiment
            : Math.abs(ihsgChange) < 0.35
              ? 'SIDEWAYS'
              : ihsgChange > 0
                ? 'BULLISH'
                : 'BEARISH';

        setGlobalCorrelation({
          ihsgChangePct: ihsgChange,
          djiChangePct: djiChange,
          sentiment,
          correlationStrength: Number(data.correlation_strength || 0.5),
        });
      } catch (error) {
        console.error('Global correlation fetch failed:', error);
      }
    };

    fetchGlobalCorrelation();
    const interval = setInterval(fetchGlobalCorrelation, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchNarrativeSignal = async () => {
      try {
        const whales = brokerData.filter((entry) => entry.is_whale).slice(0, 3);
        const consistencyAvg =
          brokerData.length > 0
            ? brokerData.reduce((sum, entry) => sum + (entry.consistency_score || 0), 0) / brokerData.length
            : 0;

        const payload = {
          type: 'broker',
          symbol,
          data: {
            whales,
            wash_sale_score: washSaleScore,
            consistency: consistencyAvg,
            period: '7 days',
          },
        };

        const response = await fetch('/api/narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as NarrativeConsensusResponse;
        if (!mounted) {
          return;
        }

        setNarrativeSignal({
          vote: result.market_bias || 'NEUTRAL',
          score: Math.max(0, Math.min(100, result.market_bias_score || 50)),
          label: result.confidence_label || 'LOW',
        });
      } catch (error) {
        console.error('Narrative signal fetch failed:', error);
      }
    };

    fetchNarrativeSignal();
    const interval = setInterval(fetchNarrativeSignal, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [brokerData, washSaleScore, symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchModelConfidence = async () => {
      try {
        const params = new URLSearchParams({
          symbol,
          window: String(riskConfig.confidenceWindow),
          required: String(riskConfig.confidenceRequiredSignals),
          missThreshold: String(riskConfig.confidenceMissThreshold),
          horizonMinutes: String(riskConfig.confidenceHorizonMinutes),
          slippagePct: String(riskConfig.confidenceSlippagePct),
        });

        const response = await fetch(`/api/model-confidence?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as ModelConfidenceResponse;
        if (!mounted) {
          return;
        }

        setModelConfidence({
          evaluatedSignals: Number(data.evaluated_signals || 0),
          hits: Number(data.hits || 0),
          misses: Number(data.misses || 0),
          pending: Number(data.pending || 0),
          accuracyPct: Number(data.accuracy_pct || 0),
          label: data.confidence_label || 'LOW',
          recalibrationRequired: data.recalibration_required === true,
          warning: data.warning || null,
        });
      } catch (error) {
        console.error('Model confidence fetch failed:', error);
      }
    };

    fetchModelConfidence();
    const interval = setInterval(fetchModelConfidence, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [
    symbol,
    riskConfig.confidenceWindow,
    riskConfig.confidenceRequiredSignals,
    riskConfig.confidenceMissThreshold,
    riskConfig.confidenceHorizonMinutes,
    riskConfig.confidenceSlippagePct,
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchSnapshotIntegrity = async () => {
      try {
        const params = new URLSearchParams({ limit: '200', symbol });
        const response = await fetch(`/api/signal-snapshots/integrity?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as SnapshotIntegrityResponse;
        if (!mounted) {
          return;
        }

        setSnapshotIntegrity({
          valid: data.valid !== false,
          checkedRows: Number(data.checked_rows || 0),
          upgradedRows: Number(data.upgraded_rows || 0),
          linkageFailures: Number(data.linkage_failures || 0),
          checksumFailures: Number(data.checksum_failures || 0),
        });
      } catch (error) {
        console.error('Snapshot integrity fetch failed:', error);
      }
    };

    fetchSnapshotIntegrity();
    const interval = setInterval(fetchSnapshotIntegrity, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const runRetentionMaintenance = async () => {
      try {
        const response = await fetch('/api/maintenance/retention', {
          method: 'POST',
        });
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as MaintenanceRetentionResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        setMaintenanceRetention({
          lastRunAt: data.ran_at || null,
          afterCloseWib: data.after_close_wib === true,
          tokenFlushed: Number(data.session_token_flushed || 0),
          tradesPurged: Number(data.trades_purged || 0),
          snapshotsPurged: Number(data.snapshots_purged || 0),
        });
      } catch (error) {
        console.error('Retention maintenance failed:', error);
      }
    };

    runRetentionMaintenance();
    const interval = setInterval(runRetentionMaintenance, 15 * 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchDataSanity = async () => {
      try {
        const params = new URLSearchParams({ symbol, lookbackMinutes: '30', maxJumpPct: '25' });
        const response = await fetch(`/api/data-sanity?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as DataSanityResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        setDataSanity({
          contaminated: data.contaminated === true,
          checkedPoints: Number(data.checked_points || 0),
          maxJumpPct: Number(data.max_jump_pct || 25),
          lockRecommended: data.lock_recommended === true,
          firstIssue: data.issues?.[0]?.detail || null,
        });
      } catch (error) {
        console.error('Data sanity fetch failed:', error);
      }
    };

    fetchDataSanity();
    const interval = setInterval(fetchDataSanity, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchPriceCrossCheck = async () => {
      try {
        const symbols = Array.from(new Set([symbol, 'BBCA', 'ASII', 'TLKM'])).join(',');
        const params = new URLSearchParams({ symbols, thresholdPct: '2' });
        const response = await fetch(`/api/price-cross-check?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as PriceCrossCheckResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        setPriceCrossCheck({
          checkedSymbols: Number(data.checked_symbols || 0),
          flaggedSymbols: data.flagged_symbols || [],
          thresholdPct: Number(data.threshold_pct || 2),
          lockRecommended: data.lock_recommended === true,
        });
      } catch (error) {
        console.error('Price cross-check fetch failed:', error);
      }
    };

    fetchPriceCrossCheck();
    const interval = setInterval(fetchPriceCrossCheck, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchLogicRegression = async () => {
      try {
        const params = new URLSearchParams({ symbol, limit: '100' });
        const response = await fetch(`/api/logic-regression?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as LogicRegressionResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        setLogicRegression({
          checkedCases: Number(data.checked_cases || 0),
          mismatches: Number(data.mismatches || 0),
          pass: data.pass !== false,
          deploymentBlocked: data.deployment_blocked === true,
        });
      } catch (error) {
        console.error('Logic regression fetch failed:', error);
      }
    };

    fetchLogicRegression();
    const interval = setInterval(fetchLogicRegression, 5 * 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchDataReconciliation = async () => {
      try {
        const params = new URLSearchParams({ symbol, thresholdPct: '1', days: '3' });
        const response = await fetch(`/api/data-reconciliation?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as DataReconciliationResponse;
        if (!mounted || data.success !== true) {
          return;
        }

        setReconciliation({
          checkedDays: Number(data.checked_days || 0),
          flaggedDays: Number(data.flagged_days || 0),
          thresholdPct: Number(data.threshold_pct || 1),
          lockRecommended: data.lock_recommended === true,
        });
      } catch (error) {
        console.error('Data reconciliation fetch failed:', error);
      }
    };

    fetchDataReconciliation();
    const interval = setInterval(fetchDataReconciliation, 5 * 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  useEffect(() => {
    let mounted = true;

    const fetchModelComparison = async () => {
      try {
        const params = new URLSearchParams({ symbol, days: '30', horizonDays: '1' });
        const response = await fetch(`/api/model-comparison/champion-challenger?${params.toString()}`);
        if (!response.ok || !mounted) {
          return;
        }

        const data = (await response.json()) as ModelComparisonResponse;
        if (!mounted || data.success !== true || !data.champion || !data.challenger || !data.decision) {
          return;
        }

        setModelComparison({
          championVersion: data.champion.model_version,
          challengerVersion: data.challenger.model_version,
          championAccuracy: Number(data.champion.accuracy_pct || 0),
          challengerAccuracy: Number(data.challenger.accuracy_pct || 0),
          swapRecommended: data.decision.swap_recommended === true,
          winner: data.decision.winner === 'CHALLENGER' ? 'CHALLENGER' : 'CHAMPION',
        });
      } catch (error) {
        console.error('Model comparison fetch failed:', error);
      }
    };

    fetchModelComparison();
    const interval = setInterval(fetchModelComparison, 5 * 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);


  return (
    <div className="bg-gray-900 text-white min-h-screen overflow-x-hidden">
      <ErrorBoundary>
        {/* Top Navigation Bar (The Pulse) */}
        <Section0_CommandBar
          onSymbolChange={(s) => setSymbol(s.toUpperCase())}
          marketRegime={globalCorrelation.sentiment}
          volatility={Math.abs(globalCorrelation.ihsgChangePct) >= 1.5 ? 'HIGH' : Math.abs(globalCorrelation.ihsgChangePct) >= 0.8 ? 'MEDIUM' : 'LOW'}
          systemHealth={systemHealth}
          rateLimitUsage={65}
        />

        <main className="pt-2 pb-3">
          <div className="max-w-screen-2xl mx-auto px-3 space-y-3">
            {isCombatMode && (
              <div className="rounded border border-red-700 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-300">
                COMBAT MODE ACTIVE • Simplified decision layout for high volatility.
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
              {/* Left Sidebar: Discovery & Intelligence */}
              <div className="xl:col-span-3 flex flex-col gap-3 xl:min-h-132">
                <Card title="Discovery & Intelligence" subtitle="AI-Screener" headerDensity="compact" className="p-3!">
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {(['DAYTRADE', 'SWING', 'CUSTOM'] as const).map((mode) => (
                        <button
                          key={mode}
                          disabled={isScreenerLocked}
                          onClick={() => setScreenerMode(mode)}
                          className={`px-2 py-1 rounded border transition-colors ${
                            isScreenerLocked
                              ? 'bg-gray-800/60 border-gray-700 text-gray-500 cursor-not-allowed'
                              : screenerMode === mode
                              ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {mode === 'DAYTRADE' ? 'Daytrade' : mode === 'SWING' ? 'Swing' : `Custom Rp ${customRange.min}-${customRange.max}`}
                        </button>
                      ))}
                    </div>

                    {screenerMode === 'CUSTOM' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={customRange.min}
                          onChange={(e) => setCustomRange((prev) => ({ ...prev, min: Number(e.target.value) || 0 }))}
                          disabled={isScreenerLocked}
                          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <input
                          type="number"
                          value={customRange.max}
                          onChange={(e) => setCustomRange((prev) => ({ ...prev, max: Number(e.target.value) || 0 }))}
                          disabled={isScreenerLocked}
                          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    )}

                    {cooling.active && cooling.until && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2 py-1.5 text-[11px] text-red-300">
                        Cooling-Off aktif sampai {new Date(cooling.until).toLocaleTimeString()} • Screener locked 24h
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Watchlist" subtitle="Unified Power Score" headerDensity="compact" className="p-3! flex-1 min-h-0">
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {watchlist.map((item, idx) => {
                      const score = Math.max(50, Math.min(95, unifiedPowerScore - idx * 5));
                      return (
                        <div key={`${item}-${idx}`} className="bg-gray-900/50 border border-gray-700 rounded-lg p-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-base font-semibold text-green-400">{item}</div>
                            <div className="text-xs font-bold text-cyan-300">{score}</div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                            <div className="h-full bg-linear-to-r from-red-500 via-yellow-400 to-green-400" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Center Panel: Visual Analysis */}
              <div className="xl:col-span-6 xl:min-h-132">
                <Card title="Advanced Chart" subtitle="CNN Technical Overlay" headerDensity="compact" className="p-3! h-full">
                  <div className="space-y-2.5">
                    <div className="flex justify-end gap-1">
                      {(['5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-2 py-0.5 text-xs rounded border ${
                            timeframe === tf
                              ? 'bg-cyan-600/30 border-cyan-500 text-cyan-200'
                              : 'bg-gray-800 border-gray-700 text-gray-300'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-12 gap-2.5">
                      <div className="col-span-9 h-72 rounded border border-gray-700 bg-gray-900/50">
                        <MarketIntelligenceCanvas symbol={symbol} timeframe={timeframe} />
                      </div>
                      <div className="col-span-3 rounded border border-gray-700 bg-gray-900/60 p-2">
                        <div className="text-xs font-semibold text-yellow-300 mb-2">Order Flow Heatmap</div>
                        <div className="space-y-1.5">
                          {heatmapSeries.map((value, idx) => {
                            const width = Math.max(18, Math.min(100, Math.abs(value)));
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-5 text-[10px] text-gray-500">{idx + 1}</span>
                                <div className="h-2.5 rounded" style={{ width: `${width}%`, background: value >= 0 ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.65)' }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">Unified Power Score (UPS) Bar</span>
                        <span className={`font-semibold text-cyan-300 ${isCombatMode ? 'text-xl' : 'text-sm'}`}>{unifiedPowerScore}</span>
                      </div>
                      <div className="relative h-3.5 w-full rounded-full bg-linear-to-r from-red-500 via-yellow-400 to-green-400">
                        <div className="absolute top-0 h-3.5 w-0.5 bg-white" style={{ left: `${unifiedPowerScore}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>0</span>
                        <span>50</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div
                      className={`rounded-lg border p-2.5 ${
                        isGloballyLocked || isGlobalRiskMode || goldenRecord.lock || rocKillSwitch
                          ? 'border-red-700 bg-red-900/20'
                          : shouldStandAside
                          ? 'border-yellow-700 bg-yellow-900/20'
                          : consensusSignal === 'BUY'
                            ? 'border-green-700 bg-green-900/20'
                            : 'border-red-700 bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-300">Multi-Model Consensus (2/3)</span>
                        <span
                          className={`font-semibold ${
                            isGloballyLocked || isGlobalRiskMode || goldenRecord.lock || rocKillSwitch
                              ? 'text-red-300'
                              : shouldStandAside
                                ? 'text-yellow-300'
                                : consensusSignal === 'BUY'
                                  ? 'text-green-300'
                                  : 'text-red-300'
                          }`}
                        >
                          {isGloballyLocked
                            ? `SYSTEM LOCKED${killSwitchReason ? ` - ${killSwitchReason}` : ''}`
                            : goldenRecord.lock
                              ? `GOLDEN RECORD LOCK - ${goldenRecord.failedSymbols.join(', ')}`
                            : rocKillSwitch
                              ? 'CRITICAL: VOLATILITY SPIKE'
                            : isGlobalRiskMode
                              ? `GLOBAL RISK MODE - UPS MIN ${upsMinThreshold}`
                            : shouldStandAside
                              ? 'MARKET CONFUSION - STAND ASIDE'
                              : `${consensusSignal} SIGNAL CONFIRMED`}
                        </span>
                      </div>
                      <div className="mb-2 text-[10px] text-gray-400">
                        IHSG {globalCorrelation.ihsgChangePct >= 0 ? '+' : ''}{globalCorrelation.ihsgChangePct.toFixed(2)}% • DJI {globalCorrelation.djiChangePct >= 0 ? '+' : ''}{globalCorrelation.djiChangePct.toFixed(2)}% • Corr {(globalCorrelation.correlationStrength * 100).toFixed(0)}%
                      </div>
                      <div className="mb-2 text-[10px] text-gray-400">
                        RoC 5m {roc5mPct >= 0 ? '+' : ''}{roc5mPct.toFixed(2)}% • HAKI 5m {(haki5mRatio * 100).toFixed(0)}%
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5">
                          <div className="text-gray-400">Technical</div>
                          <div className={`font-semibold ${technicalVote === 'BUY' ? 'text-green-300' : technicalVote === 'SELL' ? 'text-red-300' : 'text-yellow-300'}`}>
                            {technicalVote}
                          </div>
                        </div>
                        <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5">
                          <div className="text-gray-400">Bandarmology</div>
                          <div className={`font-semibold ${bandarmologyVote === 'BUY' ? 'text-green-300' : bandarmologyVote === 'SELL' ? 'text-red-300' : 'text-yellow-300'}`}>
                            {bandarmologyVote}
                          </div>
                        </div>
                        <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5">
                          <div className="text-gray-400">Sentiment</div>
                          <div className={`font-semibold ${sentimentVote === 'BUY' ? 'text-green-300' : sentimentVote === 'SELL' ? 'text-red-300' : 'text-yellow-300'}`}>
                            {sentimentVote}
                          </div>
                          <div className="text-[10px] text-gray-500">{narrativeSignal.score}/100 • {narrativeSignal.label}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Sidebar: Whale & Flow Engine */}
              <div className="xl:col-span-3 xl:min-h-132">
                <Card title="Whale & Flow Engine" subtitle="The Tape" headerDensity="compact" className="p-3! h-full">
                  <div className="flex h-full flex-col gap-2.5">
                    <div className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${isGloballyLocked || isGlobalRiskMode || goldenRecord.lock || rocKillSwitch ? 'border-red-700 bg-red-900/20 text-red-300' : shouldStandAside ? 'border-yellow-700 bg-yellow-900/20 text-yellow-300' : consensusSignal === 'BUY' ? 'border-green-700 bg-green-900/20 text-green-300' : 'border-red-700 bg-red-900/20 text-red-300'}`}>
                      Consensus Gate: {isGloballyLocked ? `SYSTEM LOCKED${killSwitchReason ? ` - ${killSwitchReason}` : ''}` : goldenRecord.lock ? `GOLDEN RECORD LOCK - ${goldenRecord.failedSymbols.join(', ')}` : rocKillSwitch ? 'CRITICAL: VOLATILITY SPIKE' : isGlobalRiskMode ? `GLOBAL RISK MODE - UPS >= ${upsMinThreshold}` : shouldStandAside ? 'MARKET CONFUSION - STAND ASIDE' : `${consensusSignal} (${Math.max(buyVotes, sellVotes)}/3)`}
                    </div>

                    {goldenRecord.lock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Golden-Record mismatch &gt; {goldenRecord.maxDeviationPct}% on {goldenRecord.failedSymbols.join(', ')}. Execution is locked.
                      </div>
                    )}

                    {rocKillSwitch && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Flash-crash guard active: price drop {roc5mPct.toFixed(2)}% within 5m with HAKI dominance {(haki5mRatio * 100).toFixed(0)}%.
                      </div>
                    )}

                    {snapshotIntegrityLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Immutable Audit Log mismatch detected: {snapshotIntegrity.linkageFailures} link / {snapshotIntegrity.checksumFailures} checksum issue(s).
                      </div>
                    )}

                    {reconciliationLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Data Reconciliation Alert: {reconciliation.flaggedDays} day(s) exceed {reconciliation.thresholdPct}% deviation.
                      </div>
                    )}

                    {logicRegressionWarn && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Logic Regression Failed: {logicRegression.mismatches} mismatches in {logicRegression.checkedCases} golden cases.
                      </div>
                    )}

                    {workerOfflineLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Engine Offline: no heartbeat within {workerHeartbeat.timeoutSeconds}s
                        {workerHeartbeat.lastSeenSeconds !== null ? ` (last seen ${workerHeartbeat.lastSeenSeconds}s ago)` : ''}.
                      </div>
                    )}

                    {priceCrossCheckLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Price Cross-Check Lock: deviation &gt; {priceCrossCheck.thresholdPct}% on {priceCrossCheck.flaggedSymbols.join(', ')}.
                      </div>
                    )}

                    {dataSanityLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        DATA CONTAMINATED: {dataSanity.firstIssue || `Anomaly detected in ${dataSanity.checkedPoints} points`}.
                      </div>
                    )}

                    {dataGapLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Incomplete Data: stream gap {maxStreamGapSeconds.toFixed(1)}s detected (&gt;5s).
                      </div>
                    )}

                    {refetchSymbolLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Re-fetch Required ({symbol}): {refetchQueue.reason || 'Nightly reconciliation flagged this symbol'}
                        {refetchQueue.runDateWib ? ` • run ${refetchQueue.runDateWib}` : ''}.
                      </div>
                    )}

                    {orchestratorNightlyLock && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        Nightly Guardrail Failed: reconciliation {orchestratorStatus.nightlyFlaggedDays} flagged day(s), regression {orchestratorStatus.nightlyMismatches} mismatch(es).
                      </div>
                    )}

                    {isAiConfidenceLow && (
                      <div className="rounded border border-red-700 bg-red-900/20 px-2.5 py-1.5 text-[11px] text-red-300">
                        {modelConfidence.warning || 'AI CONFIDENCE: LOW - RE-CALIBRATION REQUIRED'}
                      </div>
                    )}

                    <div>
                      <div className="text-xs font-semibold text-gray-400 mb-1.5">Deep Broker Flow Table</div>
                      <div className="overflow-hidden rounded border border-gray-700">
                        <div className="grid grid-cols-4 bg-gray-900/70 px-2 py-1 text-[11px] text-gray-400">
                          <span>#</span>
                          <span>Broker</span>
                          <span className="text-right">Net</span>
                          <span className="text-right">Cons</span>
                        </div>
                        {(flowRows.length ? flowRows : [{ broker_id: 'BK', net_buy_value: 0, consistency_score: 0.5 }, { broker_id: 'YP', net_buy_value: 0, consistency_score: 0.4 }]).map((row, idx) => (
                          <div key={`${row.broker_id}-${idx}`} className="grid grid-cols-4 px-2 py-1 text-xs border-t border-gray-800">
                            <span className="text-gray-500">{idx + 1}</span>
                            <span className="text-gray-200 font-medium truncate">{row.broker_id}</span>
                            <span className={`text-right font-mono ${(row.net_buy_value || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {((row.net_buy_value || 0) / 1e9).toFixed(1)}B
                            </span>
                            <span className="text-right text-cyan-300">{Math.round((row.consistency_score || 0) * 100)}/100</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-700 pt-2">
                      <div className="text-xs font-semibold text-gray-400 mb-1.5">Whale Z-Score</div>
                      <div className="space-y-1.5">
                        {topWhales.length === 0 ? (
                          <p className="text-sm text-gray-400">Belum ada data whale untuk {symbol}.</p>
                        ) : (
                          topWhales.map((whale) => (
                            <div key={whale.broker_id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">{whale.broker_id}</span>
                              <span className={`${(whale.z_score || 0) >= 2 ? 'text-red-400' : 'text-cyan-300'} font-mono`}>
                                {(whale.z_score || 0).toFixed(2)}σ
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className={`rounded-lg border px-3 py-2 text-sm ${washSaleScore >= 60 ? 'border-red-700 bg-red-900/20 text-red-200' : 'border-yellow-700 bg-yellow-900/20 text-yellow-200'}`}>
                      <div className="font-semibold">Wash Sale Alert Banner</div>
                      <div>Score: {washSaleScore.toFixed(0)} • {washSaleScore >= 60 ? 'High churn detected' : 'Stable flow'}</div>
                    </div>

                    <div className="border-t border-gray-700 pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-semibold text-gray-400">Negotiated Market Monitor</div>
                        <span className="text-[10px] text-gray-500">Feed</span>
                      </div>
                      <div className="space-y-1 max-h-20 overflow-y-auto text-xs font-mono pr-1">
                        {(trades.length > 0 ? trades.slice(0, 8) : [{ id: '0', symbol, price: 0, volume: 0, timestamp: '', type: 'NORMAL' as const }]).map((trade) => (
                          <div key={trade.id} className="flex items-center justify-between border-b border-gray-800 pb-1">
                            <span className="text-cyan-300">{trade.symbol}</span>
                            <span className="text-gray-400">{trade.volume.toLocaleString()}</span>
                            <span className={trade.type === 'HAKA' ? 'text-green-400' : trade.type === 'HAKI' ? 'text-red-400' : 'text-gray-500'}>
                              {trade.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Bottom Panel: Execution & AI Narrative */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
              <div className="xl:col-span-5 xl:min-h-56">
                <Card title="Execution & AI Narrative" subtitle="AI Narrative Terminal" headerDensity="compact" className="p-3! h-full">
                  {isCombatMode ? (
                    <div className="space-y-2 text-sm">
                      <div className="rounded border border-gray-700 bg-gray-900/40 px-3 py-2 font-semibold text-cyan-300">
                        {isActionLocked ? 'STAND ASIDE' : consensusSignal === 'BUY' ? 'BUY NOW' : consensusSignal === 'SELL' ? 'WHALE EXIT' : 'HOLD'}
                      </div>
                      <div className="rounded border border-gray-700 bg-gray-900/40 px-3 py-2 text-gray-300">
                        {netWhaleFlow > 0 ? 'FLOW STRONG' : 'FLOW WEAK'}
                      </div>
                      <div className={`rounded border px-3 py-2 ${isActionLocked ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-green-700 bg-green-900/20 text-green-300'}`}>
                        {isActionLocked ? 'RISK HIGH' : 'RISK OK'}
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-auto pr-1">
                      <AINarrativeDisplay symbol={symbol} type="broker" autoRefresh />
                    </div>
                  )}
                  <div className="mt-2 rounded border border-gray-700 bg-gray-900/30 px-2 py-1.5 text-[10px] text-gray-400">
                    Personal Research Only: Analisis ini adalah pengolahan data statistik, bukan ajakan beli/jual.
                  </div>
                </Card>
              </div>

              <div className="xl:col-span-4 xl:min-h-56">
                <Card title="Smart Position Sizing" subtitle="Inputs calculator" headerDensity="compact" className="p-3! h-full">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-sm mb-3">
                    <label className="text-[10px] text-gray-400">
                      Drawdown %
                      <input
                        type="number"
                        value={portfolioDrawdown}
                        onChange={(e) => setPortfolioDrawdown(Number(e.target.value) || 0)}
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                    <label className="text-[10px] text-gray-400">
                      Entry
                      <input
                        type="number"
                        value={positionInputs.entry}
                        onChange={(e) => setPositionInputs((prev) => ({ ...prev, entry: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                    <label className="text-[10px] text-gray-400">
                      Stop-Loss
                      <input
                        type="number"
                        value={positionInputs.stopLoss}
                        onChange={(e) => setPositionInputs((prev) => ({ ...prev, stopLoss: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                    <label className="text-[10px] text-gray-400">
                      ATR Volatility
                      <input
                        type="number"
                        value={positionInputs.atr}
                        onChange={(e) => setPositionInputs((prev) => ({ ...prev, atr: Number(e.target.value) || 0 }))}
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                    <label className="text-[10px] text-gray-400">
                      Avg Daily Volume (lot)
                      <input
                        type="number"
                        value={liquidityInputs.avgDailyVolumeLots}
                        onChange={(e) =>
                          setLiquidityInputs((prev) => ({
                            ...prev,
                            avgDailyVolumeLots: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                    <label className="text-[10px] text-gray-400">
                      Participation Cap %
                      <input
                        type="number"
                        min={0.5}
                        max={1}
                        step={0.1}
                        value={liquidityInputs.participationCapPct}
                        onChange={(e) =>
                          setLiquidityInputs((prev) => ({
                            ...prev,
                            participationCapPct: Math.max(0.5, Math.min(1, Number(e.target.value) || 0.5)),
                          }))
                        }
                        className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded"
                      />
                    </label>
                  </div>

                  {cooling.active && cooling.until && (
                    <div className="mb-2 rounded border border-red-700 bg-red-900/20 px-2 py-1.5 text-[11px] text-red-300">
                      Forced Cooling-Off: recommendation locked until {new Date(cooling.until).toLocaleString()}
                    </div>
                  )}

                  {isCapApplied && (
                    <div className="mb-2 rounded border border-yellow-700 bg-yellow-900/20 px-2 py-1.5 text-[11px] text-yellow-300">
                      Participation cap active: recommendation clipped to {liquidityInputs.participationCapPct.toFixed(1)}% of daily volume.
                    </div>
                  )}

                  {isHighImpactOrder && (
                    <div className="mb-2 rounded border border-red-700 bg-red-900/20 px-2 py-1.5 text-[11px] text-red-300 font-semibold">
                      High Impact Order - Liquidity Risk!
                    </div>
                  )}

                  <div className="mb-2 rounded border border-gray-700 bg-gray-900/30 p-2">
                    <div className="text-[11px] font-semibold text-gray-300 mb-1.5">Beta-Weighting Analysis</div>
                    <div className="space-y-1.5">
                      {betaPositions.map((position, index) => (
                        <div key={`${position.symbol}-${index}`} className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={position.symbol}
                            onChange={(event) =>
                              setBetaPositions((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, symbol: event.target.value.toUpperCase().slice(0, 6) } : item,
                                ),
                              )
                            }
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[11px]"
                          />
                          <input
                            type="number"
                            value={position.weightPct}
                            onChange={(event) =>
                              setBetaPositions((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, weightPct: Math.max(0, Number(event.target.value) || 0) } : item,
                                ),
                              )
                            }
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[11px]"
                            placeholder="Weight %"
                          />
                          <input
                            type="number"
                            step={0.05}
                            value={position.beta}
                            onChange={(event) =>
                              setBetaPositions((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, beta: Math.max(0, Number(event.target.value) || 0) } : item,
                                ),
                              )
                            }
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[11px]"
                            placeholder="Beta"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[10px] text-gray-500">Columns: Symbol • Weight % • Beta</div>
                  </div>

                  {isSystemicRiskHigh && (
                    <div className="mb-2 rounded border border-red-700 bg-red-900/20 px-2 py-1.5 text-[11px] text-red-300 font-semibold">
                      Systemic Risk High: Portfolio too sensitive to Market Crash.
                    </div>
                  )}

                  <div
                    className={`mb-2 rounded border px-2 py-1.5 text-[11px] ${
                      modelComparison.swapRecommended
                        ? 'border-yellow-700 bg-yellow-900/20 text-yellow-300'
                        : 'border-gray-700 bg-gray-900/30 text-gray-300'
                    }`}
                  >
                    Champion vs Challenger (30d): {modelComparison.championVersion} {modelComparison.championAccuracy.toFixed(1)}% vs{' '}
                    {modelComparison.challengerVersion} {modelComparison.challengerAccuracy.toFixed(1)}% •{' '}
                    {modelComparison.swapRecommended ? 'Swap Recommended' : `${modelComparison.winner} Stable`}
                  </div>

                  {isAiConfidenceLow && (
                    <div className="mb-2 rounded border border-red-700 bg-red-900/20 px-2 py-1.5 text-[11px] text-red-300 font-semibold">
                      {modelConfidence.warning || 'AI CONFIDENCE: LOW - RE-CALIBRATION REQUIRED'}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">ATR Volatility</div>
                      <div className="font-semibold text-yellow-300">{positionInputs.atr.toFixed(2)}</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Risk-Based Lot</div>
                      <div className="font-semibold text-cyan-300">{riskBasedLot}</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Final Recommended Lot</div>
                      <div className="font-semibold text-green-300">{recommendedLot}</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Cap Lot ({liquidityInputs.participationCapPct.toFixed(1)}%)</div>
                      <div className="font-semibold text-yellow-300">{participationCapLot}</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Impact (Risk-Based)</div>
                      <div className={`font-semibold ${requestedImpactPct > 5 ? 'text-red-300' : 'text-cyan-300'}`}>{requestedImpactPct.toFixed(2)}%</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Impact (Final)</div>
                      <div className="font-semibold text-cyan-300">{finalImpactPct.toFixed(2)}%</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Portfolio Beta</div>
                      <div className={`font-semibold ${isSystemicRiskHigh ? 'text-red-300' : 'text-cyan-300'}`}>{portfolioBeta.toFixed(2)}</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Total Weight</div>
                      <div className="font-semibold text-yellow-300">{totalWeightPct.toFixed(0)}%</div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">AI Accuracy (Hist)</div>
                      <div className={`font-semibold ${isAiConfidenceLow ? 'text-red-300' : 'text-cyan-300'}`}>
                        {modelConfidence.accuracyPct.toFixed(1)}% • {modelConfidence.label}
                      </div>
                    </div>
                    <div className="p-2 rounded border border-gray-700 bg-gray-900/40">
                      <div className="text-gray-400 text-xs">Last Eval Window</div>
                      <div className="font-semibold text-yellow-300">
                        H {modelConfidence.hits} / M {modelConfidence.misses} / P {modelConfidence.pending}
                      </div>
                    </div>
                  </div>
                  <button className="mt-2 w-full px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm inline-flex items-center justify-center gap-2">
                    <Calculator className="w-4 h-4" /> Calculate
                  </button>
                </Card>
              </div>

              <div className="xl:col-span-3 xl:min-h-56">
                <Card title="Action Dock" headerDensity="compact" className="p-3! h-full">
                  <div className="space-y-1.5">
                    <button
                      disabled={isActionLocked}
                      className={`w-full px-3 py-2 rounded border inline-flex items-center justify-center gap-2 text-sm ${
                        isActionLocked
                          ? 'border-gray-700 bg-gray-800/60 text-gray-500 cursor-not-allowed'
                          : 'border-cyan-700 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/30'
                      }`}
                    >
                      <Send className="w-4 h-4" /> {cooling.active ? 'Signal Locked: Cooling-Off' : workerOfflineLock ? 'Signal Locked: Engine Offline' : isGloballyLocked ? 'Signal Locked: System Inactive' : goldenRecord.lock ? 'Signal Locked: Golden Record' : rocKillSwitch ? 'Signal Locked: Volatility Spike' : snapshotIntegrityLock ? 'Signal Locked: Audit Integrity' : reconciliationLock ? 'Signal Locked: Data Reconciliation' : priceCrossCheckLock ? 'Signal Locked: Price Cross-Check' : dataSanityLock ? 'Signal Locked: Data Contaminated' : dataGapLock ? 'Signal Locked: Incomplete Data' : refetchSymbolLock ? `Signal Locked: Re-fetch ${symbol}` : orchestratorNightlyLock ? 'Signal Locked: Nightly Guardrail' : shouldStandAside ? 'Signal Locked: Stand Aside' : 'Send Signal to Telegram'}
                    </button>
                    <button className="w-full px-3 py-2 rounded border border-yellow-700 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-900/30 inline-flex items-center justify-center gap-2 text-sm">
                      <Bell className="w-4 h-4" /> Set Price Alert
                    </button>
                    <button className="w-full px-3 py-2 rounded border border-red-700 bg-red-900/20 text-red-300 hover:bg-red-900/30 inline-flex items-center justify-center gap-2 text-sm">
                      <FileDown className="w-4 h-4" /> Export PDF Report
                    </button>
                    <button className="w-full px-3 py-2 rounded border border-green-700 bg-green-900/20 text-green-300 hover:bg-green-900/30 inline-flex items-center justify-center gap-2 text-sm">
                      <FlaskConical className="w-4 h-4" /> Backtesting Rig Control
                    </button>
                    <button
                      onClick={retryFailedRefetchQueue}
                      disabled={retryFailedState.inProgress || refetchQueueSummary.failed <= 0}
                      className={`w-full px-3 py-2 rounded border inline-flex items-center justify-center gap-2 text-sm ${
                        retryFailedState.inProgress || refetchQueueSummary.failed <= 0
                          ? 'border-gray-700 bg-gray-800/60 text-gray-500 cursor-not-allowed'
                          : 'border-orange-700 bg-orange-900/20 text-orange-300 hover:bg-orange-900/30'
                      }`}
                    >
                      <Bell className="w-4 h-4" /> {retryFailedState.inProgress ? 'Retrying Failed Queue...' : 'Retry Failed Queue'}
                    </button>

                    {!isCombatMode && (
                      <>
                        <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5 text-[10px] text-gray-400">
                          Snapshot-on-Signal: {snapshotInfo.error ? `ERROR - ${snapshotInfo.error}` : snapshotInfo.lastSavedAt ? `Saved ${new Date(snapshotInfo.lastSavedAt).toLocaleTimeString()}` : 'Waiting signal'}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${isAiConfidenceLow ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Model Confidence: {modelConfidence.accuracyPct.toFixed(1)}% ({modelConfidence.evaluatedSignals} eval) • {modelConfidence.label}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${snapshotIntegrityLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Audit Integrity: {snapshotIntegrity.valid ? 'OK' : 'MISMATCH'} • {snapshotIntegrity.checkedRows} rows ({snapshotIntegrity.upgradedRows} v2)
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${reconciliationLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Reconciliation: {reconciliation.flaggedDays}/{reconciliation.checkedDays} flagged • threshold {reconciliation.thresholdPct}%
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${logicRegressionWarn ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Logic Regression: {logicRegression.pass ? 'PASS' : 'FAIL'} • {logicRegression.mismatches}/{logicRegression.checkedCases} mismatch
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${priceCrossCheckLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Price Cross-Check: {priceCrossCheck.flaggedSymbols.length ? `FLAGGED (${priceCrossCheck.flaggedSymbols.join(', ')})` : 'OK'} • {priceCrossCheck.checkedSymbols} symbols
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${workerOfflineLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Worker Heartbeat: {workerHeartbeat.online ? 'ONLINE' : 'OFFLINE'}
                          {workerHeartbeat.lastSeenSeconds !== null ? ` • ${workerHeartbeat.lastSeenSeconds}s ago` : ''}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${dataSanityLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Data Sanity: {dataSanity.contaminated ? 'CONTAMINATED' : 'CLEAN'} • {dataSanity.checkedPoints} points
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${dataGapLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Stream Gap: {maxStreamGapSeconds.toFixed(1)}s {dataGapLock ? '(INCOMPLETE)' : '(OK)'}
                        </div>
                        <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5 text-[10px] text-gray-400">
                          Retention: {maintenanceRetention.lastRunAt ? `ran ${new Date(maintenanceRetention.lastRunAt).toLocaleTimeString()}` : 'pending'} •
                          {' '}token flush {maintenanceRetention.tokenFlushed} • purge T{maintenanceRetention.tradesPurged}/S{maintenanceRetention.snapshotsPurged}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${orchestratorNightlyLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Orchestrator: nightly {orchestratorStatus.nightlyPass ? 'PASS' : 'FAIL'}
                          {orchestratorStatus.nightlyLastDate ? ` (${orchestratorStatus.nightlyLastDate})` : ''} • monthly {orchestratorStatus.monthlyLastKey || '-'}
                          {' '}• loss {orchestratorStatus.monthlyLossRatePct.toFixed(1)}%
                          {' '}• failed {orchestratorStatus.nightlyFailedSymbols.length}
                          {' '}• queued {orchestratorStatus.nightlyRefetchQueueAdded}
                          {orchestratorStatus.monthlySwapRecommended ? ' • challenger swap' : ''}
                          {orchestratorStatus.monthlyTopFailureFlag ? ` • top flag ${orchestratorStatus.monthlyTopFailureFlag}` : ''}
                          {orchestratorStatus.nightlyDue || orchestratorStatus.monthlyDue ? ' • due' : ''}
                          {orchestratorStatus.lastError ? ` • err: ${orchestratorStatus.lastError}` : ''}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${refetchSymbolLock ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Re-fetch Queue ({symbol}): {refetchQueue.status ? `${refetchQueue.status} • ${refetchQueue.reason || 'n/a'}` : 'CLEAR'}
                        </div>
                        <div className={`rounded border px-2 py-1.5 text-[10px] ${refetchQueueSummary.failed > 0 ? 'border-red-700 bg-red-900/20 text-red-300' : refetchQueueSummary.pending + refetchQueueSummary.processing > 0 ? 'border-yellow-700 bg-yellow-900/20 text-yellow-300' : 'border-gray-700 bg-gray-900/40 text-gray-400'}`}>
                          Queue Global: P {refetchQueueSummary.pending} • X {refetchQueueSummary.processing} • D {refetchQueueSummary.done} • F {refetchQueueSummary.failed} • T {refetchQueueSummary.total}
                        </div>
                        {retryFailedState.lastMessage && (
                          <div className="rounded border border-gray-700 bg-gray-900/40 px-2 py-1.5 text-[10px] text-gray-400">
                            {retryFailedState.lastMessage}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </ErrorBoundary>
    </div>
  );
}
