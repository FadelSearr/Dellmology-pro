import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AINarrativeDisplay } from '@/components/intelligence/AINarrativeDisplay';

// mock fetch globally
beforeAll(() => {
  global.fetch = jest.fn();
});

afterAll(() => {
  (global.fetch as jest.Mock).mockRestore && (global.fetch as jest.Mock).mockRestore();
});

describe('AINarrativeDisplay', () => {
  it('shows error when narrative API returns non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ok: false, status: 500, text: async () => 'server error'});
    await act(async () => {
      render(<AINarrativeDisplay symbol="TEST" />);
    });
    expect(await screen.findByText(/Error:/)).toBeInTheDocument();
  });

  it('does not crash when type swot and no data provided', async () => {
    // first fetch call for broker-flow is not used since type=swot
    (global.fetch as jest.Mock).mockResolvedValue({ok: true, json: async () => ({ narrative: 'ok', generated_at: new Date().toISOString() })});
    await act(async () => {
      render(<AINarrativeDisplay symbol="TEST" type="swot" />);
    });
    expect(await screen.findByText(/AI Analysis/)).toBeInTheDocument();
  });
});
