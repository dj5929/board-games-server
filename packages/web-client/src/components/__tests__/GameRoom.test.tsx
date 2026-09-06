import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MonopolyEngine } from '@packages/monopoly-engine';
import type { IMonopolyState } from '@packages/monopoly-engine';
import { GameRoom } from '../GameRoom';

vi.mock('../../utils/SoundEngine', () => ({
  SoundEngine: {
    playCashRegister: vi.fn(),
    playJailBars: vi.fn(),
    playDiceRoll: vi.fn(),
    playTurnChime: vi.fn(),
  },
}));

vi.mock('../MonopolyBoard', () => ({
  MonopolyBoard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../PropertyManager', () => ({
  PropertyManager: () => <div>PROPERTY-MANAGER</div>,
}));

vi.mock('../TradeManager', () => ({
  TradeManager: () => <div>TRADE-MANAGER</div>,
}));

vi.mock('../TradeNotification', () => ({
  TradeNotification: () => <div>TRADE-NOTIFICATION</div>,
}));

vi.mock('../Dice3D', () => ({
  Dice3D: () => <div>DICE-3D</div>,
}));

vi.mock('../RulebookModal', () => ({
  RulebookModal: () => <div>RULEBOOK</div>,
}));

class MockWebSocket {
  static OPEN = 1;
  readyState = 1;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: {}) => void) | null = null;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({});
  }

  simulateMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const instances: MockWebSocket[] = [];

function initialState(): IMonopolyState {
  return MonopolyEngine.getInitialState(['p1', 'p2'] as never, { next: () => 0.5 });
}

describe('GameRoom', () => {
  let onLeave: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    instances.length = 0;
    vi.stubGlobal('WebSocket', class extends MockWebSocket {});
    onLeave = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderRoom() {
    render(<GameRoom roomId="room-1" localPlayerIds={['p1']} sessionToken="tok" onLeave={onLeave} />);
    return instances[instances.length - 1]!;
  }

  it('shows a connecting state, then the game board once state arrives', async () => {
    const ws = renderRoom();
    expect(screen.getByText('Connecting to room...')).toBeInTheDocument();

    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));

    await screen.findByText(/p1's Turn/);
    expect(screen.getByText('$1500')).toBeInTheDocument();
    expect(screen.getByText('Roll Dice')).toBeInTheDocument();
    expect(screen.getByText('End Turn')).toBeInTheDocument();
    expect(screen.getByText('Propose Trade')).toBeInTheDocument();
    expect(screen.getByText(/You are playing as/)).toBeInTheDocument();

    // Own-turn actions are dispatched through the socket
    fireEvent.click(screen.getByText('Roll Dice'));
    expect(ws.sent).toContain(JSON.stringify({ type: 'ROLL_DICE', playerId: 'p1' }));
  });

  it('processes EVENTS into toasts, the event log and the drawn-card modal', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [
          { type: 'RENT_PAID', fromPlayerId: 'p2', toPlayerId: 'p1', amount: 24 },
          { type: 'CARD_DRAWN', playerId: 'p1', deck: 'CHANCE', text: 'Advance to GO' },
        ],
      })
    );

    expect(await screen.findByText(/p2 paid \$24 rent to p1/)).toBeInTheDocument();
    expect(screen.getByText('Advance to GO')).toBeInTheDocument();

    fireEvent.click(screen.getByText('OK'));
    expect(screen.queryByText('Advance to GO')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Event Log'));
    await waitFor(() => {
      expect(screen.getAllByText(/p2 paid \$24 rent to p1/).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows the dice overlay on a DICE_ROLLED event', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [{ type: 'DICE_ROLLED', playerId: 'p1', dice1: 3, dice2: 4, position: 7 }],
      })
    );

    expect(await screen.findByText(/p1 rolled a 7 and landed on/)).toBeInTheDocument();
  });

  it('renders chat messages received from the server (Phase 38)', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    fireEvent.click(screen.getByText('Chat'));
    expect(screen.getByText('Room Chat')).toBeInTheDocument();
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();

    act(() =>
      ws.simulateMessage({
        type: 'CHAT_MESSAGE',
        message: { id: 'c1', roomId: 'room-1', senderId: 'p2', senderRole: 'player', text: 'hello p1!', sentAt: Date.now() },
      })
    );

    expect(await screen.findByText('hello p1!')).toBeInTheDocument();
    expect(screen.getByText('p2:')).toBeInTheDocument();

    // Our own line is labeled "You", a spectator line is labeled "Spectator …".
    act(() =>
      ws.simulateMessage({
        type: 'CHAT_MESSAGE',
        message: { id: 'c2', roomId: 'room-1', senderId: 'p1', senderRole: 'player', text: 'my own line', sentAt: Date.now() },
      })
    );
    expect(await screen.findByText('my own line')).toBeInTheDocument();
    expect(screen.getByText('You:')).toBeInTheDocument();

    act(() =>
      ws.simulateMessage({
        type: 'CHAT_MESSAGE',
        message: { id: 'c3', roomId: 'room-1', senderId: 'spectator-abc123', senderRole: 'spectator', text: 'still watching', sentAt: Date.now() },
      })
    );
    expect(await screen.findByText('still watching')).toBeInTheDocument();
    expect(screen.getByText('Spectator abc123:')).toBeInTheDocument();
  });

  it('renders the caught-up chat history and keeps live lines flowing (Phase 39)', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);
    fireEvent.click(screen.getByText('Chat'));

    // History sent at connect time replaces the (empty) list, oldest first.
    act(() =>
      ws.simulateMessage({
        type: 'CHAT_HISTORY',
        messages: [
          { id: 'h1', roomId: 'room-1', senderId: 'p2', senderRole: 'player', text: 'before you joined', sentAt: Date.now() },
          { id: 'h2', roomId: 'room-1', senderId: 'spectator-abc123', senderRole: 'spectator', text: 'i was watching', sentAt: Date.now() },
        ],
      })
    );
    expect(await screen.findByText('before you joined')).toBeInTheDocument();
    expect(screen.getByText('i was watching')).toBeInTheDocument();

    // A fresh history replaces rather than appends (reconnect catch-up).
    act(() =>
      ws.simulateMessage({ type: 'CHAT_HISTORY', messages: [{ id: 'h3', roomId: 'room-1', senderId: 'p1', senderRole: 'player', text: 'reconnected me', sentAt: Date.now() }] })
    );
    expect(await screen.findByText('reconnected me')).toBeInTheDocument();
    expect(screen.queryByText('before you joined')).not.toBeInTheDocument();

    // Live lines still append after the catch-up.
    act(() =>
      ws.simulateMessage({ type: 'CHAT_MESSAGE', message: { id: 'c1', roomId: 'room-1', senderId: 'p2', senderRole: 'player', text: 'right back', sentAt: Date.now() } })
    );
    expect(await screen.findByText('right back')).toBeInTheDocument();
  });

  it('sends a chat line over the socket and clears the input (Phase 38)', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    fireEvent.click(screen.getByText('Chat'));
    const input = screen.getByLabelText('Chat message');
    fireEvent.change(input, { target: { value: 'glhf' } });
    fireEvent.submit(input.closest('form')!);

    expect(ws.sent).toContain(JSON.stringify({ type: 'CHAT', text: 'glhf' }));
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('surfaces ERROR messages and returns to the lobby', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() => ws.simulateMessage({ type: 'ERROR', error: 'Invalid payload' }));

    expect(await screen.findByText('Invalid payload')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Return to Lobby'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('reports when the server connection is lost', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() => ws.onclose?.({}));
    expect(await screen.findByText('Connection closed')).toBeInTheDocument();
  });

  it('shows a live spectator count from STATE_UPDATE and hides it at zero', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() =>
      ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState(), spectatorCount: 1 })
    );
    expect(await screen.findByText('1 spectator watching')).toBeInTheDocument();

    act(() =>
      ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState(), spectatorCount: 3 })
    );
    expect(await screen.findByText('3 spectators watching')).toBeInTheDocument();

    // A server that predates spectatorCount omits the field -> treated as 0.
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await waitFor(() =>
      expect(screen.queryByText(/spectators? watching/)).not.toBeInTheDocument()
    );
  });

  it('renders the room-code invite chip when the server provides one (Phase 40)', async () => {
    render(<GameRoom roomId="room-1" localPlayerIds={['p1']} sessionToken="tok" roomCode="M4KQ2V" onLeave={onLeave} />);
    const ws = instances[instances.length - 1]!;
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    expect(
      screen.getByRole('button', { name: 'Copy room invite link for code M4KQ2V' })
    ).toBeInTheDocument();
  });
});