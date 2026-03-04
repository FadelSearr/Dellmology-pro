import { buildSignalSnapshotPayload } from '@/lib/signalSnapshotPayload';

describe('signalSnapshotPayload', () => {
  it('enriches snapshot payload with consensus and participation context', () => {
    const payload = buildSignalSnapshotPayload({
      alertData: {
        symbol: 'BBCA',
        confidence: 78,
      },
      snapshotSource: 'telegram-alert',
      adversarialSource: 'ai',
      nowIso: '2026-03-04T10:00:00.000Z',
      modelConsensus: {
        technical: 'BUY',
        bandarmology: 'BUY',
        sentiment: 'SELL',
        bullishVotes: 2,
        bearishVotes: 1,
        pass: true,
        status: 'CONSENSUS_BULL',
        message: 'Consensus Bullish (2/3 setuju)',
      },
      liquidityGuard: {
        dailyVolumeLots: 100000,
        capPct: 0.01,
        liquidityCapLots: 1000,
        atrPoints: 20,
        atrPct: 0.02,
        slippageBufferPct: 0.005,
        riskPerTradePct: 0.01,
        riskBudgetRp: 1000000,
        riskPerLotRp: 10000,
        riskBasedLots: 1200,
        activeCap: 'LIQUIDITY',
        maxLots: 1000,
        impactPct: 0.01,
        highImpactOrder: false,
        participationCapBinding: true,
        warning: 'Participation Rate Cap active: max 1.00% of daily volume',
      },
    });

    expect(payload.snapshot_source).toBe('telegram-alert');
    expect(payload.snapshot_context).toBeDefined();

    const context = payload.snapshot_context as Record<string, unknown>;
    expect(context.recorded_at).toBe('2026-03-04T10:00:00.000Z');

    const consensus = context.consensus as Record<string, unknown>;
    expect(consensus.status).toBe('CONSENSUS_BULL');
    expect(consensus.bullish_votes).toBe(2);

    const liquidity = context.liquidity_guard as Record<string, unknown>;
    expect(liquidity.participation_gate).toBe('ACTIVE');
    expect(liquidity.participation_cap_binding).toBe(true);
    expect(liquidity.active_cap).toBe('LIQUIDITY');
  });
});
