import { type IGameEngine, playerId } from '@packages/engine-core';
import { boardGraph } from '@packages/catan-engine';
import type {
  CatanPlayer,
  Hex,
  ICatanAction,
  ICatanEvent,
  ICatanState,
  ICatanTradeOffer,
  ResourceType
} from '@packages/catan-engine';
import type { IBotStrategy } from './IBotStrategy';

type CatanEngine = IGameEngine<ICatanState, ICatanAction, ICatanEvent>;
type Resource = Exclude<ResourceType, 'DESERT'>;
type PlayerId = CatanPlayer['id'];

const RESOURCES: readonly Resource[] = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

const BUILD_COST: Readonly<Record<'SETTLEMENT' | 'CITY', Readonly<Partial<Record<Resource, number>>>>> = {
  SETTLEMENT: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  CITY: { WHEAT: 2, ORE: 3 },
};
const DEV_COST: Readonly<Record<Resource, number>> = { WOOD: 0, BRICK: 0, SHEEP: 1, WHEAT: 1, ORE: 1 };

/** Relative roll probability of each number token (5 = best, 6/8 ≈ 5/6 as likely). */
const TOKEN_VALUE: Readonly<Record<number, number>> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
/** How much each resource is worth toward an early build (wood/brick scarce in 4p). */
const RESOURCE_VALUE: Readonly<Record<Resource, number>> = { WOOD: 0.9, BRICK: 0.9, SHEEP: 1.0, WHEAT: 1.1, ORE: 1.0 };
const DESERT_PENALTY = 0.3;

/**
 * Heuristic Catan bot. Every action it proposes is re-validated by
 * `engine.isValidAction` in `BotController` before dispatch, and the bot also
 * mirrors the engine's legality rules (distance rule, road connectivity,
 * exact-card discards, victim adjacency) so its candidates survive `reduce`.
 *
 * Per-phase behavior:
 *  - INITIAL_PLACEMENT: settle the highest-scoring LEGAL vertex (never a vertex
 *    adjacent to any building, matching the engine's distance rule), then attach
 *    a road to the pending settlement.
 *  - DISCARD_PHASE: drop the most abundant resources first, always the exact
 *    required count.
 *  - ROBBER_PLACEMENT: rob the victory-point leader (only if they are actually
 *    adjacent to the chosen hex, else move the robber without stealing).
 *  - MAIN_TURN: roll if needed, then city > settlement > dev card > knight >
 *    bank trade > end turn. The bot never initiates player trades, and handles
 *    any incoming offer by accepting only clearly favorable deals.
 */
export class CatanBot implements IBotStrategy<ICatanState, ICatanAction> {
  decide(state: ICatanState, actingPlayerId: string, engine: CatanEngine): ICatanAction {
    const pid = playerId(actingPlayerId);
    const player = state.players.find(p => p.id === pid);
    if (!player) {
      return { type: 'END_TURN', playerId: pid };
    }

    for (const candidate of this.candidates(state, player)) {
      if (engine.isValidAction(state, candidate)) return candidate;
    }
    return { type: 'END_TURN', playerId: pid };
  }

  private candidates(state: ICatanState, player: CatanPlayer): ICatanAction[] {
    const pid = player.id;
    const outcome: ICatanAction[] = [];

    if (state.activeTrade) {
      if (state.activeTrade.toPlayerId === pid) {
        return this.isFavorableTrade(state.activeTrade)
          ? [{ type: 'ACCEPT_TRADE', playerId: pid }]
          : [{ type: 'REJECT_TRADE', playerId: pid }];
      }
      if (state.activeTrade.fromPlayerId === pid) {
        return [{ type: 'CANCEL_TRADE', playerId: pid }];
      }
    }

    switch (state.turnPhase) {
      case 'INITIAL_PLACEMENT_1':
      case 'INITIAL_PLACEMENT_2': {
        if (state.placementStep === 'SETTLEMENT') {
          const vertexId = this.bestInitialVertex(state);
          if (vertexId) outcome.push({ type: 'PLACE_INITIAL_SETTLEMENT', playerId: pid, vertexId });
        } else {
          const edgeId = this.bestInitialRoad(state);
          if (edgeId) outcome.push({ type: 'PLACE_INITIAL_ROAD', playerId: pid, edgeId });
        }
        return outcome;
      }

      case 'DISCARD_PHASE': {
        if (state.pendingDiscards[pid]) {
          outcome.push({ type: 'DISCARD_RESOURCES', playerId: pid, resources: this.discardSelection(state, player) });
        }
        return outcome;
      }

      case 'ROBBER_PLACEMENT':
        return [this.robberMove(state, pid)];

      case 'MAIN_TURN':
        if (!state.hasRolled) {
          return [{ type: 'ROLL_DICE', playerId: pid }];
        }
        this.pushIf(outcome, this.upgradeCity(state, player));
        this.pushIf(outcome, this.buildSettlement(state, player));
        this.pushIf(outcome, this.buyDevCard(state, player));
        this.pushIf(outcome, this.playKnight(state, player));
        this.pushIf(outcome, this.bankTrade(state, player));
        return outcome;
    }
  }

  // --- Initial placement ---------------------------------------------------

  private bestInitialVertex(state: ICatanState): string | null {
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const vId of Object.keys(state.board.vertices)) {
      if (!this.isLegalVertex(state, vId)) continue;
      const score = this.vertexScore(state, vId);
      if (score > bestScore) {
        bestScore = score;
        best = vId;
      }
    }
    return best;
  }

  private bestInitialRoad(state: ICatanState): string | null {
    const anchor = state.pendingRoadVertex;
    if (!anchor) return null;
    const graph = boardGraph.vertices[anchor];
    if (!graph) return null;
    for (const edgeId of graph.adjacentEdges) {
      const edge = state.board.edges[edgeId];
      if (edge && !edge.owner) return edgeId;
    }
    return null;
  }

  // --- MAIN_TURN ladder ----------------------------------------------------

  private upgradeCity(state: ICatanState, player: CatanPlayer): ICatanAction | null {
    if (!this.hasResources(player, BUILD_COST.CITY)) return null;
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const [vId, v] of Object.entries(state.board.vertices)) {
      if (v.owner !== player.id || v.building !== 'SETTLEMENT') continue;
      const score = this.vertexScore(state, vId);
      if (score > bestScore) {
        bestScore = score;
        best = vId;
      }
    }
    return best ? { type: 'UPGRADE_CITY', playerId: player.id, vertexId: best } : null;
  }

  private buildSettlement(state: ICatanState, player: CatanPlayer): ICatanAction | null {
    if (!this.hasResources(player, BUILD_COST.SETTLEMENT)) return null;
    const hasRoads = Object.values(state.board.edges).some(e => e.owner === player.id);
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const vId of Object.keys(state.board.vertices)) {
      if (!this.isLegalVertex(state, vId)) continue;
      if (hasRoads && !this.hasOwnRoadAdjacent(state, vId, player.id)) continue;
      const score = this.vertexScore(state, vId);
      if (score > bestScore) {
        bestScore = score;
        best = vId;
      }
    }
    return best ? { type: 'BUILD_SETTLEMENT', playerId: player.id, vertexId: best } : null;
  }

  private buyDevCard(state: ICatanState, player: CatanPlayer): ICatanAction | null {
    if (!this.hasResources(player, DEV_COST)) return null;
    if (state.devCardDeck.length === 0) return null;
    return { type: 'BUY_DEV_CARD', playerId: player.id };
  }

  private playKnight(state: ICatanState, player: CatanPlayer): ICatanAction | null {
    if (state.playedDevCardThisTurn) return null;
    const hasKnight = player.developmentCards.some(c => c.type === 'KNIGHT' && !c.boughtThisTurn);
    if (!hasKnight) return null;
    return this.robberPlay(state, player.id, 'PLAY_KNIGHT');
  }

  private bankTrade(state: ICatanState, player: CatanPlayer): ICatanAction | null {
    const missing = this.missingForBuild(player);
    if (!missing) return null;
    const surplus = RESOURCES.find(r => r !== missing && (player.resources[r] ?? 0) >= 4);
    if (!surplus) return null;
    return { type: 'TRADE_BANK', playerId: player.id, offerResource: surplus, requestResource: missing, amount: 1 };
  }

  // --- Robber & discard ----------------------------------------------------

  private robberMove(state: ICatanState, pid: PlayerId): ICatanAction {
    return this.robberPlay(state, pid, 'MOVE_ROBBER');
  }

  private robberPlay(state: ICatanState, pid: PlayerId, type: 'MOVE_ROBBER' | 'PLAY_KNIGHT'): ICatanAction {
    const target = this.robberTarget(state, pid);
    const hexId = this.robberHex(state, target);
    if (!hexId) return { type: 'END_TURN', playerId: pid };
    const adjacent = target !== null && this.isHexAdjacentToOwner(hexId, target, state);
    if (adjacent && target !== null) {
      return type === 'MOVE_ROBBER'
        ? { type: 'MOVE_ROBBER', playerId: pid, hexId, targetPlayerId: target }
        : { type: 'PLAY_KNIGHT', playerId: pid, hexId, targetPlayerId: target };
    }
    return type === 'MOVE_ROBBER'
      ? { type: 'MOVE_ROBBER', playerId: pid, hexId }
      : { type: 'PLAY_KNIGHT', playerId: pid, hexId };
  }

  private robberTarget(state: ICatanState, pid: PlayerId): PlayerId | null {
    const others = state.players.filter(p => p.id !== pid);
    if (others.length === 0) return null;
    const leader = [...others].sort(
      (a, b) => b.victoryPoints - a.victoryPoints || this.totalResources(b) - this.totalResources(a)
    )[0]!;
    return leader.id;
  }

  private robberHex(state: ICatanState, target: PlayerId | null): string | null {
    const movable = state.board.hexes.filter(h => !h.hasRobber);
    if (movable.length === 0) return null;
    if (target) {
      const onTarget = movable.filter(h => this.isHexAdjacentToOwner(h.id, target, state));
      if (onTarget.length > 0) return this.bestHexId(onTarget);
    }
    return this.bestHexId(movable);
  }

  private bestHexId(hexes: readonly Hex[]): string {
    const best = [...hexes].sort(
      (a, b) => (TOKEN_VALUE[b.numberToken ?? 0] ?? 0) - (TOKEN_VALUE[a.numberToken ?? 0] ?? 0)
    );
    return best[0]!.id;
  }

  private discardSelection(state: ICatanState, player: CatanPlayer): Record<Resource, number> {
    const needed = state.pendingDiscards[player.id] ?? 0;
    const resources: Record<Resource, number> = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    let toDrop = needed;
    for (const r of RESOURCES) {
      const drop = Math.min(player.resources[r] ?? 0, toDrop);
      resources[r] = drop;
      toDrop -= drop;
      if (toDrop <= 0) break;
    }
    return resources;
  }

  // --- Scoring / legality --------------------------------------------------

  private vertexScore(state: ICatanState, vId: string): number {
    const graph = boardGraph.vertices[vId];
    if (!graph) return -Infinity;
    let score = 0;
    let desert = false;
    for (const hexId of graph.adjacentHexes) {
      const hex = state.board.hexes.find(h => h.id === hexId);
      if (!hex) continue;
      if (hex.resource === 'DESERT') {
        desert = true;
        continue;
      }
      const token = TOKEN_VALUE[hex.numberToken ?? 0] ?? 0;
      score += (RESOURCE_VALUE[hex.resource as Resource] ?? 0) * (token / 5);
    }
    return desert ? score - DESERT_PENALTY : score;
  }

  /** Mirrors the engine distance rule: vertex unoccupied and no adjacent building. */
  private isLegalVertex(state: ICatanState, vId: string): boolean {
    const vertex = state.board.vertices[vId];
    if (!vertex || vertex.building) return false;
    const graph = boardGraph.vertices[vId];
    if (!graph) return false;
    for (const adj of graph.adjacentVertices) {
      if (state.board.vertices[adj]?.building) return false;
    }
    return true;
  }

  private hasOwnRoadAdjacent(state: ICatanState, vId: string, pid: PlayerId): boolean {
    const graph = boardGraph.vertices[vId];
    if (!graph) return false;
    return graph.adjacentEdges.some(edgeId => state.board.edges[edgeId]?.owner === pid);
  }

  private isHexAdjacentToOwner(hexId: string, ownerId: PlayerId, state: ICatanState): boolean {
    return Object.keys(boardGraph.vertices).some(
      vId => boardGraph.vertices[vId]!.adjacentHexes.includes(hexId) && state.board.vertices[vId]?.owner === ownerId
    );
  }

  private hasResources(player: CatanPlayer, cost: Readonly<Partial<Record<Resource, number>>>): boolean {
    return (Object.entries(cost) as [Resource, number | undefined][]).every(
      ([r, need]) => (player.resources[r] ?? 0) >= (need ?? 0)
    );
  }

  private missingForBuild(player: CatanPlayer): Resource | null {
    for (const cost of [BUILD_COST.SETTLEMENT, BUILD_COST.CITY]) {
      const missing = (Object.entries(cost) as [Resource, number | undefined][]).filter(
        ([r, need]) => (player.resources[r] ?? 0) < (need ?? 0)
      );
      if (missing.length === 1) return missing[0]![0];
    }
    return null;
  }

  private totalResources(player: CatanPlayer): number {
    return RESOURCES.reduce((sum, r) => sum + (player.resources[r] ?? 0), 0);
  }

  private isFavorableTrade(trade: ICatanTradeOffer): boolean {
    let gain = 0;
    for (const r of RESOURCES) {
      gain += (trade.offer[r] ?? 0) - (trade.request[r] ?? 0);
    }
    return gain >= 1;
  }

  private pushIf(outcome: ICatanAction[], action: ICatanAction | null): void {
    if (action) outcome.push(action);
  }
}