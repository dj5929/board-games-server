import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { GameType } from '@packages/engine-core';
import { Lobby } from '../Lobby';

const API_URL = 'http://localhost:3000';

describe('Lobby', () => {
  let onJoinRoom: ReturnType<typeof vi.fn<(roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void>>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onJoinRoom = vi.fn<(roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void>();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    alertSpy.mockRestore();
  });

  function mockFetchResponse(body: unknown) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => body }));
  }

  it('creates a hot-seat game and joins with all player ids', async () => {
    mockFetchResponse({
      roomId: 'room-1',
      playerIds: ['p1', 'p2'],
      gameType: 'monopoly',
      sessionToken: 'tok-1',
    });
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-1', ['p1', 'p2'], 'monopoly', 'tok-1'));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 2, gameType: 'monopoly', hotSeat: true }),
    });
  });

  it('submits the selected game type and player count', async () => {
    mockFetchResponse({
      roomId: 'room-2',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      gameType: 'catan',
      sessionToken: 'tok-2',
    });
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.click(screen.getByText('Catan'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-2', ['p1', 'p2', 'p3', 'p4'], 'catan', 'tok-2'));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 4, gameType: 'catan', hotSeat: true }),
    });
  });

  it('shows a loading state while creating and re-enables the button afterwards', async () => {
    let resolveFetch!: (r: { json: () => Promise<unknown> }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(r => { resolveFetch = r; }))
    );
    render(<Lobby onJoinRoom={onJoinRoom} />);

    const createButton = screen.getByText('Create New Game');
    fireEvent.click(createButton);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    await act(async () => {
      resolveFetch({ json: async () => ({ roomId: 'room-3', playerIds: ['p1', 'p2'], gameType: 'monopoly', sessionToken: 'tok-3' }) });
    });

    await waitFor(() => expect(screen.getByText('Create New Game')).toBeEnabled());
  });

  it('alerts the user and resets when the server request fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to create room. Is the server running?');
      expect(screen.getByText('Create New Game')).toBeEnabled();
    });
    expect(onJoinRoom).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('renders the game mode, game type and player count controls', () => {
    mockFetchResponse({});
    render(<Lobby onJoinRoom={onJoinRoom} />);

    expect(screen.getByText('Welcome to the Lobby')).toBeInTheDocument();
    expect(screen.getByText('Hot Seat (Local)')).toBeInTheDocument();
    expect(screen.getByText('Monopoly')).toBeInTheDocument();
    expect(screen.getByText('Catan')).toBeInTheDocument();
    expect(screen.getByText('Scotland Yard')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });

  it('shows the correct player count range and re-clamps per selected game', () => {
    mockFetchResponse({});
    render(<Lobby onJoinRoom={onJoinRoom} />);

    const combo = () => screen.getByRole('combobox') as HTMLSelectElement;

    expect(Array.from(combo().options).map(o => o.value)).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(combo()).toHaveValue('2');

    fireEvent.click(screen.getByText('Catan'));
    expect(Array.from(combo().options).map(o => o.value)).toEqual(['3', '4']);
    expect(combo()).toHaveValue('3');

    fireEvent.change(combo(), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Monopoly'));
    expect(Array.from(combo().options).map(o => o.value)).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(combo()).toHaveValue('4');

    fireEvent.click(screen.getByText('Scotland Yard'));
    expect(Array.from(combo().options).map(o => o.value)).toEqual(['3', '4', '5', '6']);
    expect(combo()).toHaveValue('4');
  });

  it('creates an online game joining with only the creator seat', async () => {
    mockFetchResponse({
      roomId: 'room-online',
      playerIds: ['p1', 'p2', 'p3'],
      gameType: 'catan',
      sessionToken: 'tok-online',
    });
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.click(screen.getByText('Online'));
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-online', ['p1'], 'catan', 'tok-online'));
  });

  it('joins an existing room by id', async () => {
    mockFetchResponse({
      playerId: 'p2',
      gameType: 'monopoly',
      sessionToken: 'tok-join',
    });
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.change(screen.getByPlaceholderText('Room ID'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByText('Join'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('abc123', ['p2'], 'monopoly', 'tok-join'));
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms/abc123/join`, { method: 'POST' });
  });

  it('alerts when joining a missing or full room', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, json: async () => ({}) })
    );
    render(<Lobby onJoinRoom={onJoinRoom} />);

    fireEvent.change(screen.getByPlaceholderText('Room ID'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Join'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Room not found'));
    expect(onJoinRoom).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});