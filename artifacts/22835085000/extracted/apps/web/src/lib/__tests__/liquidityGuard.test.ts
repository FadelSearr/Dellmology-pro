import { calculateLiquidityGuard } from '@/lib/liquidityGuard';

describe('liquidityGuard', () => {
  const baseInput = {
    marketData: [
      { price: 1000, volume: 1000000 },
      { price: 1010, volume: 1200000 },
      { price: 1020, volume: 1100000 },
      { price: 1030, volume: 1300000 },
    ],
    marketTotalVolume: 50000000,
    currentPrice: 1030,
    killSwitchActive: false,
    runtimeParticipationCapNormalPct: 0.01,
    runtimeParticipationCapRiskPct: 0.005,
    positionSizingAtrWindow: 14,
    positionSizingSlippageRiskPct: 0.01,
    positionSizingSlippageNormalPct: 0.005,
    positionSizingRiskPerTradePct: 0.01,
    positionSizingAccountRp: 100000000,
  };

  it('activates participation cap warning when liquidity cap binds', () => {
    const result = calculateLiquidityGuard({
      ...baseInput,
      runtimeParticipationCapNormalPct: 0.0002,
    });

    expect(result.activeCap).toBe('LIQUIDITY');
    expect(result.participationCapBinding).toBe(true);
    expect(result.warning).toMatch(/Participation Rate Cap active/i);
  });

  it('uses risk mode participation cap when kill switch is active', () => {
    const result = calculateLiquidityGuard({
      ...baseInput,
      killSwitchActive: true,
    });

    expect(result.capPct).toBe(0.005);
  });

  it('raises high impact warning when order impact exceeds 5%', () => {
    const result = calculateLiquidityGuard({
      ...baseInput,
      marketTotalVolume: 200000,
      runtimeParticipationCapNormalPct: 0.2,
      positionSizingAccountRp: 1000000000,
    });

    expect(result.highImpactOrder).toBe(true);
    expect(result.warning).toBe('High Impact Order - Liquidity Risk!');
  });
});
