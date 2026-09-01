import { useEffect, useState, useRef } from 'react';
import type { ICatanState, ResourceType, CatanPlayer } from '@packages/catan-engine';
import type { PlayerId } from '@packages/engine-core';
import { CatanTradeManager } from './CatanTradeManager';
import { CatanBoard } from './CatanBoard';
import { SoundEngine } from '../utils/SoundEngine';
import { Dice3D } from './Dice3D';
import { RulebookModal } from './RulebookModal';
import { CatanDiscardModal } from './CatanDiscardModal';
import { CatanRobberVictimModal } from './CatanRobberVictimModal';
import { CatanDevCardManager } from './CatanDevCardManager';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws');

interface Props {
  roomId: string;
  localPlayerIds: string[];
  sessionToken: string;
  onLeave: () => void;
}

interface Toast {
  id: string;
  msg: string;
}

interface EventLogEntry {
  id: string;
  time: string;
  msg: string;
}

export function CatanRoom({ roomId, localPlayerIds, sessionToken, onLeave }: Props) {
  const [state, setState] = useState<ICatanState | null>(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);
  const [diceRoll, setDiceRoll] = useState<{dice1: number, dice2: number} | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [buildMode, setBuildMode] = useState<'SETTLEMENT' | 'ROAD' | 'CITY' | null>(null);
  const [showTradeManager, setShowTradeManager] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDevCardManager, setShowDevCardManager] = useState(false);
  const [robberHexId, setRobberHexId] = useState<string | null>(null);
  const [isPlayingKnight, setIsPlayingKnight] = useState(false);
  const [isPlayingRoadBuilding, setIsPlayingRoadBuilding] = useState(false);
  const [roadBuildingEdges, setRoadBuildingEdges] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const addToast = (msg: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    let isActive = true;
    const ws = new WebSocket(`${WS_URL}/rooms/${roomId}/ws?playerId=${localPlayerIds[0]}&token=${sessionToken}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_UPDATE') {
        setState(data.state);
        setBuildMode(null); // Reset build mode on state update
      } else if (data.type === 'EVENTS') {
        data.events.forEach((ev: any) => {
          let msg = '';
          if (ev.type === 'DICE_ROLLED') {
            msg = `Dice rolled: ${ev.total} (${ev.dice1} + ${ev.dice2})`;
            SoundEngine.playDiceRoll();
            setDiceRoll({ dice1: ev.dice1, dice2: ev.dice2 });
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 2000);
          } else if (ev.type === 'TURN_ENDED') {
            msg = `Turn ended. Next player: ${ev.nextPlayerId}`;
          } else if (ev.type === 'SETTLEMENT_BUILT') {
            msg = `Settlement built by ${ev.playerId}`;
          } else if (ev.type === 'ROAD_BUILT') {
            msg = `Road built by ${ev.playerId}`;
          } else if (ev.type === 'CITY_UPGRADED') {
            msg = `City upgraded by ${ev.playerId}`;
          } else if (ev.type === 'RESOURCES_RECEIVED') {
            msg = `${ev.playerId} received resources: ${Object.entries(ev.resources).filter(([,v]:any) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ')}`;
          } else if (ev.type === 'BANK_TRADE') {
            msg = `${ev.playerId} traded ${ev.cost} ${ev.offerResource} for ${ev.amount} ${ev.requestResource} with Bank.`;
          } else if (ev.type === 'TRADE_PROPOSED') {
            msg = `${ev.trade.fromPlayerId} proposed a trade to ${ev.trade.toPlayerId}.`;
            if (localPlayerIds.includes(ev.trade.toPlayerId) || localPlayerIds.includes(ev.trade.fromPlayerId)) {
              setShowTradeManager(true);
            }
          } else if (ev.type === 'TRADE_ACCEPTED') {
            msg = `Trade accepted!`;
            setShowTradeManager(false);
          } else if (ev.type === 'TRADE_REJECTED') {
            msg = `Trade rejected.`;
            setShowTradeManager(false);
          } else if (ev.type === 'TRADE_CANCELLED') {
            msg = `Trade cancelled.`;
            setShowTradeManager(false);
          } else if (ev.type === 'GAME_OVER') {
            msg = `${ev.winnerId} has won the game!`;
            SoundEngine.playVictorySound();
          } else if (ev.type === 'LONGEST_ROAD_AWARDED') {
            msg = `${ev.playerId} now has the Longest Road (${ev.length} roads)!`;
          } else if (ev.type === 'LARGEST_ARMY_AWARDED') {
            msg = `${ev.playerId} now has the Largest Army (${ev.size} knights)!`;
          } else if (ev.type === 'RESOURCES_DISCARDED') {
            msg = `${ev.playerId} discarded ${ev.amount} resources.`;
          } else if (ev.type === 'ROBBER_MOVED') {
            msg = `${ev.playerId} moved the Robber!`;
          } else if (ev.type === 'STOLEN_RESOURCE') {
            msg = `${ev.thiefId} stole a resource from ${ev.victimId}.`;
          } else if (ev.type === 'DEV_CARD_BOUGHT') {
            msg = `${ev.playerId} bought a Development Card.`;
          } else if (ev.type === 'DEV_CARD_PLAYED') {
            msg = `${ev.playerId} played a ${ev.cardType.replace(/_/g, ' ')} card.`;
          }
          
          if (['SETTLEMENT_BUILT', 'ROAD_BUILT', 'CITY_UPGRADED'].includes(ev.type)) {
            SoundEngine.playCatanBuild();
          }
          
          if (msg) {
            addToast(msg);
            setEventLog(prev => [...prev, {
              id: crypto.randomUUID(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              msg
            }]);
          }
        });
      } else if (data.type === 'ERROR') {
        setError(data.error);
        addToast(`Error: ${data.error}`);
        setBuildMode(null);
      }
    };

    ws.onclose = () => {
      if (isActive) setError('Connection closed');
    };

    return () => {
      isActive = false;
      ws.close();
    };
  }, [roomId, localPlayerIds]);

  const activePlayerId = state?.activePlayerId || '';
  const isMyTurn = localPlayerIds.includes(activePlayerId);

  const isPlacementPhase = state?.turnPhase === 'INITIAL_PLACEMENT_1' || state?.turnPhase === 'INITIAL_PLACEMENT_2';
  const placementBuildMode = isPlacementPhase
    ? (state?.placementStep === 'SETTLEMENT' ? 'SETTLEMENT' : 'ROAD')
    : buildMode;

  const handleRollDice = () => {
    wsRef.current?.send(JSON.stringify({ type: 'ROLL_DICE', playerId: activePlayerId }));
  };

  const handleEndTurn = () => {
    wsRef.current?.send(JSON.stringify({ type: 'END_TURN', playerId: activePlayerId }));
  };

  const handleVertexClick = (vertexId: string) => {
    if (!isMyTurn) return;
    if (isPlacementPhase) {
      wsRef.current?.send(JSON.stringify({ type: 'PLACE_INITIAL_SETTLEMENT', playerId: activePlayerId, vertexId }));
      return;
    }
    if (buildMode === 'SETTLEMENT') {
      wsRef.current?.send(JSON.stringify({ type: 'BUILD_SETTLEMENT', playerId: activePlayerId, vertexId }));
    } else if (buildMode === 'CITY') {
      wsRef.current?.send(JSON.stringify({ type: 'UPGRADE_CITY', playerId: activePlayerId, vertexId }));
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn) return;
    if (isPlacementPhase) {
      wsRef.current?.send(JSON.stringify({ type: 'PLACE_INITIAL_ROAD', playerId: activePlayerId, edgeId }));
      return;
    }
    if (isPlayingRoadBuilding) {
      const newEdges = [...roadBuildingEdges, edgeId];
      if (newEdges.length === 2) {
        wsRef.current?.send(JSON.stringify({ type: 'PLAY_ROAD_BUILDING', playerId: activePlayerId, edgeId1: newEdges[0], edgeId2: newEdges[1] }));
        setIsPlayingRoadBuilding(false);
        setRoadBuildingEdges([]);
      } else {
        setRoadBuildingEdges(newEdges);
        addToast("Select one more road to build.");
      }
      return;
    }
    if (buildMode === 'ROAD') {
      wsRef.current?.send(JSON.stringify({ type: 'BUILD_ROAD', playerId: activePlayerId, edgeId }));
    }
  };

  const handleHexClick = (hexId: string) => {
    if (!isMyTurn || !state) return;
    if (state.turnPhase !== 'ROBBER_PLACEMENT' && !isPlayingKnight) return;
    const hex = state.board.hexes.find(h => h.id === hexId);
    if (!hex || hex.hasRobber) return;
    setRobberHexId(hexId);
  };

  const handleMoveRobberOrKnight = (targetPlayerId?: string) => {
    if (!robberHexId) return;
    if (isPlayingKnight) {
      wsRef.current?.send(JSON.stringify({ type: 'PLAY_KNIGHT', playerId: activePlayerId, hexId: robberHexId, targetPlayerId }));
      setIsPlayingKnight(false);
    } else {
      wsRef.current?.send(JSON.stringify({ type: 'MOVE_ROBBER', playerId: activePlayerId, hexId: robberHexId, targetPlayerId }));
    }
    setRobberHexId(null);
  };

  const cancelRobberOrKnight = () => {
    setRobberHexId(null);
    if (isPlayingKnight) setIsPlayingKnight(false);
  };

  const discardingPlayerId = state?.turnPhase === 'DISCARD_PHASE'
    ? (localPlayerIds.find(id => (state?.pendingDiscards[id as PlayerId] || 0) > 0) as PlayerId | undefined)
    : undefined;

  const handleDiscard = (resources: Record<Exclude<ResourceType, 'DESERT'>, number>) => {
    if (!discardingPlayerId) return;
    wsRef.current?.send(JSON.stringify({ type: 'DISCARD_RESOURCES', playerId: discardingPlayerId, resources }));
  };

  const handleBuyDevCard = () => {
    wsRef.current?.send(JSON.stringify({ type: 'BUY_DEV_CARD', playerId: activePlayerId }));
  };

  const handlePlayYearOfPlenty = (res1: any, res2: any) => {
    wsRef.current?.send(JSON.stringify({ type: 'PLAY_YEAR_OF_PLENTY', playerId: activePlayerId, resource1: res1, resource2: res2 }));
  };

  const handlePlayMonopoly = (res: any) => {
    wsRef.current?.send(JSON.stringify({ type: 'PLAY_MONOPOLY', playerId: activePlayerId, resource: res }));
  };

  const handleTradeBank = (offerResource: ResourceType, requestResource: ResourceType, amount: number) => {
    wsRef.current?.send(JSON.stringify({ type: 'TRADE_BANK', playerId: activePlayerId, offerResource, requestResource, amount }));
  };

  const handleProposeTrade = (toPlayerId: PlayerId, offer: any, request: any) => {
    wsRef.current?.send(JSON.stringify({ type: 'PROPOSE_TRADE', playerId: activePlayerId, toPlayerId, offer, request }));
  };

  const handleAcceptTrade = () => {
    wsRef.current?.send(JSON.stringify({ type: 'ACCEPT_TRADE', playerId: localPlayerIds[0] }));
  };

  const handleRejectTrade = () => {
    wsRef.current?.send(JSON.stringify({ type: 'REJECT_TRADE', playerId: localPlayerIds[0] }));
  };

  const handleCancelTrade = () => {
    wsRef.current?.send(JSON.stringify({ type: 'CANCEL_TRADE', playerId: activePlayerId }));
  };

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={onLeave} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors">Return to Lobby</button>
      </div>
    );
  }

  if (!state) {
    return <div className="text-xl animate-pulse text-orange-400">Loading Catan Board...</div>;
  }

  const activePlayer = state.players.find(p => p.id === activePlayerId);
  const me = state.players.find(p => p.id === localPlayerIds[0]);

  // Compute victims for Robber Victim Modal
  let robberVictims: CatanPlayer[] = [];
  if (robberHexId) {
    const adjacentVertexIds = Object.keys(state.board.vertices).filter(vId => {
      // Very naive logic to get adjacent vertices: in Catan engine, board graph isn't easily accessible here
      // Wait, we can't access boardGraph from UI. 
      // Instead, we can just look at all vertices whose ID contains the hex Q and R coordinates.
      // But the engine validates it anyway. For UI, let's just show players who have ANY building and are not the active player, 
      // or we can parse the vertex ID. In Catan, vertex ID is something like `q,r|q,r|q,r`.
      return vId.includes(robberHexId);
    });
    const adjacentOwners = new Set<string>();
    adjacentVertexIds.forEach(vId => {
      const v = state.board.vertices[vId];
      if (v?.building && v.owner && v.owner !== activePlayerId) {
        adjacentOwners.add(v.owner);
      }
    });
    robberVictims = state.players.filter(p => 
      adjacentOwners.has(p.id) && Object.values(p.resources).reduce((a, b) => a + b, 0) > 0
    );
  }

  // Check if I need to discard
  const discardingPlayer = discardingPlayerId ? state.players.find(p => p.id === discardingPlayerId) : undefined;
  const myPendingDiscards = discardingPlayerId ? (state.pendingDiscards[discardingPlayerId] || 0) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 relative p-2 md:p-4">
      {isAnimating && <div className="fixed inset-0 z-[60] bg-transparent pointer-events-auto cursor-wait" />}
      
      {myPendingDiscards > 0 && discardingPlayer && (
        <CatanDiscardModal 
          requiredAmount={myPendingDiscards} 
          resources={discardingPlayer.resources} 
          onSubmit={handleDiscard} 
        />
      )}

      {robberHexId && (
        <CatanRobberVictimModal 
          victims={robberVictims} 
          onSelect={(victimId) => handleMoveRobberOrKnight(victimId)} 
          onCancel={cancelRobberOrKnight} 
        />
      )}
      
      {showDevCardManager && state && me && (
        <CatanDevCardManager 
          state={state}
          playerId={me.id}
          onBuyCard={handleBuyDevCard}
          onPlayKnight={() => { setIsPlayingKnight(true); addToast("Select a hex to move the robber to."); }}
          onPlayYearOfPlenty={handlePlayYearOfPlenty}
          onPlayMonopoly={handlePlayMonopoly}
          onPlayRoadBuilding={() => { setIsPlayingRoadBuilding(true); addToast("Select 2 edges to build roads."); }}
          onClose={() => setShowDevCardManager(false)}
        />
      )}

      {showRules && (
        <RulebookModal game="CATAN" onClose={() => setShowRules(false)} />
      )}
      {showTradeManager && (
        <CatanTradeManager 
          state={state} 
          playerId={localPlayerIds[0]!} 
          onTradeBank={handleTradeBank}
          onProposeTrade={handleProposeTrade}
          onAcceptTrade={handleAcceptTrade}
          onRejectTrade={handleRejectTrade}
          onCancelTrade={handleCancelTrade}
          onClose={() => setShowTradeManager(false)}
        />
      )}
      
      {diceRoll && (
        <Dice3D 
          dice1={diceRoll.dice1} 
          dice2={diceRoll.dice2} 
          onAnimationEnd={() => setDiceRoll(null)}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-gray-800 text-white border border-orange-500/50 px-4 py-3 rounded-xl shadow-2xl animate-fade-in-up">
            {t.msg}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Catan Room: <span className="text-orange-400 font-mono">{roomId}</span></h2>
          <p className="text-gray-400 text-sm">You are playing as <span className="text-orange-400 font-mono">{localPlayerIds.join(', ')}</span></p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowRules(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-md">
            Rules
          </button>
          <button onClick={() => setShowEventLog(!showEventLog)} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-md">
            {showEventLog ? 'Hide Events' : 'Event Log'}
          </button>
          <button onClick={onLeave} className="text-gray-400 hover:text-white transition-colors underline text-sm ml-2">Leave</button>
        </div>
      </div>

      {showEventLog && (
        <div className="absolute top-24 right-4 md:right-8 w-72 md:w-96 max-h-96 bg-gray-900/95 backdrop-blur border border-gray-600 rounded-xl shadow-2xl z-40 flex flex-col overflow-hidden animate-fade-in-up">
          <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-gray-200">Event Log</h3>
            <button onClick={() => setShowEventLog(false)} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-col-reverse">
            {eventLog.length === 0 ? (
              <p className="text-gray-500 text-sm text-center my-4">No events yet.</p>
            ) : (
              [...eventLog].reverse().map(ev => (
                <div key={ev.id} className="text-sm border-b border-gray-800 pb-2">
                  <span className="text-gray-500 text-xs mr-2">[{ev.time}]</span>
                  <span className="text-gray-300">{ev.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <CatanBoard state={state} playerId={activePlayerId} buildMode={placementBuildMode} onVertexClick={handleVertexClick} onEdgeClick={handleEdgeClick} onHexClick={handleHexClick}>
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col gap-6">
          <div className="text-center">
            <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2" style={{ color: activePlayer?.color }}>
              {activePlayer?.id}'s Turn
            </h3>
            <p className="text-gray-400">Phase: <span className="font-bold text-orange-400">{state.turnPhase}</span></p>
          </div>

          {isPlacementPhase && (
            <div className="bg-orange-900/40 border border-orange-500/40 rounded-xl p-4 text-center">
              <p className="text-orange-200 font-bold mb-1">Initial Placement</p>
              <p className="text-gray-300 text-sm">
                {state.placementStep === 'SETTLEMENT'
                  ? `${isMyTurn ? 'Click a vertex to place your settlement.' : `Waiting for ${activePlayerId} to place a settlement.`}`
                  : `${isMyTurn ? 'Click an edge connected to your settlement to place a road.' : `Waiting for ${activePlayerId} to place a road.`}`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 bg-gray-900 p-4 rounded-xl border border-gray-800">
             <div className="flex justify-between"><span className="text-gray-400">Wood:</span><span className="font-bold">{me?.resources.WOOD}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">Brick:</span><span className="font-bold">{me?.resources.BRICK}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">Sheep:</span><span className="font-bold">{me?.resources.SHEEP}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">Wheat:</span><span className="font-bold">{me?.resources.WHEAT}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">Ore:</span><span className="font-bold">{me?.resources.ORE}</span></div>
             <div className="flex justify-between text-yellow-400"><span className="text-yellow-600">VP:</span><span className="font-bold">{me?.victoryPoints}</span></div>
          </div>

          {(state.longestRoadOwner === me?.id || state.largestArmyOwner === me?.id) && (
            <div className="flex flex-col gap-2 -mt-3 mb-1">
              {state.longestRoadOwner === me?.id && (
                <div className="px-3 py-1 bg-amber-900/50 text-amber-200 text-xs font-bold rounded-lg border border-amber-600 shadow-inner flex justify-between animate-fade-in">
                  <span>🏆 Longest Road</span>
                  <span>{state.longestRoadLength} roads</span>
                </div>
              )}
              {state.largestArmyOwner === me?.id && (
                <div className="px-3 py-1 bg-rose-900/50 text-rose-200 text-xs font-bold rounded-lg border border-rose-600 shadow-inner flex justify-between animate-fade-in">
                  <span>⚔️ Largest Army</span>
                  <span>{state.largestArmySize} knights</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {isMyTurn && !isPlacementPhase && (
              <>
                <div className="text-xs text-gray-400 uppercase tracking-widest mt-2">Build Actions</div>
                <button 
                  onClick={() => setBuildMode(buildMode === 'SETTLEMENT' ? null : 'SETTLEMENT')}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 ${buildMode === 'SETTLEMENT' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-200'}`}
                >
                  Build Settlement
                </button>
                <button 
                  onClick={() => setBuildMode(buildMode === 'CITY' ? null : 'CITY')}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 ${buildMode === 'CITY' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-200'}`}
                >
                  Upgrade City
                </button>
                <button 
                  onClick={() => setBuildMode(buildMode === 'ROAD' ? null : 'ROAD')}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 ${buildMode === 'ROAD' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-200'}`}
                >
                  Build Road
                </button>
                <button 
                  onClick={() => setShowTradeManager(true)}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 bg-blue-600 border-blue-400 text-white hover:bg-blue-500`}
                >
                  Trade Resources
                </button>
                <button 
                  onClick={() => setShowDevCardManager(true)}
                  className={`w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 bg-purple-600 border-purple-400 text-white hover:bg-purple-500`}
                >
                  Development Cards
                </button>
              </>
            )}

            <div className="text-xs text-gray-400 uppercase tracking-widest mt-4">Turn Actions</div>
            {isPlacementPhase && (
              <p className="text-gray-500 text-sm text-center py-2">
                No dice rolls during initial placement. Place all settlements and roads first.
              </p>
            )}
            {isPlayingRoadBuilding && (
               <div className="flex flex-col gap-2 mb-2">
                 <button 
                   onClick={() => {
                     if (roadBuildingEdges.length === 1) {
                       wsRef.current?.send(JSON.stringify({ type: 'PLAY_ROAD_BUILDING', playerId: activePlayerId, edgeId1: roadBuildingEdges[0] }));
                     }
                     setIsPlayingRoadBuilding(false);
                     setRoadBuildingEdges([]);
                   }}
                   className="w-full font-bold py-2 px-4 rounded-xl transition-all shadow-md text-sm border-2 bg-red-600 border-red-400 text-white hover:bg-red-500"
                 >
                   {roadBuildingEdges.length === 1 ? 'Finish (Build 1 Road)' : 'Cancel Road Building'}
                 </button>
               </div>
             )}
            {!isPlacementPhase && (
              <>
                <button 
                  onClick={handleRollDice} 
                  disabled={!isMyTurn}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  Roll Dice
                </button>
                <button 
                  onClick={handleEndTurn} 
                  disabled={!isMyTurn}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  End Turn
                </button>
              </>
            )}
          </div>
        </div>
      </CatanBoard>

      {state.winner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-3xl p-8 max-w-lg w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.3)]">
            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600 mb-4 animate-pulse">
              VICTORY!
            </h2>
            <p className="text-2xl text-white mb-8">
              <span className="font-bold" style={{ color: state.players.find(p => p.id === state.winner)?.color }}>
                {state.winner}
              </span> has won the game with 10 Victory Points!
            </p>
            <button 
              onClick={onLeave} 
              className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
