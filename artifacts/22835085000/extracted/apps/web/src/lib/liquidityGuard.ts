export interface LiquidityGuard {
  dailyVolumeLots: number;
  capPct: number;
  liquidityCapLots: number;
  atrPoints: number;
  atrPct: number;
  slippageBufferPct: number;
  riskPerTradePct: number;
  riskBudgetRp: number;
  riskPerLotRp: number;
  riskBasedLots: number;
  activeCap: 'ATR' | 'LIQUIDITY';
  maxLots: number;
  impactPct: number;
  highImpactOrder: boolean;
  participationCapBinding: boolean;
  warning: string | null;
}

interface PriceVolumePoint {
  price?: number;
  volume?: number;
}

interface LiquidityGuardInput {
  marketData: PriceVolumePoint[];
  marketTotalVolume?: number;
  currentPrice: number;
  killSwitchActive: boolean;
  runtimeParticipationCapNormalPct: number;
  runtimeParticipationCapRiskPct: number;
  positionSizingAtrWindow: number;
  positionSizingSlippageRiskPct: number;
  positionSizingSlippageNormalPct: number;
  positionSizingRiskPerTradePct: number;
  positionSizingAccountRp: number;
}

export function calculateLiquidityGuard(input: LiquidityGuardInput): LiquidityGuard {
  const {
    marketData,
    marketTotalVolume,
    currentPrice,
    killSwitchActive,
    runtimeParticipationCapNormalPct,
    runtimeParticipationCapRiskPct,
    positionSizingAtrWindow,
    positionSizingSlippageRiskPct,
    positionSizingSlippageNormalPct,
    positionSizingRiskPerTradePct,
    positionSizingAccountRp,
  } = input;

  const estimatedDailyVolumeShares =
    typeof marketTotalVolume === 'number' && marketTotalVolume > 0
      ? marketTotalVolume
      : marketData.reduce((sum, point) => sum + Number(point.volume || 0), 0);

  const estimatedDailyVolumeLots = Math.max(1, Math.floor(estimatedDailyVolumeShares / 100));
  const atrWindow = Math.min(positionSizingAtrWindow, Math.max(1, marketData.length - 1));

  let atrPoints = 0;
  if (atrWindow > 0 && marketData.length > 1) {
    let trSum = 0;
    for (let offset = 0; offset < atrWindow; offset += 1) {
      const currentIndex = marketData.length - 1 - offset;
      const previousIndex = currentIndex - 1;
      if (previousIndex < 0) {
        break;
      }

      const current = Number(marketData[currentIndex]?.price || 0);
      const previous = Number(marketData[previousIndex]?.price || current);
      trSum += Math.abs(current - previous);
    }
    atrPoints = trSum / atrWindow;
  }

  if (!Number.isFinite(atrPoints) || atrPoints <= 0) {
    atrPoints = Math.max(1, currentPrice * 0.01);
  }

  const atrPct = currentPrice > 0 ? atrPoints / currentPrice : 0;
  const slippageBufferPct = killSwitchActive ? positionSizingSlippageRiskPct : positionSizingSlippageNormalPct;
  const effectiveStopPoints = Math.max(1, atrPoints + currentPrice * slippageBufferPct);
  const riskPerLotRp = Math.max(1, effectiveStopPoints * 100);
  const riskPerTradePct = Math.max(0.001, positionSizingRiskPerTradePct);
  const riskBudgetRp = Math.max(1_000, positionSizingAccountRp * riskPerTradePct);
  const riskBasedLots = Math.max(1, Math.floor(riskBudgetRp / riskPerLotRp));

  const participationCapPct = killSwitchActive ? runtimeParticipationCapRiskPct : runtimeParticipationCapNormalPct;
  const liquidityCapLots = Math.max(1, Math.floor(estimatedDailyVolumeLots * participationCapPct));
  const maxRecommendedLots = Math.max(1, Math.min(liquidityCapLots, riskBasedLots));

  const participationCapBinding = riskBasedLots > liquidityCapLots;
  const activeCap: 'ATR' | 'LIQUIDITY' = participationCapBinding ? 'LIQUIDITY' : 'ATR';
  const impactPct = estimatedDailyVolumeLots > 0 ? maxRecommendedLots / estimatedDailyVolumeLots : 1;
  const highImpactOrder = impactPct > 0.05;

  let warning: string | null = null;
  if (highImpactOrder) {
    warning = 'High Impact Order - Liquidity Risk!';
  } else if (participationCapBinding) {
    warning = `Participation Rate Cap active: max ${(participationCapPct * 100).toFixed(2)}% of daily volume`; 
  } else if (activeCap === 'ATR') {
    warning = 'ATR risk cap active: volatility-adjusted lot sizing applied';
  } else if (maxRecommendedLots < 20) {
    warning = 'Liquidity warning: cap < 20 lots, high slippage risk';
  } else if (maxRecommendedLots < 100) {
    warning = 'Moderate liquidity: keep entries staggered';
  }

  return {
    dailyVolumeLots: estimatedDailyVolumeLots,
    capPct: participationCapPct,
    liquidityCapLots,
    atrPoints,
    atrPct,
    slippageBufferPct,
    riskPerTradePct,
    riskBudgetRp,
    riskPerLotRp,
    riskBasedLots,
    activeCap,
    maxLots: maxRecommendedLots,
    impactPct,
    highImpactOrder,
    participationCapBinding,
    warning,
  };
}
