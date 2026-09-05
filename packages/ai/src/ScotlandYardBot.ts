import { IGameEngine, playerId } from '@packages/engine-core';
import { scotlandYardGraph } from '@packages/scotland-yard-engine';
import type { ScotlandYardAction, ScotlandYardEvent, ScotlandYardPlayer, ScotlandYardState, TransportType } from '@packages/scotland-yard-engine';
import type { IBotStrategy } from './IBotStrategy';

type ScotlandYardEngine = IGameEngine<ScotlandYardState, ScotlandYardAction, ScotlandYardEvent>;

const TICKET_ORDER: readonly TransportType[] = ['taxi', 'bus', 'underground', 'secret'];
/** Higher = more valuable / reserved (Mr. X) or more expensive (detectives). */
const TICKET_RANK: Record<TransportType, number> = { taxi: 0, bus: 1, underground: 2, secret: 2 };
/** Mr. X only uses a double move when it beats the single by this much. */
const DOUBLE_MOVE_GAIN = 0.8;

interface Move { target: number; transport: TransportType; }
interface ScoredMove extends Move { score: number; }

function neighbors(node: number, transport: TransportType): number[] {
  const n = scotlandYardGraph[node];
  if (!n) return [];
  if (transport === 'secret') return [...n.taxi, ...n.bus, ...n.underground, ...n.secret];
  return n[transport];
}

/** Hop distances (any transport) from every node to the nearest source node. */
function distanceToSetMap(sources: Iterable<number>): ReadonlyMap<number, number> {
  const dist = new Map<number, number>();
  const queue: number[] = [];
  for (const s of sources) {
    if (!dist.has(s)) {
      dist.set(s, 0);
      queue.push(s);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    const d = dist.get(cur)!;
    for (const t of TICKET_ORDER) {
      for (const dest of neighbors(cur, t)) {
        if (!dist.has(dest)) {
          dist.set(dest, d + 1);
          queue.push(dest);
        }
      }
    }
  }
  return dist;
}

/**
 * Mr. X: legally flee the detectives (maximize the hop distance to the nearest
 * detective; prefer expensive reserve tickets; use double moves when they buy
 * real separation). Detectives: chase the deduced / revealed position along a
 * shortest path, reserving nice tickets and never blocking another detective.
 */
export class ScotlandYardBot implements IBotStrategy<ScotlandYardState, ScotlandYardAction> {
  decide(state: ScotlandYardState, actingPlayerId: string, engine: ScotlandYardEngine): ScotlandYardAction {
    const pid = playerId(actingPlayerId);
    const player = state.players.find(p => p.id === pid);
    if (!player) {
      return { type: 'SKIP_TURN', playerId: pid };
    }
    return player.role === 'MR_X' ? this.decideMrX(state, player) : this.decideDetective(state, player, engine);
  }

  private decideMrX(state: ScotlandYardState, player: ScotlandYardPlayer): ScotlandYardAction {
    const double = this.bestEnabledMrXDouble(state, player);
    if (double) {
      return {
        type: 'DOUBLE_MOVE',
        playerId: player.id,
        payload: {
          move1: { targetNode: double.move1.target, ticketType: double.move1.transport },
          move2: { targetNode: double.move2.target, ticketType: double.move2.transport },
        },
      };
    }
    const move = this.bestMrXMove(state, player);
    if (move) {
      return { type: 'MOVE', playerId: player.id, payload: { targetNode: move.target, ticketType: move.transport } };
    }
    return { type: 'SKIP_TURN', playerId: player.id };
  }

  private decideDetective(state: ScotlandYardState, player: ScotlandYardPlayer, engine: ScotlandYardEngine): ScotlandYardAction {
    const occupantNodes = new Set(
      state.players.filter(p => p.role === 'DETECTIVE' && p.id !== player.id).map(p => p.position)
    );

    const candidates: Move[] = [];
    for (const t of ['taxi', 'bus', 'underground'] as const) {
      if ((player.tickets[t] ?? 0) <= 0) continue;
      for (const target of neighbors(player.position, t)) {
        if (occupantNodes.has(target)) continue;
        candidates.push({ target, transport: t });
      }
    }
    if (candidates.length === 0) {
      return { type: 'SKIP_TURN', playerId: player.id };
    }

    // Prefer chasin known positions along shortest paths, reserving flight tickets.
    const targetMap = this.chaseTargetMap(state, player, engine);
    const scored = candidates
      .map(c => ({ ...c, score: (targetMap.get(c.target) ?? Infinity) }))
      .sort((a, b) => a.score - b.score || TICKET_RANK[a.transport] - TICKET_RANK[b.transport] || a.target - b.target);
    const best = scored[0]!;
    return { type: 'MOVE', playerId: player.id, payload: { targetNode: best.target, ticketType: best.transport } };
  }

  /** Distance map used to score a detective's candidate nodes (lower = better). */
  private chaseTargetMap(state: ScotlandYardState, player: ScotlandYardPlayer, engine: ScotlandYardEngine): ReadonlyMap<number, number> {
    const scrub = engine.getStateForPlayer?.(state, player.id) ?? state;
    const mrX = scrub.players.find(p => p.role === 'MR_X');
    const known = mrX && mrX.position >= 1 ? mrX.position : -1;
    if (known >= 1) {
      return distanceToSetMap([known]);
    }
    // Hidden: chase the set of nodes Mr. X could currently occupy given his log.
    let possible = new Set(Object.keys(scotlandYardGraph).map(Number));
    for (const t of state.mrXLog) {
      const next = new Set<number>();
      for (const pos of possible) {
        for (const dest of neighbors(pos, t)) {
          next.add(dest);
        }
      }
      if (next.size > 0) possible = next;
    }
    return distanceToSetMap(possible);
  }

  private bestMrXMove(state: ScotlandYardState, player: ScotlandYardPlayer): ScoredMove | null {
    const detectiveDist = distanceToSetMap(state.players.filter(p => p.role === 'DETECTIVE').map(p => p.position));
    const revealTurn = state.mrXRevealedTurns.includes(state.mrXLog.length);

    let best: ScoredMove | null = null;
    for (const t of TICKET_ORDER) {
      if ((player.tickets[t] ?? 0) <= 0) continue;
      for (const target of neighbors(player.position, t)) {
        const score = (detectiveDist.get(target) ?? 0) + TICKET_RANK[t] * 0.15
          + (revealTurn ? this.connectivity(target) / 100 : 0);
        if (!best || this.betterMrX(score, target, best)) {
          best = { target, transport: t, score };
        }
      }
    }
    return best;
  }

  private betterMrX(score: number, target: number, current: ScoredMove): boolean {
    if (score > current.score + 1e-9) return true;
    if (Math.abs(score - current.score) <= 1e-9) return target < current.target;
    return false;
  }

  private connectivity(node: number): number {
    let count = 0;
    for (const t of TICKET_ORDER) count += neighbors(node, t).length;
    return count;
  }

  /** Greedy two-leg escape: only selected when it beats the single move. */
  private bestEnabledMrXDouble(state: ScotlandYardState, player: ScotlandYardPlayer): { move1: Move; move2: Move } | null {
    if ((player.tickets.double ?? 0) <= 0) return null;
    // Mr. X may not double through a reveal turn (his position would be shown).
    const nextLogLengths = [state.mrXLog.length + 1, state.mrXLog.length + 2];
    if (nextLogLengths.some(n => state.mrXRevealedTurns.includes(n))) return null;

    const single = this.bestMrXMove(state, player);
    const detectiveDist = distanceToSetMap(state.players.filter(p => p.role === 'DETECTIVE').map(p => p.position));

    let best: { move1: Move; move2: Move; score: number } | null = null;
    const legs1 = this.legalMoves(state, player);
    for (const leg1 of legs1) {
      const legs2 = this.legalMovesAt(state, player, leg1.target);
      for (const leg2 of legs2) {
        const score = (detectiveDist.get(leg2.target) ?? 0)
          + TICKET_RANK[leg2.transport] * 0.15
          + TICKET_RANK[leg1.transport] * 0.05;
        if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && leg2.target < best.move2.target)) {
          best = { move1: leg1, move2: leg2, score };
        }
      }
    }

    if (!best || !single) return null;
    if (best.score < single.score + DOUBLE_MOVE_GAIN) return null;
    return { move1: best.move1, move2: best.move2 };
  }

  private legalMoves(state: ScotlandYardState, player: ScotlandYardPlayer): Move[] {
    return this.legalMovesAt(state, player, player.position);
  }

  private legalMovesAt(state: ScotlandYardState, player: ScotlandYardPlayer, from: number): Move[] {
    const moves: Move[] = [];
    for (const t of TICKET_ORDER) {
      if ((player.tickets[t] ?? 0) <= 0) continue;
      for (const target of neighbors(from, t)) {
        moves.push({ target, transport: t });
      }
    }
    return moves;
  }
}