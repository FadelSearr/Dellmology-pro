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

import { db } from '@/lib/db';

describe('Signal Snapshots Postmortem API', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (db.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          rule_engine_mode: 'CUSTOM',
          rule_engine_version: 'RE-DB-AAA111',
          rule_engine_source: 'DB',
          total_signals: 12,
          evaluated_signals: 10,
          hits: 7,
          misses: 3,
        },
      ],
    });
  });

  it('returns aggregated postmortem by rule engine version', async () => {
    const { GET } = await import('@/app/api/signal-snapshots/postmortem/route');
    const req = {
      url: 'http://localhost/api/signal-snapshots/postmortem?symbol=bbca&rule_engine_mode=custom&window=300&horizonMinutes=45&slippagePct=1.0&minEvaluated=2&top=10',
    } as Request;

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.rows[0].rule_engine_version).toBe('RE-DB-AAA111');
    expect(json.rows[0].accuracy_pct).toBe(70);
    expect(json.summary.evaluated_signals).toBe(10);
    expect(json.summary.accuracy_pct).toBe(70);

    const call = (db.query as jest.Mock).mock.calls[0];
    const sql = String(call[0]);
    const params = call[1] as unknown[];

    expect(sql).toContain("payload->'snapshot_context'->'rule_engine'->>'version'");
    expect(sql).toContain("payload->'rule_engine_versioning'->>'version'");
    expect(params).toEqual(['BBCA', 'CUSTOM', null, 300, 1, 45, 2, 10]);
  });
});
