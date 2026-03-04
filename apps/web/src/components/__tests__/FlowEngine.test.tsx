import React from 'react';
import { render, screen } from '@testing-library/react';
import { FlowEngine } from '@/components/dashboard/FlowEngine';

describe('FlowEngine negotiated monitor hardening', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/broker-flow')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            symbol: 'TEST',
            days: 7,
            filter: 'mix',
            brokers: [
              {
                broker_id: 'PD',
                net_buy_value: 100000000,
                consistency_score: 70,
                is_whale: false,
                is_retail: true,
                is_anomalous: false,
                z_score: 1.2,
                daily_heatmap: [1000000, -200000, 300000],
              },
            ],
            stats: {
              total_brokers: 1,
              whales: 0,
              retail: 1,
              wash_sale_score: 12,
            },
            last_updated: new Date().toISOString(),
          }),
        } as Response);
      }

      if (url.includes('/api/negotiated-monitor')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            count: 3,
            summary: {
              total_volume: 150000,
              total_notional: 1200000000,
              nego_count: 2,
              cross_count: 1,
            },
            items: [
              {
                timestamp: new Date().toISOString(),
                symbol: 'TEST',
                price: 12345,
                volume: 1000,
                trade_type: 'NEGO',
                notional: 12345000,
              },
            ],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders negotiated feed safely when summary payload is missing', async () => {
    render(<FlowEngine symbol="TEST" />);

    expect(await screen.findByText('Nego Market Feed')).toBeInTheDocument();
    expect(screen.getByText('NEGO:')).toBeInTheDocument();
    expect(screen.getByText('CROSS:')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
    expect(screen.getByText('NEGO')).toBeInTheDocument();
  });
});
