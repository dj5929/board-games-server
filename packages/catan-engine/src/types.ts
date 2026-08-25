import { IGameState, IPlayerAction, IGameEvent, PlayerId } from '@packages/engine-core';

export type ResourceType = 'WOOD' | 'BRICK' | 'SHEEP' | 'WHEAT' | 'ORE' | 'DESERT';

export interface Hex {
  id: string; // e.g., "q,r"
  q: number;
  r: number;
  s: number;
  resource: ResourceType;
  numberToken: number | null; // Desert has no token
  hasRobber: boolean;
}

export interface Vertex {
  id: string;
  owner: PlayerId | null;
  building: 'SETTLEMENT' | 'CITY' | null;
}

export type PortType = '3:1' | ResourceType;

export interface Edge {
  id: string;
  owner: PlayerId | null;
  port: PortType | null;
}

export interface ICatanTradeOffer {
  id: string;
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  offer: Record<Exclude<ResourceType, 'DESERT'>, number>;
  request: Record<Exclude<ResourceType, 'DESERT'>, number>;
}

export type DevCardType = 'KNIGHT' | 'VICTORY_POINT' | 'ROAD_BUILDING' | 'YEAR_OF_PLENTY' | 'MONOPOLY';

export interface IDevCard {
  id: string;
  type: DevCardType;
  boughtThisTurn: boolean;
}

export interface CatanPlayer {
  id: PlayerId;
  resources: Record<Exclude<ResourceType, 'DESERT'>, number>;
  victoryPoints: number;
  color: string;
  developmentCards: IDevCard[];
  playedDevelopmentCards: DevCardType[];
}

export interface ICatanState extends IGameState {
  readonly players: readonly CatanPlayer[];
  readonly board: {
    readonly hexes: readonly Hex[];
    readonly vertices: Readonly<Record<string, Vertex>>;
    readonly edges: Readonly<Record<string, Edge>>;
  };
  readonly turnPhase: 'INITIAL_PLACEMENT_1' | 'INITIAL_PLACEMENT_2' | 'MAIN_TURN' | 'DISCARD_PHASE' | 'ROBBER_PLACEMENT';
  readonly pendingDiscards: Readonly<Record<PlayerId, number>>;
  readonly devCardDeck: readonly DevCardType[];
  readonly activePlayerId: PlayerId | null;
  readonly activeTrade: ICatanTradeOffer | null;
}

export type ICatanAction = IPlayerAction & (
  | { type: 'ROLL_DICE' }
  | { type: 'END_TURN' }
  // Robber & Discard mechanics
  | { type: 'DISCARD_RESOURCES'; resources: Record<Exclude<ResourceType, 'DESERT'>, number> }
  | { type: 'MOVE_ROBBER'; hexId: string; targetPlayerId?: PlayerId }
  // Dev Cards
  | { type: 'BUY_DEV_CARD' }
  | { type: 'PLAY_KNIGHT'; hexId: string; targetPlayerId?: PlayerId }
  | { type: 'PLAY_YEAR_OF_PLENTY'; resource1: Exclude<ResourceType, 'DESERT'>; resource2: Exclude<ResourceType, 'DESERT'> }
  | { type: 'PLAY_MONOPOLY'; resource: Exclude<ResourceType, 'DESERT'> }
  | { type: 'PLAY_ROAD_BUILDING'; edgeId1: string; edgeId2?: string }
  // Placeholder actions for initial placement
  | { type: 'PLACE_INITIAL_SETTLEMENT'; vertexId: string }
  | { type: 'PLACE_INITIAL_ROAD'; edgeId: string }
  // Main building actions
  | { type: 'BUILD_SETTLEMENT'; vertexId: string }
  | { type: 'BUILD_ROAD'; edgeId: string }
  | { type: 'UPGRADE_CITY'; vertexId: string }
  // Trading actions
  | { type: 'TRADE_BANK'; offerResource: ResourceType; requestResource: ResourceType; amount: number }
  | { type: 'PROPOSE_TRADE'; toPlayerId: PlayerId; offer: Record<Exclude<ResourceType, 'DESERT'>, number>; request: Record<Exclude<ResourceType, 'DESERT'>, number> }
  | { type: 'ACCEPT_TRADE' }
  | { type: 'REJECT_TRADE' }
  | { type: 'CANCEL_TRADE' }
);

export type ICatanEvent = IGameEvent & (
  | { type: 'DICE_ROLLED'; dice1: number; dice2: number; total: number }
  | { type: 'TURN_ENDED'; nextPlayerId: PlayerId }
  | { type: 'RESOURCES_DISCARDED'; playerId: PlayerId; amount: number }
  | { type: 'ROBBER_MOVED'; playerId: PlayerId; hexId: string }
  | { type: 'STOLEN_RESOURCE'; thiefId: PlayerId; victimId: PlayerId; resource: Exclude<ResourceType, 'DESERT'> }
  | { type: 'DEV_CARD_BOUGHT'; playerId: PlayerId }
  | { type: 'DEV_CARD_PLAYED'; playerId: PlayerId; cardType: DevCardType }
  | { type: 'SETTLEMENT_BUILT'; playerId: PlayerId; vertexId: string }
  | { type: 'ROAD_BUILT'; playerId: PlayerId; edgeId: string }
  | { type: 'CITY_UPGRADED'; playerId: PlayerId; vertexId: string }
  | { type: 'RESOURCES_RECEIVED'; playerId: PlayerId; resources: Record<Exclude<ResourceType, 'DESERT'>, number> }
  | { type: 'BANK_TRADE'; playerId: PlayerId; offerResource: ResourceType; requestResource: ResourceType; amount: number; cost: number }
  | { type: 'TRADE_PROPOSED'; trade: ICatanTradeOffer }
  | { type: 'TRADE_ACCEPTED'; tradeId: string }
  | { type: 'TRADE_REJECTED'; tradeId: string }
  | { type: 'TRADE_CANCELLED'; tradeId: string }
);
