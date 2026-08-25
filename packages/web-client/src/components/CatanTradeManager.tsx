import React, { useState } from 'react';
import { ICatanState, ResourceType, PlayerId } from '@packages/catan-engine';

interface Props {
  state: ICatanState;
  playerId: string;
  onTradeBank: (offerResource: ResourceType, requestResource: ResourceType, amount: number) => void;
  onProposeTrade: (toPlayerId: PlayerId, offer: Record<Exclude<ResourceType, 'DESERT'>, number>, request: Record<Exclude<ResourceType, 'DESERT'>, number>) => void;
  onAcceptTrade: () => void;
  onRejectTrade: () => void;
  onCancelTrade: () => void;
  onClose: () => void;
}

const RESOURCES: Exclude<ResourceType, 'DESERT'>[] = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

const RESOURCE_COLORS: Record<string, string> = {
  WOOD: 'bg-green-500',
  BRICK: 'bg-red-600',
  SHEEP: 'bg-lime-500',
  WHEAT: 'bg-yellow-500',
  ORE: 'bg-zinc-500',
};

export function CatanTradeManager({ state, playerId, onTradeBank, onProposeTrade, onAcceptTrade, onRejectTrade, onCancelTrade, onClose }: Props) {
  const [tab, setTab] = useState<'BANK' | 'PLAYER'>('BANK');
  const [bankOffer, setBankOffer] = useState<ResourceType | null>(null);
  const [bankRequest, setBankRequest] = useState<ResourceType | null>(null);
  
  const [playerTarget, setPlayerTarget] = useState<PlayerId | null>(null);
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 });
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 });

  const isActivePlayer = state.activePlayerId === playerId;
  const activeTrade = state.activeTrade;

  const handleBankTrade = () => {
    if (bankOffer && bankRequest) {
      onTradeBank(bankOffer, bankRequest, 1);
    }
  };

  const handlePropose = () => {
    if (playerTarget) {
      onProposeTrade(playerTarget as PlayerId, offerCounts as any, requestCounts as any);
    }
  };

  const getBankExchangeRate = (resource: ResourceType) => {
    if (resource === 'DESERT') return 4;
    let bestRate = 4;
    Object.values(state.board.vertices).forEach(vertex => {
      if (vertex.owner === playerId && vertex.building) {
        const edges = state.board.vertices[vertex.id]?.adjacentEdges || [];
        edges.forEach(eId => {
          const port = state.board.edges[eId]?.port;
          if (port === '3:1') bestRate = Math.min(bestRate, 3);
          if (port === resource) bestRate = Math.min(bestRate, 2);
        });
      }
    });
    return bestRate;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-xl overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Trade Manager</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {activeTrade ? (
          <div className="p-6 flex flex-col gap-6">
            <h3 className="text-lg font-bold text-blue-400 text-center">Active Trade Proposal</h3>
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-2">Offered by {activeTrade.fromPlayerId}:</p>
                <div className="flex gap-2">
                  {RESOURCES.map(res => activeTrade.offer[res] > 0 && (
                    <div key={res} className={`px-2 py-1 rounded text-xs text-white ${RESOURCE_COLORS[res]}`}>
                      {activeTrade.offer[res]} {res}
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-2xl text-slate-500 mx-4">⇄</div>
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-2">Requested from {activeTrade.toPlayerId}:</p>
                <div className="flex gap-2">
                  {RESOURCES.map(res => activeTrade.request[res] > 0 && (
                    <div key={res} className={`px-2 py-1 rounded text-xs text-white ${RESOURCE_COLORS[res]}`}>
                      {activeTrade.request[res]} {res}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              {playerId === activeTrade.fromPlayerId && (
                <button onClick={onCancelTrade} className="flex-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold transition-all border border-red-900">
                  Cancel Proposal
                </button>
              )}
              {playerId === activeTrade.toPlayerId && (
                <>
                  <button onClick={onRejectTrade} className="flex-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold transition-all border border-red-900">
                    Reject
                  </button>
                  <button onClick={onAcceptTrade} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-900/20">
                    Accept Trade
                  </button>
                </>
              )}
              {playerId !== activeTrade.fromPlayerId && playerId !== activeTrade.toPlayerId && (
                <p className="text-slate-500 w-full text-center">Waiting for {activeTrade.toPlayerId} to respond...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="flex border-b border-slate-700 bg-slate-800/50">
              <button 
                onClick={() => setTab('BANK')}
                className={`flex-1 py-3 font-bold text-sm transition-colors ${tab === 'BANK' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Maritime Trade (Bank)
              </button>
              <button 
                onClick={() => setTab('PLAYER')}
                className={`flex-1 py-3 font-bold text-sm transition-colors ${tab === 'PLAYER' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Player Trade
              </button>
            </div>

            {!isActivePlayer ? (
              <div className="p-8 text-center text-slate-400">
                It is not your turn. You can only accept trades proposed to you.
              </div>
            ) : (
              <div className="p-6">
                {tab === 'BANK' ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-300 mb-2">Give to Bank:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {RESOURCES.map(res => {
                            const rate = getBankExchangeRate(res);
                            return (
                              <button 
                                key={res} 
                                onClick={() => setBankOffer(res)}
                                className={`p-2 rounded border text-sm flex justify-between items-center transition-colors ${bankOffer === res ? 'bg-blue-900 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                              >
                                <span>{res}</span>
                                <span className="text-xs bg-black/30 px-1.5 py-0.5 rounded">{rate}:1</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-slate-300 mb-2">Receive from Bank:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {RESOURCES.map(res => (
                            <button 
                              key={res} 
                              onClick={() => setBankRequest(res)}
                              className={`p-2 rounded border text-sm transition-colors ${bankRequest === res ? 'bg-blue-900 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                              {res}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleBankTrade} 
                      disabled={!bankOffer || !bankRequest || bankOffer === bankRequest}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-all mt-4"
                    >
                      Confirm Trade
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Trade With:</label>
                      <div className="flex gap-2">
                        {state.players.filter(p => p.id !== playerId).map(p => (
                          <button 
                            key={p.id}
                            onClick={() => setPlayerTarget(p.id)}
                            style={{ borderColor: playerTarget === p.id ? p.color : 'transparent' }}
                            className={`px-4 py-2 rounded-lg border-2 transition-all ${playerTarget === p.id ? 'bg-slate-800 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
                          >
                            {p.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-sm font-bold text-slate-300 mb-4">You Offer:</h4>
                        <div className="flex flex-col gap-2">
                          {RESOURCES.map(res => (
                            <div key={res} className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">{res}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setOfferCounts(c => ({...c, [res]: Math.max(0, c[res] - 1)}))} className="w-6 h-6 bg-slate-700 rounded text-slate-300">-</button>
                                <span className="w-4 text-center text-sm text-white">{offerCounts[res]}</span>
                                <button onClick={() => setOfferCounts(c => ({...c, [res]: c[res] + 1}))} className="w-6 h-6 bg-slate-700 rounded text-slate-300">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex-1 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-sm font-bold text-slate-300 mb-4">You Request:</h4>
                        <div className="flex flex-col gap-2">
                          {RESOURCES.map(res => (
                            <div key={res} className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">{res}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setRequestCounts(c => ({...c, [res]: Math.max(0, c[res] - 1)}))} className="w-6 h-6 bg-slate-700 rounded text-slate-300">-</button>
                                <span className="w-4 text-center text-sm text-white">{requestCounts[res]}</span>
                                <button onClick={() => setRequestCounts(c => ({...c, [res]: c[res] + 1}))} className="w-6 h-6 bg-slate-700 rounded text-slate-300">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handlePropose}
                      disabled={!playerTarget || (Object.values(offerCounts).every(v => v === 0) && Object.values(requestCounts).every(v => v === 0))}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      Propose Trade
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
