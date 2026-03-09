import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrokerFlowTable } from '@/components/tables/BrokerFlowTable';
import { Section2_BrokerFlow } from '@/components/sections/Section2_BrokerFlow';

// sample broker entry for testing
const sampleData = [
  {
    broker_id: 'PD',
    net_buy_value: 1000000,
    active_days: 3,
    consistency_score: 0.5,
    avg_buy_price: 12000,
    z_score: 1.2,
    is_whale: false,
    is_retail: true,
    daily_heatmap: [100000, -50000, 200000, 0, -100000, 50000, 250000],
  },
  {
    broker_id: 'RHB',
    net_buy_value: -500000,
    active_days: 2,
    consistency_score: 0.3,
    avg_buy_price: 10500,
    z_score: -0.5,
    is_whale: false,
    is_retail: false,
    daily_heatmap: [-50000, -30000, -70000, 0, -10000, -20000, -40000],
  },
];

describe('BrokerFlowTable component', () => {
  it('renders basic broker information', () => {
    render(<BrokerFlowTable data={sampleData} symbol="TEST" />);
    // table headers should be visible
    expect(screen.getByText('BROKER')).toBeInTheDocument();
    expect(screen.getByText('NET VALUE')).toBeInTheDocument();
    // ensure both brokers appear
    expect(screen.getByText('PD')).toBeInTheDocument();
    expect(screen.getByText('RHB')).toBeInTheDocument();
    // net value formatting
    expect(screen.getByText('+1000K')).toBeInTheDocument();
    expect(screen.getByText('-500K')).toBeInTheDocument();
  });

  it('applies filters correctly', () => {
    render(<BrokerFlowTable data={sampleData} symbol="TEST" filterType="RETAIL" />);
    // only PD is retail
    expect(screen.getByText('PD')).toBeInTheDocument();
    expect(screen.queryByText('RHB')).toBeNull();
  });
});

// test Section2_BrokerFlow basic fetch logic by mocking global.fetch
describe('Section2_BrokerFlow', () => {
  beforeEach(() => {
    // jest-dom/jsdom may not define fetch; stub it ourselves
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        brokers: sampleData,
        stats: { total_brokers: sampleData.length, whales: 0, retail: 1, avg_net_value: 0, std_deviation: 0, wash_sale_score: 0 }
      }),
    });
  });

  afterEach(() => {
    if (global.fetch && (global.fetch as jest.Mock).mockRestore) {
      (global.fetch as jest.Mock).mockRestore();
    }
  });

  it('fetches broker data and displays table', async () => {
    render(<Section2_BrokerFlow symbol="TEST" />);
    // loading may happen, but eventually table should render
    const pdEls = await screen.findAllByText('PD');
    expect(pdEls.length).toBeGreaterThan(0);
    const rhbEls = await screen.findAllByText('RHB');
    expect(rhbEls.length).toBeGreaterThan(0);
  });
});
