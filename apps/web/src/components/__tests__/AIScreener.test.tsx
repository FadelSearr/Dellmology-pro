import { filterByPrice } from '../intelligence/AIScreener';

import { render, screen, waitFor } from '@testing-library/react';
import { AIScreener, filterByPrice } from '../intelligence/AIScreener';

describe('AIScreener helper functions', () => {
  it('filterByPrice excludes results outside range', () => {
    const sample = [
      { symbol: 'A', price: 100 } as any,
      { symbol: 'B', price: 500 } as any,
      { symbol: 'C', price: 1000 } as any,
    ];
    const filtered = filterByPrice(sample, { min: 200, max: 800 });
    expect(filtered.map((r) => r.symbol)).toEqual(['B']);
  });

  it('shows lock message when screener API returns 423', async () => {
    const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    const mockedFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 423,
      json: async () => ({ error: 'Cooling-off active: screener temporarily locked' }),
    } as Response);

    (globalThis as { fetch?: typeof fetch }).fetch = mockedFetch as unknown as typeof fetch;

    render(<AIScreener />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Screener locked: Cooling-off active: screener temporarily locked/i)).toBeInTheDocument();
    });

    if (originalFetch === undefined) {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    } else {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    }
  });
});
