import type { IGameEngine, IRandomProvider, Result, IStateTransition, PlayerId } from '@packages/engine-core';
import { GAME_CONFIGS } from '@packages/engine-core';
import { shuffleArray } from '@packages/engine-core';
import type { ScotlandYardState, ScotlandYardAction, ScotlandYardEvent, TransportType, ScotlandYardPlayer } from './types';
import { scotlandYardGraph } from './board';

function _isValidSingleMove(currentState: Readonly<ScotlandYardState>, player: ScotlandYardPlayer, targetNode: number, ticketType: TransportType, currentPosition: number): boolean {
      // 1. Check if node exists and edge exists for transport
      const node = scotlandYardGraph[currentPosition];
      if (!node) return false;

      let validDestinations = node[ticketType] || [];
      
      // Secret tickets can be used for any transport (including secret/boat)
      if (ticketType === 'secret') {
         validDestinations = [
            ...node.taxi,
            ...node.bus,
            ...node.underground,
            ...node.secret
         ];
      }

      if (!validDestinations.includes(targetNode)) {
        return false;
      }

      // 2. Detectives cannot move to a space occupied by another detective
      if (player.role === 'DETECTIVE') {
        const isOccupiedByDetective = currentState.players
          .some(p => p.role === 'DETECTIVE' && p.position === targetNode);
        if (isOccupiedByDetective) return false;
      }

      return true;
}

// Standard 18 starting positions
const STARTING_POSITIONS = [13, 26, 29, 34, 50, 53, 91, 94, 103, 112, 117, 132, 138, 141, 155, 174, 197, 198];
const MR_X_REVEAL_TURNS = [3, 8, 13, 18, 24];

export const ScotlandYardEngine: IGameEngine<ScotlandYardState, ScotlandYardAction, ScotlandYardEvent> = {
  getInitialState(playerIds: PlayerId[], rng: IRandomProvider): ScotlandYardState {
    if (playerIds.length < GAME_CONFIGS['scotland-yard'].minPlayers || playerIds.length > GAME_CONFIGS['scotland-yard'].maxPlayers) {
      throw new Error(`Scotland Yard requires ${GAME_CONFIGS['scotland-yard'].minPlayers} to ${GAME_CONFIGS['scotland-yard'].maxPlayers} players.`);
    }

    const shuffledPositions = shuffleArray(STARTING_POSITIONS, rng);
    const players: ScotlandYardPlayer[] = [];

    playerIds.forEach((id, index) => {
      const isMrX = index === 0;
      players.push({
        id,
        role: isMrX ? 'MR_X' : 'DETECTIVE',
        position: shuffledPositions[index]!,
        tickets: isMrX ? {
          taxi: 4,
          bus: 3,
          underground: 3,
          secret: playerIds.length - 1,
          double: 2
        } : {
          taxi: 10,
          bus: 8,
          underground: 4,
          secret: 0,
          double: 0
        }
      });
    });

    return {
      players,
      playerOrder: playerIds,
      activePlayerId: playerIds[0]!, // Mr X starts
      currentTurn: 1, // Turn 1
      mrXLog: [],
      mrXRevealedTurns: MR_X_REVEAL_TURNS,
      status: 'IN_PROGRESS'
    };
  },

  isValidAction(currentState: Readonly<ScotlandYardState>, action: Readonly<ScotlandYardAction>): boolean {
    if (currentState.status !== 'IN_PROGRESS') return false;

    const player = currentState.players.find(p => p.id === currentState.activePlayerId);
    if (!player) return false;

    if (action.type === 'MOVE') {
      if (player.tickets[action.payload.ticketType] <= 0) return false;
      return _isValidSingleMove(currentState, player, action.payload.targetNode, action.payload.ticketType, player.position);
    }

    if (action.type === 'DOUBLE_MOVE') {
      if (player.role !== 'MR_X') return false;
      if (!player.tickets.double || player.tickets.double <= 0) return false;

      const { move1, move2 } = action.payload;
      
      // Check first move tickets
      if (player.tickets[move1.ticketType] <= 0) return false;
      
      // Check second move tickets (handle using two of the same ticket)
      const ticket2Needed = move1.ticketType === move2.ticketType ? 2 : 1;
      if (player.tickets[move2.ticketType] < ticket2Needed) return false;

      // Validate paths
      if (!_isValidSingleMove(currentState, player, move1.targetNode, move1.ticketType, player.position)) return false;
      if (!_isValidSingleMove(currentState, player, move2.targetNode, move2.ticketType, move1.targetNode)) return false;

      return true;
    }

    return false;
  },

  reduce(currentState: Readonly<ScotlandYardState>, action: Readonly<ScotlandYardAction>, _rng: IRandomProvider): Result<IStateTransition<ScotlandYardState, ScotlandYardEvent>, string> {
    if (currentState.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Game is over.' };
    }

    if (!ScotlandYardEngine.isValidAction(currentState, action)) {
      return { success: false, error: 'Invalid action.' };
    }

    // Shallow clone state
    const nextState: ScotlandYardState = {
      ...currentState,
      players: currentState.players.map(p => ({ ...p, tickets: { ...p.tickets } })),
      mrXLog: [...currentState.mrXLog]
    };

    const events: ScotlandYardEvent[] = [];
    const currentPlayerId = currentState.activePlayerId;
    const playerIndex = nextState.players.findIndex(p => p.id === currentPlayerId);
    const nextPlayer = nextState.players[playerIndex]!;

    const moves = action.type === 'MOVE' ? [action.payload] : [action.payload.move1, action.payload.move2];
    
    if (action.type === 'DOUBLE_MOVE') {
      nextPlayer.tickets.double! -= 1;
    }

    for (const move of moves) {
      // Deduct ticket
      nextPlayer.tickets[move.ticketType] -= 1;
      
      // If detective, give the used ticket to Mr X
      if (nextPlayer.role === 'DETECTIVE') {
         const mrXId = nextState.playerOrder[0]!;
         const mrXIndex = nextState.players.findIndex(p => p.id === mrXId);
         if (mrXIndex !== -1) {
             nextState.players[mrXIndex]!.tickets[move.ticketType] += 1;
         }
      }

      // Move player
      nextPlayer.position = move.targetNode;

      if (nextPlayer.role === 'MR_X') {
         nextState.mrXLog.push(move.ticketType);
      }

      // Determine visibility for event payload based on log length for Mr. X
      let isVisible = true;
      if (nextPlayer.role === 'MR_X') {
          isVisible = nextState.mrXRevealedTurns.includes(nextState.mrXLog.length);
      }

      events.push({
        type: 'PLAYER_MOVED',
        payload: {
           playerId: currentPlayerId,
           targetNode: isVisible ? nextPlayer.position : undefined,
           ticketType: move.ticketType
        }
      });
      
      // Check if Mr. X was caught immediately after this move
      if (nextPlayer.role === 'MR_X') {
         const caught = nextState.players.some(p => p.role === 'DETECTIVE' && p.position === nextPlayer.position);
         if (caught) {
            nextState.status = 'FINISHED';
            nextState.winner = 'DETECTIVE';
            events.push({ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'Mr. X moved to a detective!' } });
            break; // Stop evaluating second move if caught
         }
      } else {
         const mrX = nextState.players.find(p => p.role === 'MR_X')!;
         if (nextPlayer.position === mrX.position) {
            nextState.status = 'FINISHED';
            nextState.winner = 'DETECTIVE';
            events.push({ type: 'GAME_OVER', payload: { winner: 'DETECTIVE', reason: 'Mr. X was caught!' } });
            break;
         }
      }
    }

    if (nextState.status === 'IN_PROGRESS') {
        // Check if Mr. X won by surviving 24 moves
        if (nextState.mrXLog.length >= 24) {
           nextState.status = 'FINISHED';
           nextState.winner = 'MR_X';
           events.push({ type: 'GAME_OVER', payload: { winner: 'MR_X', reason: 'Mr. X survived 24 rounds!' } });
        } else {
          // Next Turn Logic
          const currentPlayerIndex = nextState.playerOrder.indexOf(currentPlayerId);
          let nextPlayerIndex = (currentPlayerIndex + 1) % nextState.playerOrder.length;
          
          if (nextPlayerIndex === 0) {
              nextState.currentTurn += 1;
          }

          // Detectives with 0 tickets must be skipped. Check if all detectives are stuck.
          if (nextPlayerIndex !== 0) {
             let allStuck = true;
             
             // Check if any detective can move
             for (let i = 1; i < nextState.playerOrder.length; i++) {
                 const pId = nextState.playerOrder[i]!;
                 const p = nextState.players.find(player => player.id === pId)!;
                 const hasTickets = p.tickets.taxi > 0 || p.tickets.bus > 0 || p.tickets.underground > 0;
                 if (hasTickets) {
                     allStuck = false;
                     break;
                 }
             }

             if (allStuck) {
                 nextState.status = 'FINISHED';
                 nextState.winner = 'MR_X';
                 events.push({ type: 'GAME_OVER', payload: { winner: 'MR_X', reason: 'All detectives are stuck!' } });
             } else {
                 // Find next player who can move
                 let nextPId = nextState.playerOrder[nextPlayerIndex]!;
                 let p = nextState.players.find(player => player.id === nextPId)!;
                 while (nextPlayerIndex !== 0 && (p.tickets.taxi === 0 && p.tickets.bus === 0 && p.tickets.underground === 0)) {
                    nextPlayerIndex = (nextPlayerIndex + 1) % nextState.playerOrder.length;
                    if (nextPlayerIndex === 0) break; // wrapped to mr x
                    nextPId = nextState.playerOrder[nextPlayerIndex]!;
                    p = nextState.players.find(player => player.id === nextPId)!;
                 }
             }
          }
          
          if (nextState.status === 'IN_PROGRESS') {
              nextState.activePlayerId = nextState.playerOrder[nextPlayerIndex]!;
          }
        }
    }

    return { success: true, data: { nextState, events } };
  },

  getStateForPlayer(currentState: Readonly<ScotlandYardState>, playerId: PlayerId): ScotlandYardState {
    // Mr. X (and anyone assuming his role) sees his own true position.
    if (currentState.playerOrder[0] === playerId) return currentState;

    // On reveal turns or once the game is over, everyone may see Mr. X's location.
    const isRevealTurn = currentState.mrXRevealedTurns.includes(currentState.mrXLog.length);
    if (isRevealTurn || currentState.status === 'FINISHED') return currentState;

    // Scrub Mr. X's position for all other players. Position 0 does not exist on
    // the real board, so it renders as "hidden" on the map.
    return {
      ...currentState,
      players: currentState.players.map(p =>
        p.role === 'MR_X' ? { ...p, position: 0 } : p
      )
    };
  }
};
