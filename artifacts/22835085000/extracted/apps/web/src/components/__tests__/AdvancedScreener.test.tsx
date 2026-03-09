import { render, screen, waitFor } from '@testing-library/react';
import { AdvancedScreener } from '../analysis/AdvancedScreener';

const buildSuccessPayload = () => ({
  mode: 'DAYTRADE',
  timestamp: new Date().toISOString(),
  total_scanned: 0,
  results: [],
  top_pick: null,
  statistics: {
    avg_score: 0,
    max_score: 0,
    min_score: 0,
    bullish_count: 0,
    bearish_count: 0,
    avg_volatility: 0,
    avg_rr_ratio: 0,
  },
});

global.fetch = jest.fn() as jest.Mock;

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => buildSuccessPayload(),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('AdvancedScreener', () => {
  it('renders mode buttons', async () => {
    render(<AdvancedScreener />);

    await waitFor(() => {
      expect(screen.queryByText('Scanning...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('DAYTRADE')).toBeInTheDocument();
    expect(screen.getByText('SWING')).toBeInTheDocument();
  });

  it('shows lock message when API returns 423', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 423,
      json: async () => ({ error: 'Cooling-off active: screener temporarily locked' }),
    });

    render(<AdvancedScreener />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Screener locked: Cooling-off active: screener temporarily locked/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});