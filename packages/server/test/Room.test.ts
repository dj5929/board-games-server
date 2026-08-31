import { describe, it, expect, vi } from 'vitest';
import { Room } from '../src/Room';
import { MonopolyEngine } from '@packages/monopoly-engine';

describe('Room', () => {
  it('should initialize state correctly', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);
    const state = room.getState() as any;
    expect(state.players).toHaveLength(2);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('should broadcast state on connection', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);
    
    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    
    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(mockSend.mock.calls[0]![0]!);
    expect(payload.type).toBe('STATE_UPDATE');
    expect(payload.state.players).toHaveLength(2);
  });

  it('should dispatch action and broadcast updates', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);
    
    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    
    // reset mock to clear the initial STATE_UPDATE from connection
    mockSend.mockClear();

    // p1 rolls dice
    room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
    
    // Expect 2 broadcasts: STATE_UPDATE and EVENTS
    expect(mockSend).toHaveBeenCalledTimes(2);
    
    const stateUpdate = JSON.parse(mockSend.mock.calls[0]![0]!);
    expect(stateUpdate.type).toBe('STATE_UPDATE');
    expect(stateUpdate.state.players[0].position).toBe(8); // 4 + 4 based on 0.5 rng -> Math.floor(0.5*6)+1 = 4
    
    const eventsUpdate = JSON.parse(mockSend.mock.calls[1]![0]!);
    expect(eventsUpdate.type).toBe('EVENTS');
    expect(eventsUpdate.events[0].type).toBe('DICE_ROLLED');
  });

  it('closes the stale socket when a player reconnects (MED-6)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const staleClose = vi.fn();
    room.addConnection('p1', { send: vi.fn(), close: staleClose });

    // Reconnect the same playerId
    room.addConnection('p1', { send: vi.fn(), close: vi.fn() });

    expect(staleClose).toHaveBeenCalledTimes(1);
  });

  it('does not close a connection when adding a different player', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const p1Close = vi.fn();
    room.addConnection('p1', { send: vi.fn(), close: p1Close });
    room.addConnection('p2', { send: vi.fn(), close: vi.fn() });

    expect(p1Close).not.toHaveBeenCalled();
  });

  it('sends ACTION_REJECTED feedback on a rejected action (MED-4)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    // Clear the initial STATE_UPDATE
    mockSend.mockClear();

    // p1 cannot END_TURN before rolling
    room.dispatch({ type: 'END_TURN', playerId: 'p1' } as any);

    const rejected = mockSend.mock.calls.filter(c => JSON.parse(c[0]!).type === 'ACTION_REJECTED');
    expect(rejected).toHaveLength(1);
    expect(JSON.parse(rejected[0]![0]!).error).toBeTruthy();
  });

  it('closes all connections via closeAllConnections (MED-1)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('test-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const p1Close = vi.fn();
    const p2Close = vi.fn();
    room.addConnection('p1', { send: vi.fn(), close: p1Close });
    room.addConnection('p2', { send: vi.fn(), close: p2Close });

    (room as any).closeAllConnections();

    expect(p1Close).toHaveBeenCalledTimes(1);
    expect(p2Close).toHaveBeenCalledTimes(1);
  });
});
