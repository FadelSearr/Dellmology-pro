import type { LiquidityGuard } from '@/lib/liquidityGuard';
import type { ModelConsensus } from '@/lib/modelConsensus';

interface BuildSignalSnapshotPayloadInput {
  alertData: Record<string, unknown>;
  modelConsensus: ModelConsensus;
  liquidityGuard: LiquidityGuard;
  snapshotSource: string;
  adversarialSource: 'ai' | 'fallback';
  nowIso?: string;
}

export function buildSignalSnapshotPayload(input: BuildSignalSnapshotPayloadInput): Record<string, unknown> {
  const { alertData, modelConsensus, liquidityGuard, snapshotSource, adversarialSource, nowIso } = input;

  return {
    ...alertData,
    snapshot_source: snapshotSource,
    snapshot_context: {
      recorded_at: nowIso || new Date().toISOString(),
      adversarial_source: adversarialSource,
      consensus: {
        status: modelConsensus.status,
        pass: modelConsensus.pass,
        message: modelConsensus.message,
        bullish_votes: modelConsensus.bullishVotes,
        bearish_votes: modelConsensus.bearishVotes,
        votes: {
          technical: modelConsensus.technical,
          bandarmology: modelConsensus.bandarmology,
          sentiment: modelConsensus.sentiment,
        },
      },
      liquidity_guard: {
        participation_gate: liquidityGuard.participationCapBinding ? 'ACTIVE' : 'PASS',
        participation_cap_binding: liquidityGuard.participationCapBinding,
        participation_cap_pct: liquidityGuard.capPct,
        active_cap: liquidityGuard.activeCap,
        max_recommended_lots: liquidityGuard.maxLots,
        liquidity_cap_lots: liquidityGuard.liquidityCapLots,
        risk_based_lots: liquidityGuard.riskBasedLots,
        impact_pct: liquidityGuard.impactPct,
        high_impact_order: liquidityGuard.highImpactOrder,
      },
    },
  };
}
