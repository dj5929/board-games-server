import { describe, expect, it } from 'vitest';
import { playerId } from '@packages/engine-core';
import type { ScotlandYardState, TransportType } from '@packages/scotland-yard-engine';
import { ScotlandYardEngine } from '@packages/scotland-yard-engine';
import { ScotlandYardBot } from '../src/ScotlandYardBot';

const bot = new ScotlandYardBot();

function makeRng() {
  let i = 0;
  return { next: () => [0.1, 0.4][i++ % 2]! };
}

interface PlayerPatch {
  position?: number;
  tickets?: Partial<ScotlandYardState['players'][number]['tickets']>;
}

function makeState(mrXPatch: PlayerPatch, detectivePatches: PlayerPatch[], log?: TransportType[]): ScotlandYardState {
  const base = ScotlandYardEngine.getInitialState(
    [playerId('p1'), playerId('p2'), playerId('p3')],
    makeRng()
  );
  const players = base.players.map((p, i) => {
    if (i === 0) {
      return { ...p, ...mrXPatch, tickets: { ...p.tickets, ...mrXPatch.tickets } };
    }
    const patch = detectivePatches[i - 1] ?? {};
    return { ...p, ...patch, tickets: { ...p.tickets, ...patch.tickets } };
  });
  return { ...base, players, mrXLog: log ?? base.mrXLog };
}

/** Decide for a given seat; returns the raw action for assertion. */
function decideFor(state: ScotlandYardState, seat: string): ReturnType<ScotlandYardBot['decide']> {
  return bot.decide(state, seat, ScotlandYardEngine as any);
}

describe('ScotlandYardBot', () => {
  it('Mr X flees the nearest detective, preferring reserve underground tickets', () => {
    // Mr X at 13; a detective lurks at 23 (adjacent). Best escape: underground
    // to 46 (2 hops away with a secret-worthy ticket) over equal-distance taxis.
    // No double/secret tokens, so the pure underground preference is asserted.
    const state = makeState(
      { position: 13, tickets: { taxi: 4, bus: 3, underground: 3, secret: 0, double: 0 } },
      [{ position: 23 }, { position: 50 }]
    );
    expect(decideFor(state, 'p1')).toEqual({
      type: 'MOVE',
      playerId: playerId('p1'),
      payload: { targetNode: 46, ticketType: 'underground' },
    });
  });

  it('Mr X uses a double move when it creates real separation', () => {
    // Mr X at 1; detective at 8 (adjacent). A single underground hop reaches
    // 46 (2 hops away), but a double underground hop lands on 13 (3 hops away).
    const state = makeState(
      { position: 1, tickets: { taxi: 4, bus: 3, underground: 3, secret: 2, double: 2 } },
      [{ position: 8 }, { position: 50 }]
    );
    expect(decideFor(state, 'p1')).toEqual({
      type: 'DOUBLE_MOVE',
      playerId: playerId('p1'),
      payload: {
        move1: { targetNode: 46, ticketType: 'underground' },
        move2: { targetNode: 13, ticketType: 'underground' },
      },
    });
  });

  it('never uses a double move on a turn that would reveal its location', () => {
    // mrXLog length 2 → the next move lands on reveal turn 3.
    const state = makeState(
      { position: 1, tickets: { taxi: 4, bus: 3, underground: 3, secret: 2, double: 2 } },
      [{ position: 8 }, { position: 50 }],
      ['taxi', 'bus']
    );
    const action = decideFor(state, 'p1');
    expect(action.type).toBe('MOVE');
  });

  it('a detective chases a revealed Mr X along a shortest path', () => {
    // Mr X revealed at 13 (turn 3). Detective at 12 steps to 23 (taxi), which
    // is 1 hop from the target.
    const state = makeState({ position: 13 }, [{ position: 12 }, { position: 50 }], ['taxi', 'bus', 'taxi']);
    expect(decideFor(state, 'p2')).toEqual({
      type: 'MOVE',
      playerId: playerId('p2'),
      payload: { targetNode: 23, ticketType: 'taxi' },
    });
  });

  it('a detective never steps onto another detective', () => {
    // 23 is occupied by detective p3; p2 at 12 must detour to node 3 instead.
    const state = makeState({ position: 13 }, [{ position: 12 }, { position: 23 }], ['taxi', 'bus', 'taxi']);
    expect(decideFor(state, 'p2')).toEqual({
      type: 'MOVE',
      playerId: playerId('p2'),
      payload: { targetNode: 3, ticketType: 'taxi' },
    });
  });

  it('a detective chases the deduced region when Mr X is hidden', () => {
    // Mr X took one underground step (hidden, position scrubbed to 0): he must
    // be on a node with an underground edge. Detective at 33 moves straight
    // onto the reachable 46, which is exactly where he could be.
    const state = makeState({ position: 0 }, [{ position: 33 }, { position: 50 }], ['underground']);
    // getStateForPlayer scrubs the hidden position like the server would.
    const scrub = (ScotlandYardEngine as any).getStateForPlayer as (s: ScotlandYardState, id: string) => ScotlandYardState;
    const scrubbed = scrub(state, playerId('p2'));
    expect(scrubbed.players.find(p => p.role === 'MR_X')!.position).toBe(0);
    expect(decideFor(scrubbed, 'p2')).toEqual({
      type: 'MOVE',
      playerId: playerId('p2'),
      payload: { targetNode: 46, ticketType: 'taxi' },
    });
  });

  it('skips the turn when a detective has no tickets left', () => {
    const state = makeState({ position: 13 }, [{ position: 12 }, { position: 23 }], ['taxi', 'bus', 'taxi']);
    const broke: ScotlandYardState = {
      ...state,
      players: state.players.map(p =>
        p.id === playerId('p2')
          ? { ...p, tickets: { taxi: 0, bus: 0, underground: 0, secret: 0, double: 0 } }
          : p
      ),
    };
    expect(decideFor(broke, 'p2')).toEqual({ type: 'SKIP_TURN', playerId: playerId('p2') });
  });
});