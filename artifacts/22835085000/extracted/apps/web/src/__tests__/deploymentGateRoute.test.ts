jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('@/lib/security/immutableAudit', () => ({
  verifyRuntimeConfigAuditChain: jest.fn().mockResolvedValue({ valid: true }),
}));

jest.mock('@/lib/security/lockPayloads', () => ({
  buildImmutableAuditLockPayload: jest.fn().mockReturnValue({
    success: false,
    reason: 'immutable-audit-failed',
  }),
}));

import { db } from '@/lib/db';

describe('Deployment Gate API', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteResponse: {
          result: [
            { symbol: 'BBCA.JK', regularMarketPrice: 100 },
            { symbol: 'ASII.JK', regularMarketPrice: 200 },
            { symbol: 'TLKM.JK', regularMarketPrice: 300 },
          ],
        },
      }),
    } as never);
  });

  it('includes top rule-engine mismatch in evaluation reason', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM signal_snapshots') && sql.includes('ORDER BY created_at DESC')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              signal: 'BUY',
              payload: {
                snapshot_context: {
                  consensus: {
                    bullish_votes: 2,
                    bearish_votes: 1,
                    votes: {
                      technical: 'BUY',
                      bandarmology: 'BUY',
                      sentiment: 'SELL',
                    },
                  },
                  rule_engine: {
                    mode: 'CUSTOM',
                    version: 'RE-DB-123',
                  },
                },
              },
            },
            {
              id: 2,
              signal: 'SELL',
              payload: {
                votes: {
                  technical: 'BUY',
                  bandarmology: 'BUY',
                  sentiment: 'SELL',
                  buy_votes: 2,
                  sell_votes: 1,
                },
                rule_engine_versioning: {
                  mode: 'BASELINE',
                  version: 'RE-ENV-999',
                },
              },
            },
          ],
        });
      }

      if (sql.includes('FROM daily_prices')) {
        return Promise.resolve({
          rows: [
            { symbol: 'BBCA', price: 100 },
            { symbol: 'ASII', price: 200 },
            { symbol: 'TLKM', price: 300 },
          ],
        });
      }

      if (sql.includes('to_regclass')) {
        return Promise.resolve({ rows: [{ exists: true }] });
      }

      if (sql.includes('FROM runtime_config_audit')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('FROM signal_snapshots') && sql.includes('ORDER BY id ASC')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              symbol: 'BBCA',
              timeframe: '1D',
              signal: 'BUY',
              price: 100,
              unified_power_score: 70,
              payload: { foo: 'bar' },
              payload_hash: null,
              previous_hash: null,
              record_hash: null,
              hash_version: 1,
            },
          ],
        });
      }

      if (sql.includes('INSERT INTO config')) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const { GET } = await import('@/app/api/system-control/deployment-gate/route');
    const req = { url: 'http://localhost/api/system-control/deployment-gate?evaluate=true&symbol=BBCA&limit=100' } as Request;

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.source).toBe('evaluation');
    expect(json.blocked).toBe(true);
    expect(json.reason).toContain('logic regression mismatch 1/2');
    expect(json.reason).toContain('[BASELINE@RE-ENV-999: 1/1]');
    expect(json.regression.rule_engine_health).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'CUSTOM',
          version: 'RE-DB-123',
          mismatches: 0,
          checked_cases: 1,
        }),
        expect.objectContaining({
          mode: 'BASELINE',
          version: 'RE-ENV-999',
          mismatches: 1,
          checked_cases: 1,
        }),
      ]),
    );
  });
});
