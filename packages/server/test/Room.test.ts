import { describe, it, expect, vi } from 'vitest';
import { Room } from '../src/Room';
import { MonopolyEngine } from '@packages/monopoly-engine';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';
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

  it('carries hot-seat flags and validates seat membership (hot-seat regression)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('hot-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2'], undefined, {
      isHotSeat: true,
      ownerPlayerId: 'p1'
    });

    expect(room.isHotSeat).toBe(true);
    expect(room.ownerPlayerId).toBe('p1');
    expect(room.hasPlayer('p1')).toBe(true);
    expect(room.hasPlayer('p2')).toBe(true);
    expect(room.hasPlayer('intruder')).toBe(false);
  });

  it('subscribes to the pubsub channel on the first connection and unsubscribes on the last (cross-instance)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('ps-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const subscribe = vi.fn();
    const unsubscribe = vi.fn();
    (room as any).setPubSub({ subscribe, unsubscribe, publish: vi.fn() });

    expect(subscribe).not.toHaveBeenCalled();

    room.addConnection('p1', { send: vi.fn() });
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0]![0]).toBe('ps-room');

    // Second connection does not re-subscribe
    room.addConnection('p2', { send: vi.fn() });
    expect(subscribe).toHaveBeenCalledTimes(1);

    // Removing one player keeps subscription; removing the last unsubscribes
    room.removeConnection('p1');
    expect(unsubscribe).not.toHaveBeenCalled();
    room.removeConnection('p2');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe.mock.calls[0]![0]).toBe('ps-room');
  });

  it('delivers a remote pubsub message to local connections with per-player projection', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('remote-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    mockSend.mockClear();

    // Simulate a message published by a remote instance after a reduce().
    (room as any).deliverRemoteMessage({
      state: room.getState(),
      events: [{ type: 'DICE_ROLLED', playerId: 'p1' }]
    });

    expect(mockSend).toHaveBeenCalledTimes(2); // STATE_UPDATE + EVENTS
    const stateUpdate = JSON.parse(mockSend.mock.calls[0]![0]!);
    expect(stateUpdate.type).toBe('STATE_UPDATE');
    const eventsUpdate = JSON.parse(mockSend.mock.calls[1]![0]!);
    expect(eventsUpdate.type).toBe('EVENTS');
    expect(eventsUpdate.events[0].type).toBe('DICE_ROLLED');
  });

  it('publishes to the pubsub channel on broadcast during dispatch', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('pub-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const publish = vi.fn();
    (room as any).setPubSub({ publish, subscribe: vi.fn(), unsubscribe: vi.fn() });

    room.addConnection('p1', { send: vi.fn() });
    publish.mockClear();

    room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);

    expect(publish).toHaveBeenCalled();
    const published = publish.mock.calls[0]![1];
    expect(published.state).toBeDefined();
    // broadcastState publishes {state}; broadcastEvents publishes {state, events}
    const publishedWithEvents = publish.mock.calls.find(c => (c[1] as any).events);
    expect(publishedWithEvents).toBeDefined();
  });

  it('includes timer metadata (turnStartedAt/turnTimeLimitMs) in STATE_UPDATE', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('timer-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2'], undefined, {
      turnTimeLimitMs: 120000
    });

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });

    const payload = JSON.parse(mockSend.mock.calls[0]![0]!);
    expect(payload.type).toBe('STATE_UPDATE');
    expect(payload.timer.turnTimeLimitMs).toBe(120000);
    expect(typeof payload.timer.turnStartedAt).toBe('number');
  });

  it('resets turnStartedAt after a successful dispatch', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('timer-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2'], undefined, {
      turnTimeLimitMs: 120000
    });

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    const initialStart = room.turnStartedAt;

    vi.useFakeTimers();
    try {
      vi.setSystemTime(initialStart + 5000);
      room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
      expect(room.turnStartedAt).toBe(initialStart + 5000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('auto-forfeits the turn when it exceeds the time limit (FORCE_END_TURN)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('timer-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2'], undefined, {
      turnTimeLimitMs: 10000
    });

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });
    mockSend.mockClear();

    vi.useFakeTimers();
    try {
      // A real first roll moves the game from LOBBY to IN_PROGRESS (regression:
      // LOW-9 left Monopoly in LOBBY forever, silently disabling the AFK timer).
      room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
      expect((room.getState() as any).status).toBe('IN_PROGRESS');

      vi.setSystemTime(room.turnStartedAt + 11000);
      (room as any).checkTurnTimeout();

      // The forced turn should advance to p2
      expect((room.getState() as any).currentPlayerIndex).toBe(1);

      // The timeout should have produced a broadcast with the TURN_TIMED_OUT event
      const updates = mockSend.mock.calls.map(c => JSON.parse(c[0]!));
      const events = updates.filter(u => u.type === 'EVENTS');
      const timedOut = events.flatMap(e => e.events).find((ev: any) => ev.type === 'TURN_TIMED_OUT');
      expect(timedOut).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not force a turn when turnTimeLimitMs is 0 (disabled)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('timer-room', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const mockSend = vi.fn();
    room.addConnection('p1', { send: mockSend });

    vi.useFakeTimers();
    try {
      room.dispatch({ type: 'ROLL_DICE', playerId: 'p1' } as any);
      expect((room.getState() as any).status).toBe('IN_PROGRESS');
      vi.setSystemTime(room.turnStartedAt + 60000);
      (room as any).checkTurnTimeout();
      expect((room.getState() as any).currentPlayerIndex).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks bot seats via options and exposes isBot (Phase 35)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('bot-room-1', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2', 'p3'], undefined, {
      botSeats: ['p2']
    });

    expect(room.isBot('p2')).toBe(true);
    expect(room.isBot('p1')).toBe(false);
    expect(room.isBot('p3')).toBe(false);
  });

  it('excludes bot seats from available seats (Phase 35)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('bot-room-2', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2', 'p3'], undefined, {
      botSeats: ['p2']
    });

    // Real server flow: the creator claims p1 with a session token.
    room.issueSessionToken('p1');

    // p2 is a bot seat and must never be handed to a joining human.
    expect(room.getAvailablePlayerId()).toBe('p3');
  });

  it('restores bot seats from a persisted snapshot (Phase 35)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('bot-persist', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2', 'p3'], undefined, {
      botSeats: ['p2']
    });

    const restored = new Room('bot-persist', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2', 'p3'], undefined, {
      botSeats: []
    });
    (restored as any).loadState({
      state: room.getState(),
      sessionTokens: [],
      tokenIssuedAt: [],
      disconnectedAt: [],
      lastActivity: Date.now(),
      turnStartedAt: Date.now(),
      isHotSeat: false,
      ownerPlayerId: null,
      botSeats: Array.from(room.botSeats)
    });

    expect(restored.isBot('p2')).toBe(true);
    expect(restored.isBot('p1')).toBe(false);
  });

  it('issues one-time spectator tokens and verifies them (Phase 36)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-token', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const creds = room.issueSpectatorToken();
    expect(creds.spectatorId).toMatch(/^spectator-/);
    expect(creds.token).toBeTruthy();
    expect(room.verifySpectatorToken(creds.spectatorId, creds.token)).toBe(true);
    expect(room.verifySpectatorToken(creds.spectatorId, 'wrong')).toBe(false);
    expect(room.verifySpectatorToken('spectator-ghost', creds.token)).toBe(false);
  });

  it('streams the fully-hidden projection to a spectator while players get their own (Phase 36)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-proj', 'scotland-yard', ScotlandYardEngine as any, rng, ['p1', 'p2', 'p3']);

    const rawMrX = (room.getState() as any).players.find((p: any) => p.role === 'MR_X');
    expect(rawMrX.position).not.toBe(0);

    const playerSend = vi.fn();
    const spectatorSend = vi.fn();
    // p1 is Mr. X: he sees his real position.
    room.addConnection('p1', { send: playerSend });
    // A spectator must never see the real position.
    room.addSpectatorConnection('spectator-1', { send: spectatorSend });

    const playerPayload = JSON.parse(playerSend.mock.calls[0]![0]!);
    expect(playerPayload.type).toBe('STATE_UPDATE');
    expect(playerPayload.state.players.find((p: any) => p.id === 'p1').position).toBe(rawMrX.position);

    const spectatorPayload = JSON.parse(spectatorSend.mock.calls[0]![0]!);
    expect(spectatorPayload.type).toBe('STATE_UPDATE');
    const projectedMrX = spectatorPayload.state.players.find((p: any) => p.role === 'MR_X');
    expect(projectedMrX.position).toBe(0);
  });

  it('never hands a spectator a seat and keeps the room full', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-seat', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);
    room.issueSessionToken('p1');

    room.addSpectatorConnection('spectator-1', { send: vi.fn() });
    expect(room.getAvailablePlayerId()).toBe('p2');
    expect(room.hasPlayer('spectator-1')).toBe(false);
  });

  it('keeps the pubsub subscription alive while a spectator remains after the last player leaves (Phase 36)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-ps', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const subscribe = vi.fn();
    const unsubscribe = vi.fn();
    (room as any).setPubSub({ subscribe, unsubscribe, publish: vi.fn() });

    room.addSpectatorConnection('spectator-1', { send: vi.fn() });
    expect(subscribe).toHaveBeenCalledTimes(1);

    room.addConnection('p1', { send: vi.fn() });
    room.removeConnection('p1');
    // A spectator is still connected, so the remote stream must keep flowing.
    expect(unsubscribe).not.toHaveBeenCalled();

    room.removeSpectatorConnection('spectator-1');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe.mock.calls[0]![0]).toBe('spec-ps');
  });

  it('includes and live-updates the spectator count in STATE_UPDATE (Phase 36)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-count', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const playerSend = vi.fn();
    const spectatorSend = vi.fn();
    room.addConnection('p1', { send: playerSend });

    const initial = JSON.parse(playerSend.mock.calls[0]![0]!);
    expect(initial.spectatorCount).toBe(0);

    playerSend.mockClear();
    room.addSpectatorConnection('spectator-1', { send: spectatorSend });
    // Joining bumps the count for existing players and the newcomer alike.
    const p1Join = JSON.parse(playerSend.mock.calls[0]![0]!);
    expect(p1Join.spectatorCount).toBe(1);
    const specJoin = JSON.parse(spectatorSend.mock.calls[0]![0]!);
    expect(specJoin.spectatorCount).toBe(1);

    playerSend.mockClear();
    room.removeSpectatorConnection('spectator-1');
    // Leaving rebroadcasts so the count falls back to 0 for remaining players.
    const p1Leave = JSON.parse(playerSend.mock.calls[0]![0]!);
    expect(p1Leave.spectatorCount).toBe(0);
  });

  it('closes spectator connections via closeAllConnections (Phase 36)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('spec-close', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2']);

    const playerClose = vi.fn();
    const spectatorClose = vi.fn();
    room.addConnection('p1', { send: vi.fn(), close: playerClose });
    room.addSpectatorConnection('spectator-1', { send: vi.fn(), close: spectatorClose });

    (room as any).closeAllConnections();

    expect(playerClose).toHaveBeenCalledTimes(1);
    expect(spectatorClose).toHaveBeenCalledTimes(1);
  });

  it('exposes the room-browser helpers: public flag and live occupancy (Phase 37)', () => {
    const rng = { next: () => 0.5 };
    const room = new Room('dir', 'monopoly', MonopolyEngine as any, rng, ['p1', 'p2'], undefined, {
      isPublic: true,
      botSeats: ['p2']
    });

    // p2 is a bot seat, so only p1 is claimable while the room is untouched.
    expect(room.isPublic).toBe(true);
    expect(room.openSeatCount()).toBe(1);

    room.addConnection('p1', { send: vi.fn() });
    expect(room.playerConnectionCount()).toBe(1);
    expect(room.spectatorConnectionCount()).toBe(0);
    expect(room.openSeatCount()).toBe(0);

    room.addSpectatorConnection('spectator-1', { send: vi.fn() });
    // Spectators never narrow the seat count.
    expect(room.spectatorConnectionCount()).toBe(1);
    expect(room.playerConnectionCount()).toBe(1);
    expect(room.openSeatCount()).toBe(0);
  });
});
