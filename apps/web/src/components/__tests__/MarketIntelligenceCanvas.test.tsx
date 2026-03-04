import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MarketIntelligenceCanvas } from '../dashboard/MarketIntelligenceCanvas';

jest.mock('../dashboard/TradingViewWidget', () => ({
  __esModule: true,
  default: () => <div data-testid="tv-widget">TradingView</div>,
}));

describe('MarketIntelligenceCanvas', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows inline success message when Train CNN starts', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/api/market-intelligence')) {
        return {
          ok: true,
          json: async () => ({
            symbol: 'BBCA',
            timeframe: '1h',
            metrics: {
              haka_volume: 500000,
              haki_volume: 300000,
              total_volume: 800000,
              haka_ratio: 62.5,
              pressure_index: 12,
            },
            volatility: {
              percentage: 1.5,
              classification: 'NORMAL',
            },
            unified_power_score: {
              score: 72,
              signal: 'BUY',
              components: {
                haka_strength: 70,
                volume_momentum: 68,
                price_strength: 74,
                consistency: 66,
              },
            },
            timestamp: new Date().toISOString(),
          }),
        } as Response;
      }

      if (url.includes('/api/prediction')) {
        return {
          ok: true,
          json: async () => ({ success: false }),
        } as Response;
      }

      if (url.includes('/api/cnn')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (body.action === 'train') {
          return {
            ok: true,
            json: async () => ({ success: true }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as jest.Mock;

    render(<MarketIntelligenceCanvas symbol="BBCA" timeframe="1h" />);

    await waitFor(() => {
      expect(screen.getByText('BBCA')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Train CNN/i }));

    await waitFor(() => {
      expect(screen.getByText('Training started')).toBeInTheDocument();
    });
  });
});
