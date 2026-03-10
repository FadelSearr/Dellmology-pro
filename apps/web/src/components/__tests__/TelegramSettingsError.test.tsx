import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TelegramSettings from '../settings/TelegramSettings';

describe('TelegramSettings error path', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows error message when save fails', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'save failed' }) }) as jest.Mock;

    render(<TelegramSettings />);

    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
    });
  });
});
