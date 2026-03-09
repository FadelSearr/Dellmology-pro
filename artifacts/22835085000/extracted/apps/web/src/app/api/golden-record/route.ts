import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type AnchorSymbol = 'BBCA' | 'ASII' | 'TLKM';

interface AnchorValidation {
  symbol: AnchorSymbol;
  internal_price: number;
  external_price: number;
  deviation_pct: number;
  is_valid: boolean;
  external_source: 'YAHOO_QUOTE' | 'UNAVAILABLE';
}

const ANCHOR_SYMBOLS: AnchorSymbol[] = ['BBCA', 'ASII', 'TLKM'];
const MAX_ALLOWED_DEVIATION_PCT = 2;

export async function GET() {
  try {
    const rows = await fetchLatestInternalPrices(ANCHOR_SYMBOLS);
    const externalPrices = await fetchYahooAnchorPrices(ANCHOR_SYMBOLS);

    const validations: AnchorValidation[] = ANCHOR_SYMBOLS.map((symbol) => {
      const internal = Number(rows[symbol] || 0);
      const external = Number(externalPrices[symbol] || 0);
      const deviation = calculateDeviationPct(internal, external);
      const externalAvailable = external > 0;

      return {
        symbol,
        internal_price: internal,
        external_price: external,
        deviation_pct: deviation,
        is_valid: externalAvailable && deviation <= MAX_ALLOWED_DEVIATION_PCT,
        external_source: externalAvailable ? 'YAHOO_QUOTE' : 'UNAVAILABLE',
      };
    });

    const failed = validations.filter((item) => !item.is_valid);

    return NextResponse.json({
      anchors: validations,
      is_system_safe: failed.length === 0,
      trigger_kill_switch: failed.length > 0,
      max_allowed_deviation_pct: MAX_ALLOWED_DEVIATION_PCT,
      failed_symbols: failed.map((item) => item.symbol),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('golden-record validation failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate golden records',
        is_system_safe: false,
        trigger_kill_switch: true,
      },
      { status: 500 },
    );
  }
}

async function fetchLatestInternalPrices(symbols: AnchorSymbol[]): Promise<Record<AnchorSymbol, number>> {
  const result = await db.query(
    `
      SELECT DISTINCT ON (symbol)
        symbol,
        close as price
      FROM daily_prices
      WHERE symbol = ANY($1)
      ORDER BY symbol, date DESC
    `,
    [symbols],
  );

  const prices: Record<AnchorSymbol, number> = {
    BBCA: 0,
    ASII: 0,
    TLKM: 0,
  };

  result.rows.forEach((row: { symbol: AnchorSymbol; price: number }) => {
    prices[row.symbol] = Number(row.price || 0);
  });

  return prices;
}

async function fetchYahooAnchorPrices(symbols: AnchorSymbol[]): Promise<Record<AnchorSymbol, number>> {
  const prices: Record<AnchorSymbol, number> = {
    BBCA: 0,
    ASII: 0,
    TLKM: 0,
  };

  const yahooSymbols = symbols.map((symbol) => `${symbol}.JK`).join(',');
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return prices;
    }

    const body = (await response.json()) as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          regularMarketPrice?: number;
        }>;
      };
    };

    for (const row of body?.quoteResponse?.result || []) {
      const rawSymbol = String(row.symbol || '').toUpperCase();
      const normalized = rawSymbol.replace('.JK', '') as AnchorSymbol;
      if (symbols.includes(normalized)) {
        prices[normalized] = Number(row.regularMarketPrice || 0);
      }
    }
  } catch {
    return prices;
  }

  return prices;
}

function calculateDeviationPct(internalPrice: number, externalPrice: number): number {
  if (!internalPrice || !externalPrice) {
    return 100;
  }

  return Number((Math.abs(internalPrice - externalPrice) / Math.max(internalPrice, 1) * 100).toFixed(3));
}
