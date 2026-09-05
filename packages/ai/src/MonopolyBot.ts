import { IGameEngine, playerId, PropertyId } from '@packages/engine-core';
import { BOARD_SPACES } from '@packages/monopoly-engine';
import type { IBoardSpace, IMonopolyPlayer, IMonopolyState, MonopolyAction, MonopolyEvent } from '@packages/monopoly-engine';
import type { IBotStrategy } from './IBotStrategy';

type MonopolyEngine = IGameEngine<IMonopolyState, MonopolyAction, MonopolyEvent>;

/** BOARD_SPACES_MAP is only internal to the engine package, so index locally. */
const spaceById: ReadonlyMap<PropertyId, IBoardSpace> = new Map(BOARD_SPACES.map(s => [s.id, s]));

/** Cash buffer kept *above* a purchase price before the bot splurges. */
export const MONOPOLY_PURCHASE_BUFFER = 100;
/** Cash buffer kept *above* a house price before the bot develops. */
export const MONOPOLY_HOUSE_BUFFER = 200;
/** Cash above which the bot starts unmortgaging owned deeds. */
export const MONOPOLY_UNMORTGAGE_THRESHOLD = 500;

/**
 * Heuristic Monopoly bot. Produces one action per `BotController` tick; every
 * candidate is re-validated with `engine.isValidAction`, so the bot can never
 * cheat — a stale heuristic simply falls through to the next viable action.
 *
 * Decision order:
 *  1. answer a pending trade involving the bot,
 *  2. resolve an unresolved debt (pay → sell houses → mortgage → bankrupt),
 *  3. roll — escaping jail via a get-out-of-jail card or a fine when possible,
 *  4. after rolling: buy the property landed on, develop complete color groups,
 *     unmortgage when flush, then end the turn.
 */
export class MonopolyBot implements IBotStrategy<IMonopolyState, MonopolyAction> {
  decide(state: IMonopolyState, actingPlayerId: string, engine: MonopolyEngine): MonopolyAction {
    const pid = playerId(actingPlayerId);
    const player = state.players.find(p => p.id === pid);
    if (!player) {
      return { type: 'ROLL_DICE', playerId: pid };
    }

    for (const candidate of this.candidates(state, player)) {
      if (engine.isValidAction(state, candidate)) return candidate;
    }

    // Last-resort safety: never hang the turn.
    return player.hasRolled ? { type: 'END_TURN', playerId: pid } : { type: 'ROLL_DICE', playerId: pid };
  }

  private candidates(state: IMonopolyState, player: IMonopolyPlayer): MonopolyAction[] {
    const pid = player.id;
    const actions: MonopolyAction[] = [];

    // 1. Answer a pending trade the bot is part of before doing anything else.
    if (state.activeTrade) {
      if (state.activeTrade.toPlayerId === pid) {
        return [
          this.tradeIsFavorable(state.activeTrade)
            ? { type: 'ACCEPT_TRADE', playerId: pid }
            : { type: 'REJECT_TRADE', playerId: pid },
        ];
      }
      if (state.activeTrade.fromPlayerId === pid) {
        // Bots never initiate trades; cancel any stale offer of their own.
        return [{ type: 'CANCEL_TRADE', playerId: pid }];
      }
    }

    // 2. Debt must be serviced before any normal play.
    if (player.debt) {
      actions.push({ type: 'PAY_DEBT', playerId: pid });
      // Liquidate in reverse order of severity: sell the most-developed deeds first.
      const sellable = BOARD_SPACES
        .filter(s => state.ownership[s.id] === pid && (state.buildings[s.id] ?? 0) > 0)
        .sort((a, b) => (state.buildings[b.id] ?? 0) - (state.buildings[a.id] ?? 0));
      for (const space of sellable) {
        actions.push({ type: 'SELL_HOUSE', playerId: pid, propertyId: space.id });
      }
      const mortgageable = BOARD_SPACES.filter(s => state.ownership[s.id] === pid && !state.mortgagedProperties[s.id]);
      for (const space of mortgageable) {
        actions.push({ type: 'MORTGAGE_PROPERTY', playerId: pid, propertyId: space.id });
      }
      actions.push({ type: 'DECLARE_BANKRUPTCY', playerId: pid });
      return actions;
    }

    // 3. Un-rolled: escape jail sensibly, otherwise roll the dice.
    if (!player.hasRolled) {
      if (player.inJail) {
        if (player.getOutOfJailFreeCards.length > 0) {
          actions.push({ type: 'USE_JAIL_CARD', playerId: pid });
        }
        if (player.money >= 50) {
          actions.push({ type: 'PAY_JAIL_FINE', playerId: pid });
        }
        actions.push({ type: 'ROLL_DICE', playerId: pid });
        return actions;
      }
      return [{ type: 'ROLL_DICE', playerId: pid }];
    }

    // 4. Rolled: spend the turn productively.
    const space = BOARD_SPACES[player.position];
    if (space && space.type === 'PROPERTY' && space.price !== undefined) {
      const ownerId = state.ownership[space.id];
      if (!ownerId && player.money >= space.price + MONOPOLY_PURCHASE_BUFFER) {
        actions.push({ type: 'BUY_PROPERTY', playerId: pid });
      }
    }

    for (const target of this.houseTargets(state, player)) {
      actions.push({ type: 'BUY_HOUSE', playerId: pid, propertyId: target });
    }

    if (player.money > MONOPOLY_UNMORTGAGE_THRESHOLD) {
      for (const [propId, isMortgaged] of Object.entries(state.mortgagedProperties)) {
        if (isMortgaged && state.ownership[propId as PropertyId] === pid) {
          actions.push({ type: 'UNMORTGAGE_PROPERTY', playerId: pid, propertyId: propId as PropertyId });
        }
      }
    }

    actions.push({ type: 'END_TURN', playerId: pid });
    return actions;
  }

  /** Build on every fully-owned, unmortgaged color group; cheap groups first. */
  private houseTargets(state: IMonopolyState, player: IMonopolyPlayer): PropertyId[] {
    const groupSpaces = new Map<string, IBoardSpace[]>();
    for (const space of BOARD_SPACES) {
      if (space.type !== 'PROPERTY' || !space.colorGroup || space.colorGroup === 'Railroad' || space.colorGroup === 'Utility') {
        continue;
      }
      const list = groupSpaces.get(space.colorGroup);
      if (list) {
        list.push(space);
      } else {
        groupSpaces.set(space.colorGroup, [space]);
      }
    }

    const targets: PropertyId[] = [];
    for (const group of groupSpaces.values()) {
      const ownsAll = group.every(s => state.ownership[s.id] === player.id);
      if (!ownsAll) continue;
      const anyMortgaged = group.some(s => state.mortgagedProperties[s.id]);
      if (anyMortgaged) continue;
      const minBuildings = Math.min(...group.map(s => state.buildings[s.id] ?? 0));
      if (minBuildings >= 5) continue;
      const viable = group
        .filter(s => (state.buildings[s.id] ?? 0) === minBuildings)
        .filter(s => player.money >= (s.housePrice ?? 0) + MONOPOLY_HOUSE_BUFFER)
        .sort((a, b) => (a.housePrice ?? 0) - (b.housePrice ?? 0));
      const target = viable[0];
      if (target) targets.push(target.id);
    }

    return targets.sort(
      (a, b) => (spaceById.get(a)?.housePrice ?? 0) - (spaceById.get(b)?.housePrice ?? 0)
    );
  }

  private tradeIsFavorable(trade: IMonopolyState['activeTrade']): boolean {
    if (!trade) return false;
    const gain = trade.offeredMoney + trade.offeredProperties.reduce((sum, id) => sum + (spaceById.get(id)?.price ?? 0), 0);
    const cost = trade.requestedMoney + trade.requestedProperties.reduce((sum, id) => sum + (spaceById.get(id)?.price ?? 0), 0);
    return gain > cost;
  }
}