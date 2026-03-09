import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COMMODITY_MAP: Record<string, string[]> = {
  ADRO: ['coal'],
  PTBA: ['coal'],
  ANTM: ['nickel', 'gold'],
  INCO: ['nickel'],
  MEDC: ['oil', 'gas'],
  PGAS: ['gas'],
};

const PRICE_ENDPOINTS: Record<string, string> = {
  coal: 'https://query1.finance.yahoo.com/v8/finance/chart/QCL=F',
  oil: 'https://query1.finance.yahoo.com/v8/finance/chart/CL=F',
  gas: 'https://query1.finance.yahoo.com/v8/finance/chart/NG=F',
  nickel: 'https://query1.finance.yahoo.com/v8/finance/chart/NI=F',
  gold: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F',
};

async function fetchCommoditySignal(keys: string[]): Promise<{ score: number; details: Array<{ key: string; change_pct: number }> }> {
  const details: Array<{ key: string; change_pct: number }> = [];

  for (const key of keys) {
    const endpoint = PRICE_ENDPOINTS[key];
    if (!endpoint) continue;

    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) continue;
      const payload = await response.json();
      const closes = payload?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      const valid = closes.filter((v: number | null) => Number.isFinite(v));
      if (valid.length < 2) continue;
      const prev = Number(valid[valid.length - 2] || 0);
      const latest = Number(valid[valid.length - 1] || 0);
      if (prev <= 0 || latest <= 0) continue;
      const changePct = ((latest - prev) / prev) * 100;
      details.push({ key, change_pct: Number(changePct.toFixed(3)) });
    } catch {
      continue;
    }
  }

  const score = details.length > 0 ? details.reduce((sum, item) => sum + item.change_pct, 0) / details.length : 0;
  return { score: Number(score.toFixed(3)), details };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();
    const mapped = COMMODITY_MAP[symbol] || ['oil'];

    const signal = await fetchCommoditySignal(mapped);
    const label = signal.score >= 0.5 ? 'POSITIVE' : signal.score <= -0.5 ? 'NEGATIVE' : 'NEUTRAL';

    return NextResponse.json({
      symbol,
      mapped_commodities: mapped,
      correlation_score: signal.score,
      correlation_label: label,
      details: signal.details,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to compute commodity correlation',
        details: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 500 },
    );
  }
}
