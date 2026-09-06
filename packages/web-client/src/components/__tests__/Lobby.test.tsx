import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { GameType } from '@packages/engine-core';
import { Lobby } from '../Lobby';

const API_URL = 'http://localhost:3000';

describe('Lobby', () => {
  let onJoinRoom: ReturnType<typeof vi.fn<(roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void>>;
  let onSpectate: ReturnType<typeof vi.fn<(roomId: string, gameType: GameType, spectatorId: string, token: string) => void>>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onJoinRoom = vi.fn<(roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void>();
    onSpectate = vi.fn<(roomId: string, gameType: GameType, spectatorId: string, token: string) => void>();
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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-1', ['p1', 'p2'], 'monopoly', 'tok-1'));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 2, gameType: 'monopoly', hotSeat: true, bots: [], isPublic: true }),
    });
  });

  it('submits the selected game type and player count', async () => {
    mockFetchResponse({
      roomId: 'room-2',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      gameType: 'catan',
      sessionToken: 'tok-2',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.click(screen.getByText('Catan'));
    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-2', ['p1', 'p2', 'p3', 'p4'], 'catan', 'tok-2'));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 4, gameType: 'catan', hotSeat: true, bots: [], isPublic: true }),
    });
  });

  it('shows a loading state while creating and re-enables the button afterwards', async () => {
    let resolveFetch!: (r: { json: () => Promise<unknown> }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(r => { resolveFetch = r; }))
    );
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    expect(screen.getByText('Welcome to the Lobby')).toBeInTheDocument();
    expect(screen.getByText('Hot Seat (Local)')).toBeInTheDocument();
    expect(screen.getByText('Monopoly')).toBeInTheDocument();
    expect(screen.getByText('Catan')).toBeInTheDocument();
    expect(screen.getByText('Scotland Yard')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of players')).toHaveValue('2');
    expect(screen.getByLabelText('Computer players')).toHaveValue('0');
  });

  it('shows the correct player count range and re-clamps per selected game', () => {
    mockFetchResponse({});
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    const combo = () => screen.getByLabelText('Number of players') as HTMLSelectElement;

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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

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
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByPlaceholderText('Room ID'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Join'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Room not found'));
    expect(onJoinRoom).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('creates a hot-seat game with one computer player filling the last seat', async () => {
    mockFetchResponse({
      roomId: 'room-bot',
      playerIds: ['p1', 'p2', 'p3'],
      gameType: 'monopoly',
      sessionToken: 'tok-bot',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Computer players'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-bot', ['p1', 'p2', 'p3'], 'monopoly', 'tok-bot'));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 3, gameType: 'monopoly', hotSeat: true, bots: ['p3'], isPublic: true }),
    });
  });

  it('never marks the creator (first) seat as a bot', async () => {
    mockFetchResponse({
      roomId: 'room-abot',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      gameType: 'monopoly',
      sessionToken: 'tok-abot',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Computer players'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 4, gameType: 'monopoly', hotSeat: true, bots: ['p2', 'p3', 'p4'], isPublic: true }),
    });
  });

  it('fills all non-creator seats with bots in online mode', async () => {
    mockFetchResponse({
      roomId: 'room-online-bot',
      playerIds: ['p1', 'p2', 'p3'],
      gameType: 'catan',
      sessionToken: 'tok-online-bot',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.click(screen.getByText('Online'));
    fireEvent.click(screen.getByText('Catan'));
    fireEvent.change(screen.getByLabelText('Computer players'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() =>
      expect(onJoinRoom).toHaveBeenCalledWith('room-online-bot', ['p1'], 'catan', 'tok-online-bot')
    );

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 3, gameType: 'catan', hotSeat: false, bots: ['p2', 'p3'], isPublic: true }),
    });
  });

  it('re-clamps computer players when the player count shrinks below the bot count', async () => {
    mockFetchResponse({
      roomId: 'room-clamp',
      playerIds: ['p1', 'p2', 'p3'],
      gameType: 'monopoly',
      sessionToken: 'tok-clamp',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Computer players'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '3' } });

    expect(screen.getByLabelText('Computer players')).toHaveValue('2');

    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 3, gameType: 'monopoly', hotSeat: true, bots: ['p2', 'p3'], isPublic: true }),
    });
  });

  it('watches a room as a spectator without a seat', async () => {
    mockFetchResponse({
      roomId: 'room-spec',
      gameType: 'monopoly',
      spectatorId: 'spectator-1',
      token: 'tok-spec',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByPlaceholderText('Room ID to watch'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByText('Spectate'));

    await waitFor(() => expect(onSpectate).toHaveBeenCalledWith('room-spec', 'monopoly', 'spectator-1', 'tok-spec'));
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms/abc123/spectate`, { method: 'POST' });
    expect(onJoinRoom).not.toHaveBeenCalled();
  });

  it('alerts when watching a missing room', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, json: async () => ({}) })
    );
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.change(screen.getByPlaceholderText('Room ID to watch'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Spectate'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Room not found'));
    expect(onSpectate).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('creates a private room when the public toggle is unchecked (Phase 37)', async () => {
    mockFetchResponse({
      roomId: 'room-priv',
      playerIds: ['p1', 'p2'],
      gameType: 'monopoly',
      sessionToken: 'tok-priv',
    });
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    fireEvent.click(screen.getByLabelText('Public room'));
    fireEvent.click(screen.getByText('Create New Game'));

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 2, gameType: 'monopoly', hotSeat: true, bots: [], isPublic: false }),
    });
  });

  it('renders the public room browser from GET /rooms (Phase 37)', async () => {
    const rooms = [
      {
        roomId: 'room-a',
        gameType: 'monopoly',
        label: 'Monopoly',
        seats: 2,
        capacity: 8,
        connectedCount: 1,
        availableSeats: 1,
        status: 'LOBBY',
        isFull: false,
        isHotSeat: false,
        botCount: 0,
        hasBots: false,
        spectatorCount: 2,
      },
      {
        roomId: 'room-b',
        gameType: 'catan',
        label: 'Catan',
        seats: 4,
        capacity: 4,
        connectedCount: 4,
        availableSeats: 0,
        status: 'IN_PROGRESS',
        isFull: true,
        isHotSeat: true,
        botCount: 1,
        hasBots: true,
        spectatorCount: 0,
      },
    ];
    vi.stubGlobal('fetch', vi.fn(async (_url: string) => ({ json: async () => ({ rooms }) })));
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    await screen.findByText('room-a');
    expect(
      screen.getByText((content: string) => content.includes('1/2 seats taken') && content.includes('2 watching'))
    ).toBeInTheDocument();
    expect(screen.getByText('Hot Seat')).toBeInTheDocument();
    expect(screen.getByText('1 Bot')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('2 live')).toBeInTheDocument();
  });

  it('joins a room from the public browser (Phase 37)', async () => {
    const rooms = [
      {
        roomId: 'room-a',
        gameType: 'monopoly',
        label: 'Monopoly',
        seats: 2,
        capacity: 8,
        connectedCount: 1,
        availableSeats: 1,
        status: 'LOBBY',
        isFull: false,
        isHotSeat: false,
        botCount: 0,
        hasBots: false,
        spectatorCount: 0,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === `${API_URL}/rooms`) return { json: async () => ({ rooms }) };
        return { json: async () => ({ playerId: 'p2', gameType: 'monopoly', sessionToken: 'tok-dir' }) };
      })
    );
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    const joinButton = (await screen.findByText('room-a')).closest('li')!.querySelector('button')!;
    fireEvent.click(joinButton);

    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith('room-a', ['p2'], 'monopoly', 'tok-dir'));
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms/room-a/join`, { method: 'POST' });
  });

  it('watches a room from the public browser (Phase 37)', async () => {
    const rooms = [
      {
        roomId: 'room-a',
        gameType: 'monopoly',
        label: 'Monopoly',
        seats: 2,
        capacity: 8,
        connectedCount: 2,
        availableSeats: 0,
        status: 'IN_PROGRESS',
        isFull: true,
        isHotSeat: false,
        botCount: 0,
        hasBots: false,
        spectatorCount: 0,
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === `${API_URL}/rooms`) return { json: async () => ({ rooms }) };
        return { json: async () => ({ roomId: 'room-a', gameType: 'monopoly', spectatorId: 'spectator-9', token: 's-tok' }) };
      })
    );
    render(<Lobby onJoinRoom={onJoinRoom} onSpectate={onSpectate} />);

    const listItem = (await screen.findByText('room-a')).closest('li')!;
    const buttons = listItem.querySelectorAll('button');
    fireEvent.click(buttons[1]! as HTMLButtonElement); // the Watch button

    await waitFor(() => expect(onSpectate).toHaveBeenCalledWith('room-a', 'monopoly', 'spectator-9', 's-tok'));
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/rooms/room-a/spectate`, { method: 'POST' });
    expect(onJoinRoom).not.toHaveBeenCalled();
  });
});