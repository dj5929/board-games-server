import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';
import type { ScotlandYardState } from '@packages/scotland-yard-engine';
import { ScotlandYardRoom } from '../ScotlandYardRoom';

vi.mock('../../utils/SoundEngine', () => ({
  SoundEngine: {
    playTransitSound: vi.fn(),
    playSiren: vi.fn(),
    playVictorySound: vi.fn(),
  },
}));

vi.mock('../ScotlandYardBoard', () => ({
  ScotlandYardBoard: () => <div>SY-BOARD</div>,
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

function initialState(): ScotlandYardState {
  return ScotlandYardEngine.getInitialState(['p1', 'p2', 'p3'] as never, { next: () => 0.5 });
}

describe('ScotlandYardRoom (Phase 41 rematch)', () => {
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

  function renderRoom(extra: Partial<Parameters<typeof ScotlandYardRoom>[0]> = {}) {
    render(<ScotlandYardRoom roomId="room-1" localPlayerIds={['p1']} sessionToken="tok" onLeave={onLeave} {...extra} />);
    return instances[instances.length - 1]!;
  }

  it('sends RESTART_GAME when Play Again is clicked on the game-over screen', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText('Turn 1');
    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [{ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'The detectives caught Mr. X on turn 20!' } }],
      })
    );

    expect(await screen.findByText('Detectives Win!')).toBeInTheDocument();
    expect(screen.getByText('Game Over')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(ws.sent).toContain(JSON.stringify({ type: 'RESTART_GAME', playerId: 'p1' }));
  });

  it('dismisses the local game-over overlay when the server rebroadcasts GAME_RESTARTED', async () => {
    const ws = renderRoom();
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText('Turn 1');

    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [{ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'The detectives caught Mr. X!' } }],
      })
    );
    expect(await screen.findByText('Detectives Win!')).toBeInTheDocument();

    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [{ type: 'GAME_RESTARTED' }],
      })
    );

    expect(screen.queryByText('Game Over')).not.toBeInTheDocument();
    expect(screen.queryByText('Detectives Win!')).not.toBeInTheDocument();
  });

  it('hides the Play Again button for spectators', async () => {
    const ws = renderRoom({ spectatorId: 'spectator-abc123' });
    act(() => ws.simulateMessage({ type: 'STATE_UPDATE', state: initialState() }));
    await screen.findByText('Turn 1');
    act(() =>
      ws.simulateMessage({
        type: 'EVENTS',
        events: [{ type: 'GAME_OVER', payload: { winner: 'MR_X', reason: 'Mr. X escaped!' } }],
      })
    );

    await screen.findByText('Mr. X Wins!');
    expect(screen.queryByRole('button', { name: 'Play Again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Lobby' })).toBeInTheDocument();
  });
});