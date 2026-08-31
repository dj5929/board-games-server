import type { IGameEngine, IRandomProvider, IStateTransition, Result, PlayerId, PropertyId } from '@packages/engine-core';
import { shuffleArray, GAME_CONFIGS } from '@packages/engine-core';
import type { IMonopolyState, MonopolyAction, MonopolyEvent, IMonopolyPlayer } from './types';
import { BOARD_SPACES } from './board';
import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from './cards';



// Helper type to allow mutating the cloned state in reduce
type MutableMonopolyState = {
  -readonly [P in keyof IMonopolyState]: 
    P extends 'players' ? IMonopolyPlayer[] :
    P extends 'ownership' ? Record<PropertyId, PlayerId> :
    P extends 'mortgagedProperties' ? Record<PropertyId, boolean> :
    P extends 'buildings' ? Record<PropertyId, number> :
    P extends 'chanceDeck' ? string[] :
    P extends 'chestDeck' ? string[] :
    IMonopolyState[P];
};

export const MonopolyEngine: IGameEngine<IMonopolyState, MonopolyAction, MonopolyEvent> = {
  getInitialState(playerIds: PlayerId[], rng: IRandomProvider): IMonopolyState {
    if (playerIds.length < GAME_CONFIGS['monopoly'].minPlayers || playerIds.length > GAME_CONFIGS['monopoly'].maxPlayers) {
      throw new Error(`Monopoly requires ${GAME_CONFIGS['monopoly'].minPlayers} to ${GAME_CONFIGS['monopoly'].maxPlayers} players.`);
    }

    return {
      status: 'LOBBY',
      players: playerIds.map(id => ({
        id,
        status: 'ACTIVE',
        money: 1500,
        position: 0,
        inJail: false,
        jailTurns: 0,
        hasRolled: false,
        doublesCount: 0,
        getOutOfJailFreeCards: [],
        debt: null
      })),
      currentPlayerIndex: 0,
      ownership: {},
      mortgagedProperties: {},
      buildings: {},
      bankMoney: Infinity,
      activeTrade: null,
      chanceDeck: shuffleArray(CHANCE_CARDS.map(c => c.id), rng),
      chestDeck: shuffleArray(COMMUNITY_CHEST_CARDS.map(c => c.id), rng)
    };
  },

  reduce(currentState: Readonly<IMonopolyState>, action: Readonly<MonopolyAction>, rng: IRandomProvider): Result<IStateTransition<IMonopolyState, MonopolyEvent>, string> {
    const nextPlayers = currentState.players.map(p => ({
      ...p,
      getOutOfJailFreeCards: [...p.getOutOfJailFreeCards],
      debt: p.debt ? { ...p.debt } : null
    }));

    const nextState: MutableMonopolyState = {
      ...currentState,
      players: nextPlayers,
      ownership: { ...currentState.ownership },
      mortgagedProperties: { ...currentState.mortgagedProperties },
      buildings: { ...currentState.buildings },
      activeTrade: currentState.activeTrade ? {
        ...currentState.activeTrade,
        offeredProperties: [...currentState.activeTrade.offeredProperties],
        requestedProperties: [...currentState.activeTrade.requestedProperties]
      } : null,
      chanceDeck: [...currentState.chanceDeck],
      chestDeck: [...currentState.chestDeck]
    };
    
    // Backward compatibility for existing games initialized before Phase 7
    if (!nextState.chanceDeck) nextState.chanceDeck = shuffleArray(CHANCE_CARDS.map(c => c.id), rng);
    if (!nextState.chestDeck) nextState.chestDeck = shuffleArray(COMMUNITY_CHEST_CARDS.map(c => c.id), rng);
    nextState.players.forEach((p: IMonopolyPlayer) => {
      if (!p.getOutOfJailFreeCards) p.getOutOfJailFreeCards = [];
    });

    const events: MonopolyEvent[] = [];

    const currentPlayer = nextState.players[nextState.currentPlayerIndex];
    if (!currentPlayer) {
      return { success: false, error: 'PLAYER_NOT_FOUND' };
    }
    if (action.type !== 'RESTART_GAME' && action.playerId !== currentPlayer.id) {
      if ((action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE') && nextState.activeTrade?.toPlayerId === action.playerId) {
        // Allowed for the recipient of the trade
      } else {
        return { success: false, error: 'NOT_YOUR_TURN' }; // Invalid action
      }
    }

    if (currentPlayer.debt) {
      const allowedActions = ['SELL_HOUSE', 'MORTGAGE_PROPERTY', 'PROPOSE_TRADE', 'ACCEPT_TRADE', 'REJECT_TRADE', 'PAY_DEBT', 'DECLARE_BANKRUPTCY', 'RESTART_GAME'];
      if (!allowedActions.includes(action.type)) {
        return { success: false, error: 'MUST_RESOLVE_DEBT' };
      }
    }

    switch (action.type) {
      case 'ROLL_DICE': {
        const dice1 = Math.floor(rng.next() * 6) + 1;
        const dice2 = Math.floor(rng.next() * 6) + 1;

        if (currentPlayer.inJail) {
          if (dice1 === dice2) {
            currentPlayer.inJail = false;
            currentPlayer.jailTurns = 0;
            currentPlayer.hasRolled = true; // Escaping with doubles does not grant another turn
          } else {
            currentPlayer.jailTurns += 1;
            if (currentPlayer.jailTurns === 3) {
              if (currentPlayer.money < 50) {
                currentPlayer.debt = { amount: 50, to: 'BANK', reason: 'Jail Fine' };
                events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount: 50, to: 'BANK', reason: 'Jail Fine' });
              } else {
                currentPlayer.money -= 50;
                nextState.bankMoney += 50;
              }
              currentPlayer.inJail = false;
              currentPlayer.jailTurns = 0;
              currentPlayer.hasRolled = true;
            } else {
              currentPlayer.hasRolled = true;
              events.push({ type: 'DICE_ROLLED', playerId: currentPlayer.id, dice1, dice2, position: currentPlayer.position });
              break; // Stay in jail, do not move
            }
          }
        } else {
          if (dice1 === dice2) {
            currentPlayer.doublesCount += 1;
            if (currentPlayer.doublesCount === 3) {
              currentPlayer.inJail = true;
              currentPlayer.position = 10;
              currentPlayer.hasRolled = true;
              currentPlayer.doublesCount = 0;
              events.push({ type: 'DICE_ROLLED', playerId: currentPlayer.id, dice1, dice2, position: currentPlayer.position });
              events.push({ type: 'WENT_TO_JAIL', playerId: currentPlayer.id, reason: 'Speeding (3 Doubles)' });
              break; // Stop movement and rent logic if sent to jail
            } else {
              currentPlayer.hasRolled = false; // Grants another roll and prevents ending turn
            }
          } else {
            currentPlayer.hasRolled = true;
            currentPlayer.doublesCount = 0;
          }
        }

        const oldPosition = currentPlayer.position;
        currentPlayer.position = (currentPlayer.position + dice1 + dice2) % 40;

        // Passing GO
        if (currentPlayer.position < oldPosition) {
          currentPlayer.money += 200;
          nextState.bankMoney -= 200;
          events.push({ type: 'PASSED_GO', playerId: currentPlayer.id, amount: 200 });
        }

        // Space Resolution
        let resolving = true;
        let cardRentMultiplier: 'DOUBLE_RR' | 'FORCE_10X_UTIL' | null = null;
        while (resolving) {
          resolving = false;
          const landedSpace = BOARD_SPACES[currentPlayer.position];
          
          if (landedSpace!.type === 'PROPERTY') {
            const ownerId = nextState.ownership[landedSpace!.id];
            if (ownerId && ownerId !== currentPlayer.id && !nextState.mortgagedProperties[landedSpace!.id]) {
              const owner = nextState.players.find((p: IMonopolyPlayer) => p.id === ownerId);
              if (owner && landedSpace!.baseRent !== undefined) {
                let rent = landedSpace!.baseRent || 0;
                
                const buildings = nextState.buildings[landedSpace!.id] || 0;
                if (buildings > 0 && landedSpace!.rentWithHouses) {
                  rent = landedSpace!.rentWithHouses![buildings - 1] || 0;
                } else if (landedSpace!.colorGroup === 'Railroad') {
                  const rrOwned = BOARD_SPACES.filter(s => s.colorGroup === 'Railroad' && nextState.ownership[s.id] === ownerId).length;
                  if (rrOwned > 0) rent = 25 * Math.pow(2, rrOwned - 1);
                  // Chance card "Advance to nearest Railroad" doubles the rent
                  if (cardRentMultiplier === 'DOUBLE_RR') rent *= 2;
                } else if (landedSpace!.colorGroup === 'Utility') {
                  const utilOwned = BOARD_SPACES.filter(s => s.colorGroup === 'Utility' && nextState.ownership[s.id] === ownerId).length;
                  if (cardRentMultiplier === 'FORCE_10X_UTIL') {
                    // Chance card "Advance to nearest Utility" forces 10x dice
                    rent = (dice1 + dice2) * 10;
                  } else if (utilOwned === 1) rent = (dice1 + dice2) * 4;
                  else if (utilOwned === 2) rent = (dice1 + dice2) * 10;
                } else if (landedSpace!.colorGroup) {
                  const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === landedSpace!.colorGroup);
                  const ownsAll = groupSpaces.every(s => nextState.ownership[s.id] === ownerId);
                  if (ownsAll) {
                    rent *= 2;
                  }
                }
                
                if (currentPlayer.money < rent) {
                  currentPlayer.debt = { amount: rent, to: ownerId, reason: 'Rent' };
                  events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount: rent, to: ownerId, reason: 'Rent' });
                } else {
                  currentPlayer.money -= rent;
                  owner.money += rent;
                  events.push({ type: 'RENT_PAID', fromPlayerId: currentPlayer.id, toPlayerId: ownerId, amount: rent });
                }
              }
            }
          } else if (landedSpace!.type === 'TAX') {
            const amount = landedSpace!.id === 'tax1' ? 200 : 100;
            if (currentPlayer.money < amount) {
              currentPlayer.debt = { amount, to: 'BANK', reason: landedSpace!.name };
              events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount, to: 'BANK', reason: landedSpace!.name });
            } else {
              currentPlayer.money -= amount;
              nextState.bankMoney += amount;
              events.push({ type: 'TAX_PAID', playerId: currentPlayer.id, amount, taxName: landedSpace!.name });
            }
          } else if (landedSpace!.type === 'GO_TO_JAIL') {
            currentPlayer.inJail = true;
            currentPlayer.position = 10;
            currentPlayer.hasRolled = true;
            currentPlayer.doublesCount = 0;
            events.push({ type: 'WENT_TO_JAIL', playerId: currentPlayer.id, reason: 'Landed on Go To Jail' });
          } else if (landedSpace!.type === 'CHANCE' || landedSpace!.type === 'CHEST') {
            const isChance = landedSpace!.type === 'CHANCE';
            const deck = isChance ? nextState.chanceDeck : nextState.chestDeck;
            const cardId = deck.shift();
            const cardDef = isChance ? CHANCE_CARDS.find(c => c.id === cardId) : COMMUNITY_CHEST_CARDS.find(c => c.id === cardId);
            
            if (cardId && cardDef) {
              events.push({ type: 'CARD_DRAWN', playerId: currentPlayer.id, deck: isChance ? 'CHANCE' : 'CHEST', text: cardDef.text });
              
              if (cardDef.action === 'GET_OUT_OF_JAIL_FREE') {
                currentPlayer.getOutOfJailFreeCards.push(cardId);
              } else {
                deck.push(cardId);
              }
              
              switch (cardDef.action) {
                case 'MOVE_TO_POSITION': {
                  const targetIndex = cardDef.value!;
                  if (targetIndex < currentPlayer.position && targetIndex !== 10) {
                    currentPlayer.money += 200;
                    nextState.bankMoney -= 200;
                    events.push({ type: 'PASSED_GO', playerId: currentPlayer.id, amount: 200 });
                  }
                  currentPlayer.position = targetIndex;
                  resolving = true;
                  break;
                }
                case 'MOVE_TO_NEAREST_RR': {
                  const rrs = [5, 15, 25, 35];
                  let target = rrs.find(pos => pos > currentPlayer.position) ?? 5;
                  if (target < currentPlayer.position) {
                    currentPlayer.money += 200;
                    nextState.bankMoney -= 200;
                    events.push({ type: 'PASSED_GO', playerId: currentPlayer.id, amount: 200 });
                  }
                  currentPlayer.position = target;
                  cardRentMultiplier = 'DOUBLE_RR';
                  resolving = true;
                  break;
                }
                case 'MOVE_TO_NEAREST_UTIL': {
                  const utils = [12, 28];
                  let target = utils.find(pos => pos > currentPlayer.position) ?? 12;
                  if (target < currentPlayer.position) {
                    currentPlayer.money += 200;
                    nextState.bankMoney -= 200;
                    events.push({ type: 'PASSED_GO', playerId: currentPlayer.id, amount: 200 });
                  }
                  currentPlayer.position = target;
                  cardRentMultiplier = 'FORCE_10X_UTIL';
                  resolving = true;
                  break;
                }
                case 'MOVE_BACKWARDS': {
                  currentPlayer.position = (currentPlayer.position - cardDef.value! + 40) % 40;
                  resolving = true;
                  break;
                }
                case 'COLLECT_MONEY': {
                  currentPlayer.money += cardDef.value!;
                  nextState.bankMoney -= cardDef.value!;
                  break;
                }
                case 'PAY_MONEY': {
                  if (currentPlayer.money < cardDef.value!) {
                    currentPlayer.debt = { amount: cardDef.value!, to: 'BANK', reason: 'Chance/Chest Card' };
                    events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount: cardDef.value!, to: 'BANK', reason: 'Chance/Chest Card' });
                  } else {
                    currentPlayer.money -= cardDef.value!;
                    nextState.bankMoney += cardDef.value!;
                  }
                  break;
                }
                case 'COLLECT_FROM_PLAYERS': {
                  const amount = cardDef.value!;
                  let collected = 0;
                  nextState.players.forEach((p: IMonopolyPlayer) => {
                    if (p.id !== currentPlayer.id && p.status === 'ACTIVE') {
                      if (p.money >= amount) {
                        p.money -= amount;
                        collected += amount;
                      } else {
                        p.debt = { amount, to: currentPlayer.id, reason: 'Collect from Players card' };
                        events.push({ type: 'DEBT_INCURRED', playerId: p.id, amount, to: currentPlayer.id, reason: 'Collect from Players card' });
                      }
                    }
                  });
                  currentPlayer.money += collected;
                  break;
                }
                case 'PAY_PLAYERS': {
                  const amount = cardDef.value!;
                  const activeOtherPlayers = nextState.players.filter((p: IMonopolyPlayer) => p.id !== currentPlayer.id && p.status === 'ACTIVE');
                  const totalOwed = amount * activeOtherPlayers.length;
                  if (currentPlayer.money < totalOwed) {
                    // Compromise: Since `debt` only supports a single creditor, we assign the full debt to the BANK.
                    // This ensures the player must raise the full penalty amount or go bankrupt.
                    currentPlayer.debt = { amount: totalOwed, to: 'BANK', reason: 'Chance/Chest Card (Pay Players)' };
                    events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount: totalOwed, to: 'BANK', reason: 'Chance/Chest Card (Pay Players)' });
                  } else {
                    let paid = 0;
                    activeOtherPlayers.forEach((p: IMonopolyPlayer) => {
                      p.money += amount;
                      paid += amount;
                    });
                    currentPlayer.money -= paid;
                  }
                  break;
                }
                case 'PROPERTY_REPAIRS': {
                  let houseCount = 0;
                  let hotelCount = 0;
                  (Object.keys(nextState.buildings) as PropertyId[]).forEach(propId => {
                    if (nextState.ownership[propId] === currentPlayer.id) {
                      const count = nextState.buildings[propId]!;
                      if (count === 5) hotelCount++;
                      else houseCount += count;
                    }
                  });
                  const cost = (houseCount * cardDef.houseCost!) + (hotelCount * cardDef.hotelCost!);
                  if (currentPlayer.money < cost) {
                    currentPlayer.debt = { amount: cost, to: 'BANK', reason: 'Property Repairs' };
                    events.push({ type: 'DEBT_INCURRED', playerId: currentPlayer.id, amount: cost, to: 'BANK', reason: 'Property Repairs' });
                  } else {
                    currentPlayer.money -= cost;
                    nextState.bankMoney += cost;
                  }
                  break;
                }
                case 'GO_TO_JAIL': {
                  currentPlayer.inJail = true;
                  currentPlayer.position = 10;
                  currentPlayer.hasRolled = true;
                  currentPlayer.doublesCount = 0;
                  events.push({ type: 'WENT_TO_JAIL', playerId: currentPlayer.id, reason: 'Chance/Chest Card' });
                  break;
                }
              }
            }
          }
        }
        events.push({ type: 'DICE_ROLLED', playerId: currentPlayer.id, dice1, dice2, position: currentPlayer.position });
        break;
      }
      
      case 'BUY_PROPERTY': {
        const currentSpace = BOARD_SPACES[currentPlayer.position];
        if (!currentSpace || currentSpace.type !== 'PROPERTY' || !currentSpace.price) {
          return { success: false, error: 'NOT_PURCHASABLE' };
        }
        const isOwned = !!nextState.ownership[currentSpace.id];
        if (isOwned) {
          return { success: false, error: 'ALREADY_OWNED' };
        }
        if (currentPlayer.money < currentSpace.price) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }
        
        currentPlayer.money -= currentSpace.price;
        nextState.bankMoney += currentSpace.price;
        nextState.ownership[currentSpace.id] = currentPlayer.id;
        events.push({ type: 'PROPERTY_BOUGHT', propertyId: currentSpace.id, playerId: currentPlayer.id, price: currentSpace.price });
        break;
      }
      
      case 'PAY_JAIL_FINE': {
        if (!currentPlayer.inJail) {
          return { success: false, error: 'NOT_IN_JAIL' };
        }
        if (currentPlayer.hasRolled) {
          return { success: false, error: 'ALREADY_ROLLED' };
        }
        if (currentPlayer.money < 50) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }
        
        currentPlayer.money -= 50;
        nextState.bankMoney += 50;
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        break;
      }
      
      case 'USE_JAIL_CARD': {
        if (!currentPlayer.inJail) {
          return { success: false, error: 'NOT_IN_JAIL' };
        }
        if (currentPlayer.getOutOfJailFreeCards.length === 0) {
          return { success: false, error: 'NO_JAIL_CARD' };
        }
        if (currentPlayer.hasRolled) {
          return { success: false, error: 'ALREADY_ROLLED' };
        }
        
        const cardId = currentPlayer.getOutOfJailFreeCards.shift()!;
        if (cardId.startsWith('chance')) {
          nextState.chanceDeck.push(cardId);
        } else {
          nextState.chestDeck.push(cardId);
        }
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        events.push({ type: 'JAIL_CARD_USED', playerId: currentPlayer.id });
        break;
      }

      case 'END_TURN': {
        currentPlayer.hasRolled = false;
        currentPlayer.doublesCount = 0;
        
        // Safety: check if only one active player remains (guard against infinite loop)
        const activePlayers = nextState.players.filter((p: IMonopolyPlayer) => p.status === 'ACTIVE');
        if (activePlayers.length <= 1) {
          nextState.status = 'FINISHED';
          events.push({ type: 'GAME_OVER', winnerId: activePlayers.length === 1 ? activePlayers[0]!.id : null });
          break;
        }
        
        do {
          nextState.currentPlayerIndex = (nextState.currentPlayerIndex + 1) % nextState.players.length;
        } while (nextState.players[nextState.currentPlayerIndex]!.status === 'BANKRUPT');
        events.push({ type: 'TURN_ENDED', nextPlayerId: nextState.players[nextState.currentPlayerIndex]!.id });
        break;
      }

      case 'MORTGAGE_PROPERTY': {
        const space = BOARD_SPACES.find(s => s.id === action.propertyId);
        if (!space || !space.price) {
          return { success: false, error: 'NOT_PURCHASABLE' };
        }
        if (nextState.ownership[action.propertyId] !== currentPlayer.id) {
          return { success: false, error: 'NOT_OWNER' };
        }
        if (nextState.mortgagedProperties[action.propertyId]) {
          return { success: false, error: 'ALREADY_MORTGAGED' };
        }
        
        // Check for buildings in the color group
        if (space.colorGroup) {
          const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
          const hasBuildings = groupSpaces.some(s => (nextState.buildings[s.id] || 0) > 0);
          if (hasBuildings) {
            return { success: false, error: 'HAS_BUILDINGS' };
          }
        }
        
        const mortgageValue = Math.floor(space.price / 2);
        currentPlayer.money += mortgageValue;
        nextState.bankMoney -= mortgageValue;
        nextState.mortgagedProperties[action.propertyId] = true;
        events.push({ type: 'PROPERTY_MORTGAGED', propertyId: action.propertyId, playerId: currentPlayer.id, amount: mortgageValue });
        break;
      }

      case 'UNMORTGAGE_PROPERTY': {
        const space = BOARD_SPACES.find(s => s.id === action.propertyId);
        if (!space || !space.price) {
          return { success: false, error: 'NOT_PURCHASABLE' };
        }
        if (nextState.ownership[action.propertyId] !== currentPlayer.id) {
          return { success: false, error: 'NOT_OWNER' };
        }
        if (!nextState.mortgagedProperties[action.propertyId]) {
          return { success: false, error: 'NOT_MORTGAGED' };
        }
        
        const unmortgageCost = Math.floor((space.price / 2) * 1.1);
        if (currentPlayer.money < unmortgageCost) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }
        
        currentPlayer.money -= unmortgageCost;
        nextState.bankMoney += unmortgageCost;
        nextState.mortgagedProperties[action.propertyId] = false;
        events.push({ type: 'PROPERTY_UNMORTGAGED', propertyId: action.propertyId, playerId: currentPlayer.id, amount: unmortgageCost });
        break;
      }
      
      case 'BUY_HOUSE': {
        const space = BOARD_SPACES.find(s => s.id === action.propertyId);
        if (!space || space.type !== 'PROPERTY' || !space.colorGroup || !space.housePrice) {
          return { success: false, error: 'NOT_PURCHASABLE' };
        }
        if (nextState.ownership[space.id] !== currentPlayer.id) {
          return { success: false, error: 'NOT_OWNER' };
        }
        
        const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
        const ownsAll = groupSpaces.every(s => nextState.ownership[s.id] === currentPlayer.id);
        if (!ownsAll) {
          return { success: false, error: 'NOT_MONOPOLY' };
        }
        
        const anyMortgaged = groupSpaces.some(s => nextState.mortgagedProperties[s.id]);
        if (anyMortgaged) {
          return { success: false, error: 'HAS_MORTGAGED' };
        }
        
        const currentBuildings = nextState.buildings[space.id] || 0;
        if (currentBuildings >= 5) {
          return { success: false, error: 'MAX_BUILDINGS' };
        }
        
        const minBuildings = Math.min(...groupSpaces.map(s => nextState.buildings[s.id] || 0));
        if (currentBuildings > minBuildings) {
          return { success: false, error: 'EVEN_BUILD_RULE' };
        }
        
        if (currentBuildings === 4) {
          const totalHotels = Object.values(nextState.buildings).filter(b => b === 5).length;
          if (totalHotels >= 12) {
            return { success: false, error: 'MAX_BUILDINGS' };
          }
        } else {
          const totalHouses = Object.values(nextState.buildings).reduce((acc: number, b: number) => acc + (b > 0 && b < 5 ? b : 0), 0) as number;
          if (totalHouses >= 32) {
            return { success: false, error: 'MAX_BUILDINGS' };
          }
        }
        
        if (currentPlayer.money < space.housePrice) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }
        
        currentPlayer.money -= space.housePrice;
        nextState.bankMoney += space.housePrice;
        nextState.buildings[space.id] = currentBuildings + 1;
        events.push({ type: 'HOUSE_BOUGHT', propertyId: space.id, playerId: currentPlayer.id, amount: space.housePrice });
        break;
      }
      
      case 'SELL_HOUSE': {
        const space = BOARD_SPACES.find(s => s.id === action.propertyId);
        if (!space || space.type !== 'PROPERTY' || !space.colorGroup || !space.housePrice) {
          return { success: false, error: 'NOT_PURCHASABLE' };
        }
        if (nextState.ownership[space.id] !== currentPlayer.id) {
          return { success: false, error: 'NOT_OWNER' };
        }
        
        const currentBuildings = nextState.buildings[space.id] || 0;
        if (currentBuildings <= 0) {
          return { success: false, error: 'NO_BUILDINGS' };
        }
        
        const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
        const maxBuildings = Math.max(...groupSpaces.map(s => nextState.buildings[s.id] || 0));
        if (currentBuildings < maxBuildings) {
          return { success: false, error: 'EVEN_BUILD_RULE' };
        }
        
        const refund = Math.floor(space.housePrice / 2);
        currentPlayer.money += refund;
        nextState.bankMoney -= refund;
        nextState.buildings[space.id] = currentBuildings - 1;
        events.push({ type: 'HOUSE_SOLD', propertyId: space.id, playerId: currentPlayer.id, amount: refund });
        break;
      }
      
      case 'RESTART_GAME': {
        const playerIds = nextState.players.map((p: IMonopolyPlayer) => p.id);
        const resetState = MonopolyEngine.getInitialState(playerIds, rng);
        return { success: true, data: { nextState: resetState, events: [{ type: 'GAME_RESTARTED' }] } };
      }

      case 'PROPOSE_TRADE': {
        const allProps = [...action.offeredProperties, ...action.requestedProperties];
        for (const propId of allProps) {
          const space = BOARD_SPACES.find(s => s.id === propId);
          if (space && space.colorGroup) {
            const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
            const hasBuildings = groupSpaces.some(s => (nextState.buildings[s.id] || 0) > 0);
            if (hasBuildings) return { success: false, error: 'HAS_BUILDINGS_IN_GROUP' };
          }
        }
        
        // Simple ID generation for MVP
        const id = rng.next().toString(36).substring(2, 9);
        const trade = {
          id,
          fromPlayerId: action.playerId,
          toPlayerId: action.toPlayerId,
          offeredProperties: action.offeredProperties,
          requestedProperties: action.requestedProperties,
          offeredMoney: action.offeredMoney,
          requestedMoney: action.requestedMoney
        };
        nextState.activeTrade = trade;
        events.push({ type: 'TRADE_PROPOSED', trade });
        break;
      }

      case 'ACCEPT_TRADE': {
        const trade = nextState.activeTrade;
        if (trade && trade.toPlayerId === action.playerId) {
          const fromPlayer = nextState.players.find((p: IMonopolyPlayer) => p.id === trade.fromPlayerId);
          const toPlayer = nextState.players.find((p: IMonopolyPlayer) => p.id === trade.toPlayerId);
          if (fromPlayer && toPlayer) {
            // Re-validate sufficient funds at acceptance time
            if (fromPlayer.money < trade.offeredMoney) {
              nextState.activeTrade = null;
              return { success: false, error: 'PROPOSER_INSUFFICIENT_FUNDS' };
            }
            if (toPlayer.money < trade.requestedMoney) {
              return { success: false, error: 'INSUFFICIENT_FUNDS' };
            }
            
            fromPlayer.money -= trade.offeredMoney;
            fromPlayer.money += trade.requestedMoney;
            toPlayer.money -= trade.requestedMoney;
            toPlayer.money += trade.offeredMoney;

            trade.offeredProperties.forEach((propId: PropertyId) => {
              nextState.ownership[propId] = toPlayer.id;
              // Transfer mortgaged properties: new owner pays 10% interest immediately
              if (nextState.mortgagedProperties[propId]) {
                const space = BOARD_SPACES.find(s => s.id === propId);
                if (space && space.price) {
                  const interest = Math.ceil(Math.floor(space.price / 2) * 0.1);
                  toPlayer.money -= interest;
                  nextState.bankMoney += interest;
                }
              }
            });
            trade.requestedProperties.forEach((propId: PropertyId) => {
              nextState.ownership[propId] = fromPlayer.id;
              // Transfer mortgaged properties: new owner pays 10% interest immediately
              if (nextState.mortgagedProperties[propId]) {
                const space = BOARD_SPACES.find(s => s.id === propId);
                if (space && space.price) {
                  const interest = Math.ceil(Math.floor(space.price / 2) * 0.1);
                  fromPlayer.money -= interest;
                  nextState.bankMoney += interest;
                }
              }
            });

            nextState.activeTrade = null;
            events.push({ type: 'TRADE_ACCEPTED', tradeId: trade.id });
          }
        }
        break;
      }

      case 'REJECT_TRADE': {
        const trade = nextState.activeTrade;
        if (trade && trade.toPlayerId === action.playerId) {
          nextState.activeTrade = null;
          events.push({ type: 'TRADE_REJECTED', tradeId: trade.id });
        }
        break;
      }

      case 'CANCEL_TRADE': {
        const trade = nextState.activeTrade;
        if (trade && trade.fromPlayerId === action.playerId) {
          nextState.activeTrade = null;
          events.push({ type: 'TRADE_CANCELLED', tradeId: trade.id });
        }
        break;
      }

      case 'PAY_DEBT': {
        if (!currentPlayer.debt) {
          return { success: false, error: 'NO_DEBT' };
        }
        if (currentPlayer.money < currentPlayer.debt.amount) {
          return { success: false, error: 'INSUFFICIENT_FUNDS' };
        }
        
        currentPlayer.money -= currentPlayer.debt.amount;
        if (currentPlayer.debt.to === 'BANK') {
          nextState.bankMoney += currentPlayer.debt.amount;
        } else {
          const creditor = nextState.players.find((p: IMonopolyPlayer) => p.id === currentPlayer.debt!.to);
          if (creditor) creditor.money += currentPlayer.debt.amount;
        }
        currentPlayer.debt = null;
        events.push({ type: 'DEBT_CLEARED', playerId: currentPlayer.id });
        break;
      }

      case 'DECLARE_BANKRUPTCY': {
        if (!currentPlayer.debt) break;
        currentPlayer.status = 'BANKRUPT';
        
        const creditorId = currentPlayer.debt.to;
        const creditor = creditorId !== 'BANK' ? nextState.players.find((p: IMonopolyPlayer) => p.id === creditorId) : null;
        
        if (creditor) {
          creditor.money += currentPlayer.money;
        } else {
          nextState.bankMoney += currentPlayer.money;
        }
        currentPlayer.money = 0;
        
        (Object.keys(nextState.ownership) as PropertyId[]).forEach(propId => {
          if (nextState.ownership[propId] === currentPlayer.id) {
            if (creditor) {
              nextState.ownership[propId] = creditor.id;
              
              if (nextState.mortgagedProperties[propId]) {
                const space = BOARD_SPACES.find(s => s.id === propId);
                if (space && space.price) {
                  const mortgageValue = Math.floor(space.price / 2);
                  const interest = Math.ceil(mortgageValue * 0.1);
                  creditor.money -= interest;
                }
              }
            } else {
              delete nextState.ownership[propId];
              delete nextState.buildings[propId];
              delete nextState.mortgagedProperties[propId];
            }
          }
        });
        
        if (creditor) {
          creditor.getOutOfJailFreeCards.push(...currentPlayer.getOutOfJailFreeCards);
        } else {
          currentPlayer.getOutOfJailFreeCards.forEach((c: string) => {
            if (c.startsWith('chance')) nextState.chanceDeck.push(c);
            else nextState.chestDeck.push(c);
          });
        }
        currentPlayer.getOutOfJailFreeCards = [];
        currentPlayer.debt = null;
        
        events.push({ type: 'BANKRUPTCY_DECLARED', playerId: currentPlayer.id, to: creditorId });
        
        const activePlayers = nextState.players.filter((p: IMonopolyPlayer) => p.status === 'ACTIVE');
        if (activePlayers.length <= 1) {
          nextState.status = 'FINISHED';
          events.push({ type: 'GAME_OVER', winnerId: activePlayers.length === 1 ? activePlayers[0]!.id : null });
        } else {
          currentPlayer.hasRolled = false;
          currentPlayer.doublesCount = 0;
          do {
            nextState.currentPlayerIndex = (nextState.currentPlayerIndex + 1) % nextState.players.length;
          } while (nextState.players[nextState.currentPlayerIndex]!.status === 'BANKRUPT');
          events.push({ type: 'TURN_ENDED', nextPlayerId: nextState.players[nextState.currentPlayerIndex]!.id });
        }
        break;
      }

      default: {
        const _exhaustiveCheck: never = action;
        void _exhaustiveCheck;
        return { success: false, error: 'INVALID_ACTION_TYPE' };
      }
    }

    return { success: true, data: { nextState, events } };
  },

  isValidAction(currentState: Readonly<IMonopolyState>, action: Readonly<MonopolyAction>): boolean {
    if (action.type === 'RESTART_GAME') return true;
    if (currentState.status === 'FINISHED') return false;
    
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    if (!currentPlayer) return false;

    if (action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE') {
      return !!currentState.activeTrade && currentState.activeTrade.toPlayerId === action.playerId;
    }

    if (action.playerId !== currentPlayer.id) return false;
    
    if (action.type === 'PAY_DEBT') {
      return !!currentPlayer.debt && currentPlayer.money >= currentPlayer.debt.amount;
    }
    if (action.type === 'DECLARE_BANKRUPTCY') {
      return !!currentPlayer.debt;
    }
    if (currentPlayer.debt) {
      const allowedActions = ['SELL_HOUSE', 'MORTGAGE_PROPERTY', 'PROPOSE_TRADE', 'ACCEPT_TRADE', 'REJECT_TRADE', 'PAY_DEBT', 'DECLARE_BANKRUPTCY', 'RESTART_GAME'];
      if (!allowedActions.includes(action.type)) return false;
    }

    
    if (action.type === 'ROLL_DICE') return !currentPlayer.hasRolled;
    if (action.type === 'END_TURN') return currentPlayer.hasRolled;
    if (action.type === 'PAY_JAIL_FINE') {
      return currentPlayer.inJail && !currentPlayer.hasRolled && currentPlayer.money >= 50;
    }
    if (action.type === 'USE_JAIL_CARD') {
      return currentPlayer.inJail && !currentPlayer.hasRolled && currentPlayer.getOutOfJailFreeCards.length > 0;
    }
    if (action.type === 'MORTGAGE_PROPERTY') {
      const space = BOARD_SPACES.find(s => s.id === action.propertyId);
      if (!space || currentState.ownership[action.propertyId] !== currentPlayer.id || currentState.mortgagedProperties[action.propertyId]) {
        return false;
      }
      if (space!.colorGroup) {
        const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space!.colorGroup);
        const hasBuildings = groupSpaces.some(s => (currentState.buildings[s.id] || 0) > 0);
        if (hasBuildings) return false;
      }
      return true;
    }
    if (action.type === 'UNMORTGAGE_PROPERTY') {
      const space = BOARD_SPACES.find(s => s.id === action.propertyId);
      const cost = Math.floor((space?.price || 0) / 2 * 1.1);
      return currentState.ownership[action.propertyId] === currentPlayer.id && !!currentState.mortgagedProperties[action.propertyId] && currentPlayer.money >= cost;
    }
    if (action.type === 'BUY_HOUSE' || action.type === 'SELL_HOUSE') {
      const space = BOARD_SPACES.find(s => s.id === action.propertyId);
      if (!space || !space!.colorGroup || currentState.ownership[action.propertyId] !== currentPlayer.id) return false;
      const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space!.colorGroup);
      const ownsAll = groupSpaces.every(s => currentState.ownership[s.id] === currentPlayer.id);
      if (!ownsAll) return false;
      
      const currentBuildings = currentState.buildings[space!.id] || 0;
      if (action.type === 'BUY_HOUSE') {
        const anyMortgaged = groupSpaces.some(s => currentState.mortgagedProperties[s.id]);
        if (anyMortgaged || currentBuildings >= 5 || currentPlayer.money < (space!.housePrice || 0)) return false;
        const minBuildings = Math.min(...groupSpaces.map(s => currentState.buildings[s.id] || 0));
        if (currentBuildings > minBuildings) return false;
        
        if (currentBuildings === 4) {
          const totalHotels = Object.values(currentState.buildings).filter(b => b === 5).length;
          if (totalHotels >= 12) return false;
        } else {
          const totalHouses = Object.values(currentState.buildings).reduce((acc: number, b: number) => acc + (b > 0 && b < 5 ? b : 0), 0) as number;
          if (totalHouses >= 32) return false;
        }
      } else {
        if (currentBuildings <= 0) return false;
        const maxBuildings = Math.max(...groupSpaces.map(s => currentState.buildings[s.id] || 0));
        if (currentBuildings < maxBuildings) return false;
      }
      return true;
    }
    
    if (action.type === 'PROPOSE_TRADE') {
      if (currentState.activeTrade) return false; // Only one active trade at a time
      if (action.offeredMoney < 0 || action.requestedMoney < 0) return false;
      if (currentPlayer.money < action.offeredMoney) return false;
      
      const toPlayer = currentState.players.find(p => p.id === action.toPlayerId);
      if (!toPlayer || toPlayer.money < action.requestedMoney) return false;
      
      const ownsOffered = action.offeredProperties.every(p => currentState.ownership[p] === currentPlayer.id);
      const ownsRequested = action.requestedProperties.every(p => currentState.ownership[p] === action.toPlayerId);
      if (!ownsOffered || !ownsRequested) return false;

      const allProps = [...action.offeredProperties, ...action.requestedProperties];
      for (const propId of allProps) {
        const space = BOARD_SPACES.find(s => s.id === propId);
        if (space && space.colorGroup) {
          const groupSpaces = BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup);
          const hasBuildings = groupSpaces.some(s => (currentState.buildings[s.id] || 0) > 0);
          if (hasBuildings) return false;
        }
      }
      return true;
    }

    if (action.type === 'CANCEL_TRADE') {
      return !!currentState.activeTrade && currentState.activeTrade.fromPlayerId === action.playerId;
    }

    if (action.type === 'BUY_PROPERTY') {
      const space = BOARD_SPACES[currentPlayer.position];
      if (!space || space.type !== 'PROPERTY' || !space.price) return false;
      if (currentState.ownership[space.id]) return false;
      return currentPlayer.money >= space.price;
    }

    return false;
  }
};
