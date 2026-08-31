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
});