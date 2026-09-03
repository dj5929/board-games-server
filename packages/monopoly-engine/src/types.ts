import type { IGameState, IPlayer, IPlayerAction, IGameEvent, PlayerId, PropertyId } from '@packages/engine-core';

export interface IMonopolyPlayer extends IPlayer {
  status: 'ACTIVE' | 'BANKRUPT';
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  hasRolled: boolean;
  doublesCount: number;
  getOutOfJailFreeCards: string[];
  debt: { amount: number, to: PlayerId | 'BANK', reason: string } | null;
}

export interface ITradeOffer {
  id: string;
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  offeredProperties: PropertyId[];
  requestedProperties: PropertyId[];
  offeredMoney: number;
  requestedMoney: number;
}

export interface IMonopolyState extends IGameState {
  readonly players: readonly IMonopolyPlayer[];
  readonly currentPlayerIndex: number;
  readonly ownership: Readonly<Record<PropertyId, PlayerId>>;
  readonly mortgagedProperties: Readonly<Record<PropertyId, boolean>>;
  readonly buildings: Readonly<Record<PropertyId, number>>;
  readonly bankMoney: number;
  readonly activeTrade: ITradeOffer | null;
  readonly chanceDeck: readonly string[];
  readonly chestDeck: readonly string[];
}

export type MonopolyAction = 
  | (IPlayerAction & { type: 'ROLL_DICE' })
  | (IPlayerAction & { type: 'END_TURN' })
  | (IPlayerAction & { type: 'FORCE_END_TURN' })
  | (IPlayerAction & { type: 'BUY_PROPERTY' })
  | (IPlayerAction & { type: 'PAY_JAIL_FINE' })
  | (IPlayerAction & { type: 'MORTGAGE_PROPERTY', propertyId: PropertyId })
  | (IPlayerAction & { type: 'UNMORTGAGE_PROPERTY', propertyId: PropertyId })
  | (IPlayerAction & { type: 'BUY_HOUSE', propertyId: PropertyId })
  | (IPlayerAction & { type: 'SELL_HOUSE', propertyId: PropertyId })
  | (IPlayerAction & { type: 'RESTART_GAME' })
  | (IPlayerAction & { type: 'PROPOSE_TRADE', toPlayerId: PlayerId, offeredProperties: PropertyId[], requestedProperties: PropertyId[], offeredMoney: number, requestedMoney: number })
  | (IPlayerAction & { type: 'ACCEPT_TRADE' })
  | (IPlayerAction & { type: 'REJECT_TRADE' })
  | (IPlayerAction & { type: 'CANCEL_TRADE' })
  | (IPlayerAction & { type: 'USE_JAIL_CARD' })
  | (IPlayerAction & { type: 'PAY_DEBT' })
  | (IPlayerAction & { type: 'DECLARE_BANKRUPTCY' });

export type MonopolyEvent = 
  | (IGameEvent & { type: 'DICE_ROLLED', playerId: PlayerId, dice1: number, dice2: number, position: number })
  | (IGameEvent & { type: 'TURN_ENDED', nextPlayerId: PlayerId })
  | (IGameEvent & { type: 'TURN_TIMED_OUT', playerId: PlayerId, nextPlayerId: PlayerId })
  | (IGameEvent & { type: 'PROPERTY_BOUGHT', propertyId: PropertyId, playerId: PlayerId, price: number })
  | (IGameEvent & { type: 'RENT_PAID', fromPlayerId: PlayerId, toPlayerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'PASSED_GO', playerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'TAX_PAID', playerId: PlayerId, amount: number, taxName: string })
  | (IGameEvent & { type: 'WENT_TO_JAIL', playerId: PlayerId, reason: string })
  | (IGameEvent & { type: 'PROPERTY_MORTGAGED', propertyId: PropertyId, playerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'PROPERTY_UNMORTGAGED', propertyId: PropertyId, playerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'HOUSE_BOUGHT', propertyId: PropertyId, playerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'HOUSE_SOLD', propertyId: PropertyId, playerId: PlayerId, amount: number })
  | (IGameEvent & { type: 'GAME_RESTARTED' })  | (IGameEvent & { type: 'TRADE_PROPOSED', trade: ITradeOffer })
  | (IGameEvent & { type: 'TRADE_ACCEPTED', tradeId: string })
  | (IGameEvent & { type: 'TRADE_REJECTED', tradeId: string })
  | (IGameEvent & { type: 'TRADE_CANCELLED', tradeId: string })
  | (IGameEvent & { type: 'CARD_DRAWN', playerId: PlayerId, deck: 'CHANCE' | 'CHEST', text: string })
  | (IGameEvent & { type: 'JAIL_CARD_USED', playerId: PlayerId })
  | (IGameEvent & { type: 'DEBT_INCURRED', playerId: PlayerId, amount: number, to: PlayerId | 'BANK', reason: string })
  | (IGameEvent & { type: 'DEBT_CLEARED', playerId: PlayerId })
  | (IGameEvent & { type: 'BANKRUPTCY_DECLARED', playerId: PlayerId, to: PlayerId | 'BANK' })
  | (IGameEvent & { type: 'GAME_OVER', winnerId: PlayerId | null });
