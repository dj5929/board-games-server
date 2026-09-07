import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CatanEngine } from '@packages/catan-engine';
import type { ICatanState } from '@packages/catan-engine';
import { CatanRoom } from '../CatanRoom';

vi.mock('../../utils/SoundEngine', () => ({
  SoundEngine: {
    playDiceRoll: vi.fn(),
    playVictorySound: vi.fn(),
    playCatanBuild: vi.fn(),
  },
}));

vi.mock('../CatanBoard', () => ({
  CatanBoard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../CatanTradeManager', () => ({
  CatanTradeManager: () => <div>TRADE-MANAGER</div>,
}));

vi.mock('../CatanDiscardModal', () => ({
  CatanDiscardModal: () => <div>DISCARD-MODAL</div>,
}));

vi.mock('../CatanRobberVictimModal', () => ({
  CatanRobberVictimModal: () => <div>ROBBER-MODAL</div>,
}));

vi.mock('../CatanDevCardManager', () => ({
  CatanDevCardManager: () => <div>DEV-CARDS</div>,
}));

vi.mock('../Dice3D', () => ({
  Dice3D: () => <div>DICE-3D</div>,
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

function initialState(): ICatanState {
  return CatanEngine.getInitialState(['p1', 'p2', 'p3'] as never, { next: () => 0.5 });
}

function winnerState(): ICatanState {
  return { ...initialState(), winner: 'p1' as never };
}

describe('CatanRoom (Phase 41 rematch)', () => {
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

  function renderRoom(extra: Partial<Parameters<typeof CatanRoom>[0]> = {}) {
    render(<CatanRoom roomId="room-1" localPlayerIds={['p1']} sessionToken="tok" onLeave={onLeave} {...extra} />);
    return instances[instances.length - 1]!;
  }

  it('sends RESTART_GAME when Play Again is clicked on the victory screen', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: winnerState() }));

    const victory = await screen.findByText(/has won the game with 10 Victory Points/);
    expect(victory).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(ws.sent).toContain(JSON.stringify({ type: 'RESTART_GAME', playerId: 'p1' }));
  });

  it('clears the event log and transient state when the server rebroadcasts GAME_RESTARTED', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText(/p1's Turn/);

    act(() =>
      ws.simulateMessage({ type: 'EVENTS', events: [{ type: 'SETTLEMENT_BUILT', playerId: 'p1' }] })
    );
    expect(await screen.findByText('Settlement built by p1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Event Log'));
    expect(screen.getAllByText(/Settlement built by p1/).length).toBeGreaterThanOrEqual(2);

    // A rematch wipes the log; a follow-up event (p2 settlement) starts it fresh.
    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [
          { type: 'GAME_RESTARTED' },
          { type: 'SETTLEMENT_BUILT', playerId: 'p2' },
        ],
      })
    );

    // The restart wipes the old log entry; the follow-up event restarts it.
    // The rematch note surfaces in both the toast and the (fresh) event log.
    // The old p1 toast lingers (4s auto-dismiss), but its log entry is gone.
    expect((await screen.findAllByText('Settlement built by p2')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Settlement built by p1/)).toHaveLength(1);
    expect(screen.getAllByText('Rematch started! Board reset.').length).toBeGreaterThanOrEqual(1);
  });

  it('hides the Play Again button for spectators', async () => {
    const ws = renderRoom({ spectatorId: 'spectator-abc123' });
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: winnerState() }));

    await screen.findByText(/has won the game with 10 Victory Points/);
    expect(screen.queryByRole('button', { name: 'Play Again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Lobby' })).toBeInTheDocument();
  });
});