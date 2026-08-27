import { useEffect, useState, useRef } from 'react';
import type { ScotlandYardState, TransportType } from '@packages/scotland-yard-engine';
import { deduceTicketForMove } from '@packages/scotland-yard-engine';
import { ScotlandYardBoard } from './ScotlandYardBoard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws');

interface Props {
  roomId: string;
  localPlayerIds: string[];
  onLeave: () => void;
}

export function ScotlandYardRoom({ roomId, localPlayerIds, onLeave }: Props) {
  const [state, setState] = useState<ScotlandYardState | null>(null);
  const [error, setError] = useState('');
  const [nodeInput, setNodeInput] = useState('');
  const [pendingDoubleMove, setPendingDoubleMove] = useState<{ targetNode: number, ticketType: TransportType } | null>(null);
  const [isDoubleMoveActive, setIsDoubleMoveActive] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TransportType | 'auto'>('auto');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isActive = true;
    const ws = new WebSocket(`${WS_URL}/rooms/${roomId}/ws?playerId=${localPlayerIds[0]}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_UPDATE') {
        if (isActive) setState(data.state);
      } else if (data.type === 'ACTION_REJECTED') {
        alert('Action Rejected: ' + data.reason);
      } else if (data.type === 'GAME_EVENT') {
        // Handle events like GAME_OVER, PLAYER_MOVED, etc.
        const ev = data.event;
        if (ev.type === 'GAME_OVER') {
           setTimeout(() => {
             alert(`Game Over! ${ev.payload.winner} wins. ${ev.payload.reason}`);
           }, 100);
        }
      }
    };

    ws.onclose = () => {
      if (isActive) setError('Connection lost to game room.');
    };

    return () => {
      isActive = false;
      ws.close();
    };
  }, [roomId, localPlayerIds]);

  const dispatch = (action: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
    }
  };

  const handleMoveClick = (node: number, ticketType: TransportType) => {
     // If we are in the middle of a double move
     if (pendingDoubleMove) {
       dispatch({
         type: 'DOUBLE_MOVE',
         payload: {
           move1: pendingDoubleMove,
           move2: { targetNode: node, ticketType }
         }
       });
       setPendingDoubleMove(null);
       setIsDoubleMoveActive(false);
     } else if (isDoubleMoveActive) {
       // Started double move, this is move 1. 
       setPendingDoubleMove({ targetNode: node, ticketType });
     } else {
       dispatch({
         type: 'MOVE',
         payload: { targetNode: node, ticketType }
       });
     }
  };

  const handleNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state) return;
    const activePlayer = state.players.find(p => p.id === state.activePlayerId);
    const isLocalActive = activePlayer && localPlayerIds.includes(activePlayer.id);
    if (!activePlayer || !isLocalActive) return;

    const targetNode = parseInt(nodeInput, 10);
    if (isNaN(targetNode)) {
      alert("Invalid node number");
      return;
    }

    const currentNode = pendingDoubleMove ? pendingDoubleMove.targetNode : activePlayer.position;
    
    let ticketToUse: TransportType | null = null;
    if (selectedTicket !== 'auto') {
      ticketToUse = selectedTicket;
    } else {
      ticketToUse = deduceTicketForMove(state, activePlayer, currentNode, targetNode);
    }

    if (!ticketToUse) {
      alert("Invalid move: Cannot reach node " + targetNode + " with the selected ticket, node is occupied, or insufficient tickets.");
      return;
    }

    handleMoveClick(targetNode, ticketToUse);
    setNodeInput('');
    setSelectedTicket('auto');
  };

  const toggleDoubleMove = () => {
    setIsDoubleMoveActive(!isDoubleMoveActive);
    setPendingDoubleMove(null);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl text-red-500 font-bold">{error}</h2>
        <button onClick={onLeave} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded">Back to Lobby</button>
      </div>
    );
  }

  if (!state) {
    return <div className="text-xl text-gray-400 animate-pulse">Loading Scotland Yard...</div>;
  }

  const activePlayer = state.players.find(p => p.id === state.activePlayerId);
  const isLocalActive = activePlayer && localPlayerIds.includes(activePlayer.id);

  return (
    <div className="w-full max-w-[95vw] flex-1 min-h-0 flex gap-4">
      {/* Sidebar: Turn info & Tickets */}
      <div className="w-96 min-w-96 shrink-0 bg-gray-800 rounded-2xl p-4 flex flex-col shadow-xl border border-gray-700 overflow-y-auto">
         <h2 className="text-xl font-bold mb-2 border-b border-gray-700 pb-2">Turn {state.currentTurn}</h2>
         <div className="mb-4">
           <span className="text-sm text-gray-400">Current Player:</span>
           <div className={`text-lg font-bold ${activePlayer?.role === 'MR_X' ? 'text-gray-200' : 'text-blue-400'}`}>
             {activePlayer?.role === 'MR_X' ? 'Mr. X' : `Detective (${activePlayer?.id})`}
           </div>
           {isLocalActive && (
             <div className="mt-1 text-xs bg-green-900/50 text-green-400 py-1 px-2 rounded font-semibold text-center border border-green-800">
               It's your turn!
             </div>
           )}
         </div>

         {/* Mr. X Travel Log */}
         <div className="mb-4 bg-gray-900 p-3 rounded-xl border border-gray-700">
           <div className="font-semibold text-sm border-b border-gray-700 pb-1 mb-2 text-gray-300">Mr. X Travel Log</div>
           <div className="flex flex-wrap gap-1">
             {state.mrXLog.map((ticket, idx) => (
               <div key={idx} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold border border-gray-700 ${
                 ticket === 'taxi' ? 'bg-yellow-500 text-black' :
                 ticket === 'bus' ? 'bg-teal-500 text-white' :
                 ticket === 'underground' ? 'bg-red-500 text-white' :
                 'bg-black text-white border-gray-500' // secret
               }`}>
                 {idx + 1}
               </div>
             ))}
             {state.mrXLog.length === 0 && <span className="text-xs text-gray-500">No moves yet</span>}
           </div>
         </div>

         {/* Local Player Ticket Inventory */}
         {localPlayerIds.map(localId => {
            const p = state.players.find(player => player.id === localId);
            if (!p) return null;
            return (
              <div key={localId} className="flex flex-col gap-2 bg-gray-900 p-3 rounded-xl border border-gray-700 mb-4">
                <div className="font-semibold text-sm border-b border-gray-700 pb-1 mb-1">
                   Your Tickets ({p.role})
                </div>
                
                <div className="flex justify-between items-center bg-gray-800 p-1.5 rounded text-sm">
                   <span className="text-yellow-500 font-bold">Taxi</span>
                   <span className="bg-gray-700 px-2 rounded-full">{p.tickets.taxi}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-800 p-1.5 rounded text-sm">
                   <span className="text-teal-500 font-bold">Bus</span>
                   <span className="bg-gray-700 px-2 rounded-full">{p.tickets.bus}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-800 p-1.5 rounded text-sm">
                   <span className="text-red-500 font-bold">Underground</span>
                   <span className="bg-gray-700 px-2 rounded-full">{p.tickets.underground}</span>
                </div>
                
                {p.role === 'MR_X' && (
                  <>
                    <div className="flex justify-between items-center bg-gray-800 p-1.5 rounded text-sm mt-2">
                       <span className="text-gray-300 font-bold tracking-widest">SECRET</span>
                       <span className="bg-gray-700 px-2 rounded-full">{p.tickets.secret}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-800 p-1.5 rounded text-sm">
                       <span className="text-purple-400 font-bold tracking-widest">2x MOVE</span>
                       <span className="bg-gray-700 px-2 rounded-full">{p.tickets.double}</span>
                    </div>
                  </>
                )}
              </div>
            );
         })}

         {/* Action Controls */}
         <div className="flex-1 mt-4">
            <h3 className="font-bold text-sm mb-2 text-gray-400 uppercase">Enter Destination Node</h3>
            
            {activePlayer?.role === 'MR_X' && (
              <div className="mb-2">
                <select 
                  value={selectedTicket} 
                  onChange={(e) => setSelectedTicket(e.target.value as TransportType | 'auto')}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  disabled={!isLocalActive}
                >
                  <option value="auto">Auto-deduce Ticket</option>
                  <option value="taxi">Taxi</option>
                  <option value="bus">Bus</option>
                  <option value="underground">Underground</option>
                  <option value="secret">Secret</option>
                </select>
              </div>
            )}

            <form onSubmit={handleNodeSubmit} className="flex gap-2">
              <input
                type="number"
                value={nodeInput}
                onChange={(e) => setNodeInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                placeholder="Node #"
                disabled={!isLocalActive}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!isLocalActive || !nodeInput}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Move
              </button>
            </form>
            
            {activePlayer?.role === 'MR_X' && (activePlayer?.tickets.double ?? 0) > 0 && (
               <button
                 disabled={!isLocalActive}
                 onClick={toggleDoubleMove}
                 className={`
                   mt-4 w-full py-2 rounded font-bold uppercase tracking-wider text-sm border-2 transition-all
                   ${isDoubleMoveActive ? 'border-white text-white bg-purple-700' : 'border-purple-800 text-purple-300 bg-purple-900/50 hover:bg-purple-800'}
                 `}
               >
                  {isDoubleMoveActive ? 'Cancel Double Move' : 'Use Double Move'}
               </button>
            )}

            {isDoubleMoveActive && !pendingDoubleMove && (
              <div className="mt-4 p-2 bg-purple-900/50 border border-purple-500 rounded text-sm text-purple-200">
                Double Move active: Enter destination for Move 1.
              </div>
            )}
            
            {pendingDoubleMove && (
              <div className="mt-4 p-2 bg-purple-900/50 border border-purple-500 rounded text-sm text-purple-200">
                Move 1 submitted. Enter destination for Move 2.
              </div>
            )}
         </div>

         <div className="mt-auto pt-4 border-t border-gray-700 flex flex-col gap-2">
           <button onClick={onLeave} className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 py-2 rounded font-semibold border border-red-800">
             Leave Game
           </button>
         </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex flex-col">
         <ScotlandYardBoard 
            state={state} 
            localPlayerIds={localPlayerIds}
         />
      </div>
    </div>
  );
}
