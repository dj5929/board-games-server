import { describe, it, expect } from 'vitest';
import { ScotlandYardEngine } from '../src/ScotlandYardEngine';
import { IRandomProvider, PlayerId, playerId } from '@packages/engine-core';

const dummyRng: IRandomProvider = { next: () => 0.5 }; // Predictable RNG

describe('Scotland Yard Engine Core', () => {
  const players: PlayerId[] = [playerId('mrX'), playerId('det1'), playerId('det2')];

  it('should initialize state correctly', () => {
    const state = ScotlandYardEngine.getInitialState(players, dummyRng);
    expect(state.playerOrder).toEqual(players);
    expect(state.activePlayerId).toBe('mrX');
    expect(state.currentTurn).toBe(1);
    expect(state.status).toBe('IN_PROGRESS');
    
    // Check ticket counts
    expect(state.players.find(p => p.id === 'mrX')!.role).toBe('MR_X');
    expect(state.players.find(p => p.id === 'mrX')!.tickets.taxi).toBe(4);
    expect(state.players.find(p => p.id === 'mrX')!.tickets.secret).toBe(2);

    expect(state.players.find(p => p.id === 'det1')!.role).toBe('DETECTIVE');
    expect(state.players.find(p => p.id === 'det1')!.tickets.taxi).toBe(10);
  });

  it('should validate and process valid moves', () => {
    const initialState = ScotlandYardEngine.getInitialState(players, dummyRng);
    
    // Force mrX position for testing
    initialState.players.find(p => p.id === 'mrX')!.position = 13;
    // Det1 position
    initialState.players.find(p => p.id === 'det1')!.position = 26;

    // Node 13 has underground to 46
    const res = ScotlandYardEngine.reduce(initialState, {
      type: 'MOVE',
      playerId: playerId('mrX'),
      payload: { targetNode: 46, ticketType: 'underground' }
    }, dummyRng);

    expect(res.success).toBe(true);
    if (!res.success) return;

    const { nextState, events } = res.data;
    
    expect(nextState.players.find(p => p.id === 'mrX')!.position).toBe(46);
    expect(nextState.players.find(p => p.id === 'mrX')!.tickets.underground).toBe(2); // 3 - 1
    expect(nextState.activePlayerId).toBe('det1');
    expect(nextState.mrXLog).toEqual(['underground']);
    
    // Check event
    expect(events.length).toBe(1);
    const moveEvent = events[0] as Extract<typeof events[0], { type: 'PLAYER_MOVED' }>;
    expect(moveEvent).toBeDefined();
    expect(moveEvent.type).toBe('PLAYER_MOVED');
    expect(moveEvent.payload.ticketType).toBe('underground');
    // It's turn 1 (not a reveal turn), so targetNode should be undefined
    expect(moveEvent.payload.targetNode).toBeUndefined();
  });
  
  it('detective should give ticket to mrX upon move', () => {
    const state = ScotlandYardEngine.getInitialState(players, dummyRng);
    state.activePlayerId = playerId('det1'); // Mock active player
    state.players.find(p => p.id === 'det1')!.position = 26;
    
    const initialDetTickets = state.players.find(p => p.id === 'det1')!.tickets.taxi;
    const initialMrXTickets = state.players.find(p => p.id === 'mrX')!.tickets.taxi;

    // Node 26 has taxi to 27
    const res = ScotlandYardEngine.reduce(state, {
       type: 'MOVE',
       playerId: playerId('det1'),
       payload: { targetNode: 27, ticketType: 'taxi' }
    }, dummyRng);

    expect(res.success).toBe(true);
    if (!res.success) return;

    const { nextState } = res.data;
    expect(nextState.players.find(p => p.id === 'det1')!.tickets.taxi).toBe(initialDetTickets - 1);
    expect(nextState.players.find(p => p.id === 'mrX')!.tickets.taxi).toBe(initialMrXTickets + 1);
  });

  it('should end game if detective catches Mr X', () => {
     const state = ScotlandYardEngine.getInitialState(players, dummyRng);
     state.activePlayerId = playerId('det1');
     state.players.find(p => p.id === 'mrX')!.position = 27;
     state.players.find(p => p.id === 'det1')!.position = 26;

     // Det1 moves to 27, where Mr. X is
     const res = ScotlandYardEngine.reduce(state, {
        type: 'MOVE',
        playerId: playerId('det1'),
        payload: { targetNode: 27, ticketType: 'taxi' }
     }, dummyRng);

     expect(res.success).toBe(true);
     if (!res.success) return;

     const { nextState, events } = res.data;
     expect(nextState.status).toBe('FINISHED');
     expect(nextState.winner).toBe('DETECTIVE');
     
     const gameOverEvent = events.find(e => e.type === 'GAME_OVER');
     expect(gameOverEvent).toBeDefined();
  });

  it('should allow Mr X to perform a DOUBLE_MOVE', () => {
     const state = ScotlandYardEngine.getInitialState(players, dummyRng);
     state.players.find(p => p.id === 'mrX')!.position = 13;
     state.players.find(p => p.id === 'mrX')!.tickets.underground = 3;
     state.players.find(p => p.id === 'mrX')!.tickets.double = 1;
     
     // 13 -> 46 (underground) -> 74 (underground)
     const res = ScotlandYardEngine.reduce(state, {
         type: 'DOUBLE_MOVE',
         playerId: playerId('mrX'),
         payload: {
             move1: { targetNode: 46, ticketType: 'underground' },
             move2: { targetNode: 74, ticketType: 'underground' }
         }
     }, dummyRng);
     
     expect(res.success).toBe(true);
     if (!res.success) return;
     
     const { nextState, events } = res.data;
     expect(nextState.players.find(p => p.id === 'mrX')!.position).toBe(74);
     expect(nextState.players.find(p => p.id === 'mrX')!.tickets.double).toBe(0);
     expect(nextState.players.find(p => p.id === 'mrX')!.tickets.underground).toBe(1); // 3 - 2
     expect(nextState.mrXLog.length).toBe(2);
     expect(nextState.mrXLog).toEqual(['underground', 'underground']);
     
     const moveEvents = events.filter(e => e.type === 'PLAYER_MOVED');
     expect(moveEvents.length).toBe(2);
     expect(nextState.activePlayerId).toBe('det1');
  });
});
