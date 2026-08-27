import { scotlandYardGraph } from './board';
import type { ScotlandYardPlayer, ScotlandYardState, TransportType } from './types';

export function deduceTicketForMove(
  state: Readonly<ScotlandYardState>,
  player: ScotlandYardPlayer,
  currentPosition: number,
  targetNode: number
): TransportType | null {
  const nodeObj = scotlandYardGraph[currentPosition];
  if (!nodeObj) {
    return null; // Invalid current position
  }

  // Detectives cannot move to a node occupied by another detective
  if (player.role === 'DETECTIVE') {
    const isOccupied = state.players.some(p => p.role === 'DETECTIVE' && p.position === targetNode);
    if (isOccupied) {
      return null;
    }
  }

  // Auto-deduce ticket type based on availability and connections
  if (nodeObj.taxi.includes(targetNode) && player.tickets.taxi > 0) return 'taxi';
  if (nodeObj.bus.includes(targetNode) && player.tickets.bus > 0) return 'bus';
  if (nodeObj.underground.includes(targetNode) && player.tickets.underground > 0) return 'underground';
  
  if (player.role === 'MR_X' && player.tickets.secret > 0) {
    const isReachable = nodeObj.taxi.includes(targetNode) || 
                        nodeObj.bus.includes(targetNode) || 
                        nodeObj.underground.includes(targetNode) || 
                        nodeObj.secret.includes(targetNode);
    if (isReachable) return 'secret';
  }

  return null;
}
