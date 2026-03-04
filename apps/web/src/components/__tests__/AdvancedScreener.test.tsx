import { render, screen, waitFor } from '@testing-library/react';
import { AdvancedScreener } from '../analysis/AdvancedScreener';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        mode: 'DAYTRADE',
        timestamp: new Date().toISOString(),
        total_scanned: 0,
        results: [],
        top_pick: null,
        statistics: {},
      }),
  } as any)
) as jest.Mock;

describe('AdvancedScreener', () => {
  it('renders mode buttons', () => {
    render(<AdvancedScreener />);
    expect(screen.getByText('DAYTRADE')).toBeInTheDocument();
    expect(screen.getByText('SWING')).toBeInTheDocument();
  });

  it('shows lock message when API returns 423', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 423,
      json: async () => ({ error: 'Cooling-off active: screener temporarily locked' }),
    });

    render(<AdvancedScreener />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Screener locked: Cooling-off active: screener temporarily locked/i)).toBeInTheDocument();
    });
  });
});