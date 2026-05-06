import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('@clerk/chrome-extension', () => ({
  useAuth: useAuthMock,
  SignIn: ({ routing }: { routing?: string }) => (
    <div data-testid="clerk-signin" data-routing={routing}>
      Sign in
    </div>
  ),
  UserButton: () => <div data-testid="clerk-user-button">User</div>,
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { getSettingsMock, setSettingsMock } = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
  setSettingsMock: vi.fn(),
}));

vi.mock('../src/lib/settings.js', () => ({
  defaultSettings: {
    paused: false,
    perPlatformEnabled: { chatgpt: true, claude: true, gemini: true, perplexity: true },
  },
  getSettings: getSettingsMock,
  setSettings: setSettingsMock,
}));

import { Popup } from '../src/entrypoints/popup/Popup.js';

beforeEach(() => {
  useAuthMock.mockReset();
  getSettingsMock.mockReset();
  setSettingsMock.mockReset();
  getSettingsMock.mockResolvedValue({
    paused: false,
    perPlatformEnabled: { chatgpt: true, claude: true, gemini: true, perplexity: true },
  });
  setSettingsMock.mockResolvedValue(undefined);
});

afterEach(() => {
  // happy-dom + vitest globals: false leaves the rendered tree
  // attached to document.body across tests. Wipe it so role/testid
  // queries don't return doubled-up matches.
  cleanup();
});

describe('Popup', () => {
  it('renders nothing while Clerk is still loading', () => {
    useAuthMock.mockReturnValue({ isLoaded: false, userId: null });

    const { container } = render(<Popup />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Clerk SignIn component when the user is signed out', async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, userId: null });

    render(<Popup />);

    expect(await screen.findByTestId('clerk-signin')).toBeInTheDocument();
    // Hash routing keeps the auth flow inside the popup window.
    expect(screen.getByTestId('clerk-signin')).toHaveAttribute('data-routing', 'hash');
    expect(screen.queryByTestId('clerk-user-button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause|resume/i })).not.toBeInTheDocument();
  });

  it('shows UserButton and the capture controls when signed in', async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, userId: 'user_42' });

    render(<Popup />);

    expect(await screen.findByTestId('clerk-user-button')).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-signin')).not.toBeInTheDocument();
    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('toggles the paused flag through the Pause button', async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, userId: 'user_42' });

    render(<Popup />);

    const button = await screen.findByRole('button', { name: 'Pause' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(setSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ paused: true }));
    });
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('renders a dashboard link for signed-in users', async () => {
    useAuthMock.mockReturnValue({ isLoaded: true, userId: 'user_42' });

    render(<Popup />);

    const link = await screen.findByRole('link', { name: 'Open dashboard' });
    expect(link).toHaveAttribute('href', 'https://app.avowly.io');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
