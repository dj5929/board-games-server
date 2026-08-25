import { useEffect, useState, useRef } from 'react';
import type { IMonopolyState } from '@packages/monopoly-engine';
import { BOARD_SPACES } from '@packages/monopoly-engine';
import { MonopolyBoard } from './MonopolyBoard';
import { PropertyManager } from './PropertyManager';
import { TradeManager } from './TradeManager';
import { TradeNotification } from './TradeNotification';
import { SoundEngine } from '../utils/SoundEngine';
import { Dice3D } from './Dice3D';
import { RulebookModal } from './RulebookModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws');

interface Props {
  roomId: string;
  localPlayerIds: string[];
  onLeave: () => void;
}

interface Toast {
  id: number;
  msg: string;
}

export function GameRoom({ roomId, localPlayerIds, onLeave }: Props) {
  const [state, setState] = useState<IMonopolyState | null>(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [drawnCard, setDrawnCard] = useState<{ deck: 'CHANCE' | 'CHEST', text: string } | null>(null);
  const [eventLog, setEventLog] = useState<{ id: number, time: string, msg: string }[]>([]);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showTradeManager, setShowTradeManager] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [diceRoll, setDiceRoll] = useState<{dice1: number, dice2: number} | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingStateRef = useRef<IMonopolyState | null>(null);
  const stateTimerRef = useRef<number | null>(null);

  const addToast = (msg: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    let isActive = true;
    const ws = new WebSocket(`${WS_URL}/rooms/${roomId}/ws?playerId=${localPlayerIds[0]}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_UPDATE') {
        pendingStateRef.current = data.state;
        if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
        // Default commit delay to allow EVENTS to arrive and optionally extend the delay
        stateTimerRef.current = window.setTimeout(() => {
          setState(pendingStateRef.current);
          pendingStateRef.current = null;
        }, 50);
      } else if (data.type === 'EVENTS') {
        const processEvents = (events: any[]) => {
          const newEvents: { id: number, time: string, msg: string }[] = [];
          events.forEach((ev: any) => {
            let msg = '';
            if (ev.type === 'PROPERTY_BOUGHT') {
              const space = BOARD_SPACES.find(s => s.id === ev.propertyId);
              msg = `${ev.playerId} bought ${space?.name} for $${ev.price}`;
              SoundEngine.playCashRegister();
            } else if (ev.type === 'RENT_PAID') {
              msg = `${ev.fromPlayerId} paid $${ev.amount} rent to ${ev.toPlayerId}`;
              SoundEngine.playCashRegister();
            } else if (ev.type === 'PASSED_GO') {
              msg = `${ev.playerId} passed GO and collected $${ev.amount}!`;
              SoundEngine.playCashRegister();
            } else if (ev.type === 'TAX_PAID') {
              msg = `${ev.playerId} paid $${ev.amount} for ${ev.taxName}.`;
              SoundEngine.playCashRegister();
            } else if (ev.type === 'WENT_TO_JAIL') {
              msg = `${ev.playerId} went to Jail! (${ev.reason})`;
              SoundEngine.playJailBars();
            } else if (ev.type === 'GAME_RESTARTED') {
              msg = `The game was restarted.`;
              setSelectedPropertyId(null);
            } else if (ev.type === 'DICE_ROLLED') {
              const space = BOARD_SPACES.find(s => s.id === BOARD_SPACES[ev.position]?.id);
              msg = `${ev.playerId} rolled a ${ev.dice1 + ev.dice2} and landed on ${space?.name}.`;
              SoundEngine.playDiceRoll();
              setDiceRoll({ dice1: ev.dice1, dice2: ev.dice2 });
              setIsAnimating(true);
              
              // Extend the state commit timer so the board doesn't update until dice finishes
              if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
              stateTimerRef.current = window.setTimeout(() => {
                if (pendingStateRef.current) {
                  setState(pendingStateRef.current);
                  pendingStateRef.current = null;
                }
              }, 1500);

              setTimeout(() => {
                setIsAnimating(false);
              }, 1500 + (ev.dice1 + ev.dice2) * 200); // Wait for dice to roll and token to move
            } else if (ev.type === 'CARD_DRAWN') {
              msg = `${ev.playerId} drew a ${ev.deck === 'CHANCE' ? 'Chance' : 'Community Chest'} card: "${ev.text}"`;
              if (localPlayerIds.includes(ev.playerId)) {
                setDrawnCard({ deck: ev.deck, text: ev.text });
              }
            } else if (ev.type === 'JAIL_CARD_USED') {
              msg = `${ev.playerId} used a Get Out of Jail Free card!`;
            }
            if (msg) {
              addToast(msg);
              newEvents.push({ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg });
            }
          });
          if (newEvents.length > 0) {
            setEventLog(prev => [...prev, ...newEvents]);
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasDiceRoll = data.events.some((ev: any) => ev.type === 'DICE_ROLLED');
        if (hasDiceRoll) {
          const diceEvent = data.events.find((ev: any) => ev.type === 'DICE_ROLLED');
          const otherEvents = data.events.filter((ev: any) => ev.type !== 'DICE_ROLLED');
          
          processEvents([diceEvent]);
          if (otherEvents.length > 0) {
            setTimeout(() => {
              processEvents(otherEvents);
            }, 1500);
          }
        } else {
          processEvents(data.events);
        }
      } else if (data.type === 'ERROR') {
        setError(data.error);
      }
    };

    ws.onclose = () => {
      if (isActive) {
        setError('Connection closed');
      }
    };

    return () => {
      isActive = false;
      ws.close();
    };
  }, [roomId, localPlayerIds]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state && localPlayerIds.includes(state.players[state.currentPlayerIndex].id)) {
      SoundEngine.playTurnChime();
    }
  }, [state?.currentPlayerIndex, localPlayerIds]);

  // Use the active player's ID for all dispatched actions when it's our turn
  const activePlayerId = state ? state.players[state.currentPlayerIndex].id : '';

  const handleRollDice = () => {
    wsRef.current?.send(JSON.stringify({ type: 'ROLL_DICE', playerId: activePlayerId }));
  };

  const handleEndTurn = () => {
    wsRef.current?.send(JSON.stringify({ type: 'END_TURN', playerId: activePlayerId }));
  };

  const handleBuyProperty = () => {
    wsRef.current?.send(JSON.stringify({ type: 'BUY_PROPERTY', playerId: activePlayerId }));
  };

  const handlePayJailFine = () => {
    wsRef.current?.send(JSON.stringify({ type: 'PAY_JAIL_FINE', playerId: activePlayerId }));
  };

  const handleUseJailCard = () => {
    wsRef.current?.send(JSON.stringify({ type: 'USE_JAIL_CARD', playerId: activePlayerId }));
  };

  const handlePropertyAction = (actionType: string, propertyId: string) => {
    wsRef.current?.send(JSON.stringify({ type: actionType, playerId: activePlayerId, propertyId }));
  };

  const handleRestartGame = () => {
    wsRef.current?.send(JSON.stringify({ type: 'RESTART_GAME', playerId: localPlayerIds[0] }));
    setShowRestartConfirm(false);
  };

  const handlePayDebt = () => {
    wsRef.current?.send(JSON.stringify({ type: 'PAY_DEBT', playerId: activePlayerId }));
  };

  const handleDeclareBankruptcy = () => {
    wsRef.current?.send(JSON.stringify({ type: 'DECLARE_BANKRUPTCY', playerId: activePlayerId }));
  };

  const handleProposeTrade = (trade: any) => {
    wsRef.current?.send(JSON.stringify({ type: 'PROPOSE_TRADE', playerId: activePlayerId, ...trade }));
    setShowTradeManager(false);
  };

  const handleAcceptTrade = () => {
    if (state?.activeTrade) {
      wsRef.current?.send(JSON.stringify({ type: 'ACCEPT_TRADE', playerId: state.activeTrade.toPlayerId }));
    }
  };

  const handleRejectTrade = () => {
    if (state?.activeTrade) {
      wsRef.current?.send(JSON.stringify({ type: 'REJECT_TRADE', playerId: state.activeTrade.toPlayerId }));
    }
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
    return <div className="text-xl animate-pulse text-blue-400">Connecting to room...</div>;
  }

  const isMyTurn = localPlayerIds.includes(activePlayerId);
  const activePlayer = state.players[state.currentPlayerIndex];
  const activePlayerSpace = BOARD_SPACES[activePlayer.position];
  
  let canBuy = false;
  let currentSpace = null;
  if (isMyTurn) {
    currentSpace = activePlayerSpace;
    if (currentSpace && currentSpace.type === 'PROPERTY') {
      const isOwned = !!state.ownership[currentSpace.id];
      if (!isOwned && (currentSpace.price || 0) <= activePlayer.money) {
        canBuy = true;
      }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 relative p-2 md:p-4">
      {isAnimating && (
        <div className="fixed inset-0 z-[60] bg-transparent pointer-events-auto cursor-wait" />
      )}
      
      {showRules && (
        <RulebookModal game="MONOPOLY" onClose={() => setShowRules(false)} />
      )}
      
      {diceRoll && (
        <Dice3D 
          dice1={diceRoll.dice1} 
          dice2={diceRoll.dice2} 
          onAnimationEnd={() => setDiceRoll(null)}
        />
      )}

      {/* Toast Notifications Overlay */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-gray-800 text-white border border-gray-600 px-4 py-3 rounded-xl shadow-2xl animate-fade-in-up">
            {t.msg}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Room: <span className="text-blue-400 font-mono">{roomId}</span></h2>
          <p className="text-gray-400 text-sm">You are playing as <span className="text-blue-400 font-mono">{localPlayerIds.join(', ')}</span></p>
        </div>
        <div className="flex gap-2 md:gap-4 items-center">
          <button onClick={() => setShowRules(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-bold shadow-md">
            Rules
          </button>
          <button onClick={() => setShowEventLog(!showEventLog)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-bold shadow-md">
            {showEventLog ? 'Hide Events' : 'Event Log'}
          </button>
          <button onClick={() => setShowRestartConfirm(true)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-bold shadow-md">
            Restart
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

      {showRestartConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-fade-in-up">
            <h3 className="text-xl font-bold mb-2">Restart Game?</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to restart the game? All progress will be lost and the board will be reset.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleRestartGame}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-md transition-colors"
              >
                Yes, Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {state.status === 'FINISHED' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border-2 border-yellow-500 p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-lg w-full animate-fade-in-up text-center">
            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 mb-4 uppercase tracking-widest">
              Game Over
            </h1>
            <p className="text-gray-300 text-lg md:text-xl mb-8">
              The game has ended! Only one active player remains.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={onLeave}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg transition-transform transform hover:scale-105 active:scale-95 text-xl w-full"
              >
                Return to Home Screen
              </button>
              <button 
                onClick={handleRestartGame}
                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition-colors w-full"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {showTradeManager && (
        <TradeManager 
          state={state} 
          activePlayerId={activePlayerId} 
          onProposeTrade={handleProposeTrade} 
          onCancel={() => setShowTradeManager(false)} 
        />
      )}

      {state.activeTrade && localPlayerIds.includes(state.activeTrade.toPlayerId) && (
        <TradeNotification 
          state={state} 
          onAccept={handleAcceptTrade} 
          onReject={handleRejectTrade} 
        />
      )}

      {drawnCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border-4 p-8 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-fade-in-up flex flex-col items-center text-center ${
            drawnCard.deck === 'CHANCE' ? 'bg-orange-100 border-orange-500' : 'bg-yellow-100 border-yellow-500'
          }`}>
            <h3 className={`text-3xl font-black mb-6 uppercase tracking-widest ${
              drawnCard.deck === 'CHANCE' ? 'text-orange-600' : 'text-yellow-600'
            }`}>
              {drawnCard.deck === 'CHANCE' ? 'Chance' : 'Community Chest'}
            </h3>
            <p className="text-gray-800 text-lg md:text-xl font-medium mb-8 leading-relaxed">
              {drawnCard.text}
            </p>
            <button 
              onClick={() => setDrawnCard(null)}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold shadow-md transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 items-center w-full">
        <div className="w-full flex justify-center">
          <MonopolyBoard state={state} playerId={activePlayerId}>
            <div className="flex flex-col items-center justify-center w-full h-full p-2 md:p-4 text-center overflow-hidden">
              <div className="mb-4 md:mb-8">
                <h3 className="text-2xl md:text-4xl font-black text-gray-800 mb-1 md:mb-2 uppercase tracking-widest">
                  {activePlayer.id}'s Turn
                </h3>
                <div className="flex flex-col items-center gap-3 mb-2 md:mb-4">
                  <div className="text-xl md:text-3xl font-bold text-green-600 bg-green-100 inline-block px-4 py-1 rounded-full border-2 border-green-300 shadow-sm">
                    ${activePlayer.money}
                  </div>
                  {activePlayer.debt && (
                    <div className="text-sm md:text-lg font-bold text-red-600 bg-red-100 inline-block px-4 py-1 rounded-full border-2 border-red-300 shadow-xl ring-4 ring-red-500 animate-pulse">
                      🚨 Debt: ${activePlayer.debt.amount} to {activePlayer.debt.to} 🚨
                    </div>
                  )}
                </div>
                <div className="text-gray-600 text-sm md:text-lg">
                  On <span className="font-bold text-gray-900">{activePlayerSpace?.name}</span>
                </div>
                
                {/* Active Player Properties */}
                <div className="mt-4 max-w-sm mx-auto">
                   <div className="flex flex-wrap justify-center gap-1.5">
                     {Object.entries(state.ownership).filter(([, ownerId]) => ownerId === activePlayer.id).map(([propId]) => {
                       const space = BOARD_SPACES.find(s => s.id === propId);
                       const isSelected = selectedPropertyId === propId;
                       return (
                         <button 
                           key={propId} 
                           onClick={() => setSelectedPropertyId(isSelected ? null : propId)}
                           className={`text-[10px] md:text-xs border px-2 py-0.5 rounded shadow-sm transition-colors cursor-pointer ${
                             isSelected 
                               ? 'bg-purple-600 border-purple-400 text-white' 
                               : 'bg-purple-900/60 border-purple-500/40 text-purple-100 hover:bg-purple-800'
                           }`}
                         >
                           {space?.name}
                         </button>
                       );
                     })}
                   </div>
                   {selectedPropertyId && (
                     <div className="flex justify-center w-full">
                       <PropertyManager 
                         propertyId={selectedPropertyId}
                         state={state}
                         activePlayerId={activePlayerId}
                         isMyTurn={isMyTurn}
                         onAction={handlePropertyAction}
                         onClose={() => setSelectedPropertyId(null)}
                       />
                     </div>
                   )}
                </div>
              </div>

                <div className="flex flex-col gap-3 w-full max-w-xs md:max-w-sm">
                  {isMyTurn && canBuy && currentSpace && (
                    <button 
                      onClick={handleBuyProperty} 
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-extrabold py-3 md:py-4 px-4 md:px-6 rounded-xl transition-all shadow-lg hover:shadow-green-500/25 active:scale-95 border border-green-400/50 text-sm md:text-base"
                    >
                      Buy {currentSpace.name} (${currentSpace.price})
                    </button>
                  )}

                  {isMyTurn && activePlayer.inJail && !activePlayer.hasRolled && activePlayer.money >= 50 && (
                    <button 
                      onClick={handlePayJailFine} 
                      className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold py-2 md:py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-red-500/25 active:scale-95 border border-red-400/50 text-sm md:text-base"
                    >
                      Pay $50 Fine
                    </button>
                  )}

                  {isMyTurn && activePlayer.inJail && !activePlayer.hasRolled && activePlayer.getOutOfJailFreeCards.length > 0 && (
                    <button 
                      onClick={handleUseJailCard} 
                      className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-extrabold py-2 md:py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-yellow-500/25 active:scale-95 border border-yellow-400/50 text-sm md:text-base"
                    >
                      Use Get Out of Jail Free Card
                    </button>
                  )}

                  {isMyTurn && (
                    <button 
                      onClick={() => setShowTradeManager(true)}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold py-2 md:py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95 border border-purple-400/50 text-sm md:text-base mb-3"
                    >
                      Propose Trade
                    </button>
                  )}
                  
                  {isMyTurn && activePlayer.debt && (
                    <div className="flex gap-3 w-full mb-3">
                      <button 
                        onClick={handlePayDebt}
                        disabled={activePlayer.money < activePlayer.debt.amount}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 md:py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Pay Debt (${activePlayer.debt.amount})
                      </button>
                      <button 
                        onClick={handleDeclareBankruptcy}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 md:py-3 px-4 rounded-xl transition-all shadow-md"
                      >
                        Bankrupt
                      </button>
                    </div>
                  )}

                  <div className="flex gap-3 w-full">
                  <button 
                    onClick={handleRollDice} 
                    disabled={!isMyTurn || activePlayer.hasRolled}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 md:py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-blue-500/25 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm md:text-base"
                  >
                    Roll Dice
                  </button>
                  <button 
                    onClick={handleEndTurn} 
                    disabled={!isMyTurn || !activePlayer.hasRolled}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 md:py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-gray-500/25 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm md:text-base"
                  >
                    End Turn
                  </button>
                </div>
              </div>
            </div>
          </MonopolyBoard>
        </div>
      </div>
    </div>
  );
}
