import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Vote = 'BUY' | 'SELL' | 'NEUTRAL';

interface SnapshotRow {
  id: number;
  symbol: string;
  signal: Vote;
  payload: {
    votes?: {
      technical?: Vote;
      bandarmology?: Vote;
      sentiment?: Vote;
      buy_votes?: number;
      sell_votes?: number;
    };
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') || 'BBCA').toUpperCase();
    const limit = Math.min(200, Math.max(20, Number(searchParams.get('limit') || 100)));

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

    const rows = result.rows as SnapshotRow[];
    let mismatches = 0;
    const issues: Array<{ id: number; message: string }> = [];

    for (const row of rows) {
      const technical = row.payload?.votes?.technical || 'NEUTRAL';
      const bandarmology = row.payload?.votes?.bandarmology || 'NEUTRAL';
      const sentiment = row.payload?.votes?.sentiment || 'NEUTRAL';
      const votes = [technical, bandarmology, sentiment];

      const computedBuyVotes = votes.filter((vote) => vote === 'BUY').length;
      const computedSellVotes = votes.filter((vote) => vote === 'SELL').length;
      const computedSignal: Vote = computedBuyVotes >= 2 ? 'BUY' : computedSellVotes >= 2 ? 'SELL' : 'NEUTRAL';

      const storedBuyVotes = Number(row.payload?.votes?.buy_votes ?? computedBuyVotes);
      const storedSellVotes = Number(row.payload?.votes?.sell_votes ?? computedSellVotes);
      const hasMismatch =
        storedBuyVotes !== computedBuyVotes ||
        storedSellVotes !== computedSellVotes ||
        row.signal !== computedSignal;

      if (hasMismatch) {
        mismatches += 1;
        if (issues.length < 20) {
          issues.push({
            id: row.id,
            message: `Signal mismatch: stored(${row.signal}, B${storedBuyVotes}/S${storedSellVotes}) vs computed(${computedSignal}, B${computedBuyVotes}/S${computedSellVotes})`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      symbol,
      checked_cases: rows.length,
      mismatches,
      pass: mismatches === 0,
      deployment_blocked: mismatches > 0,
      issues,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('logic-regression GET failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to run logic regression' }, { status: 500 });
  }
}
