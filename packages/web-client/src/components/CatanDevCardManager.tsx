import { useState } from 'react';
import type { ICatanState, IDevCard } from '@packages/catan-engine';
import type { PlayerId } from '@packages/engine-core';

interface Props {
  state: ICatanState;
  playerId: PlayerId;
  onBuyCard: () => void;
  onPlayKnight: () => void; // We'll just initiate the robber placement phase in the parent
  onPlayYearOfPlenty: (res1: any, res2: any) => void;
  onPlayMonopoly: (res: any) => void;
  onPlayRoadBuilding: () => void;
  onClose: () => void;
}

export function CatanDevCardManager({ state, playerId, onBuyCard, onPlayKnight, onPlayYearOfPlenty, onPlayMonopoly, onPlayRoadBuilding, onClose }: Props) {
  const [activeCard, setActiveCard] = useState<IDevCard | null>(null);
  const [yopRes1, setYopRes1] = useState<any>('WOOD');
  const [yopRes2, setYopRes2] = useState<any>('WOOD');
  const [monopolyRes, setMonopolyRes] = useState<any>('WOOD');

  const me = state.players.find(p => p.id === playerId);
  if (!me) return null;

  const isMyTurn = state.activePlayerId === playerId;
  const canBuy = me.resources.ORE >= 1 && me.resources.WHEAT >= 1 && me.resources.SHEEP >= 1 && state.devCardDeck.length > 0;

  const handlePlayCard = (card: IDevCard) => {
    if (card.boughtThisTurn) return;
    setActiveCard(card);
  };

  const confirmPlay = () => {
    if (!activeCard) return;
    switch (activeCard.type) {
      case 'KNIGHT': onPlayKnight(); break;
      case 'YEAR_OF_PLENTY': onPlayYearOfPlenty(yopRes1, yopRes2); break;
      case 'MONOPOLY': onPlayMonopoly(monopolyRes); break;
      case 'ROAD_BUILDING': onPlayRoadBuilding(); break;
      case 'VICTORY_POINT': break; // Played automatically/passively
    }
    setActiveCard(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[65] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-purple-500/50 rounded-2xl p-6 shadow-2xl max-w-lg w-full relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white text-purple-400">Development Cards</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl mb-6">
          <div>
            <span className="text-gray-400 text-sm">Buy new card</span>
            <div className="flex gap-2 text-xs mt-1">
              <span className="text-gray-400">1x</span> <span className="font-bold text-zinc-400">ORE</span>
              <span className="text-gray-400">1x</span> <span className="font-bold text-yellow-500">WHEAT</span>
              <span className="text-gray-400">1x</span> <span className="font-bold text-lime-400">SHEEP</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{state.devCardDeck.length} cards left in deck</p>
          </div>
          <button 
            onClick={onBuyCard}
            disabled={!canBuy || !isMyTurn}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Buy Card
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <h3 className="text-sm font-bold text-gray-400 uppercase">Your Cards</h3>
          {me.developmentCards.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">You have no development cards.</p>
          ) : (
            me.developmentCards.map(card => (
              <div key={card.id} className="bg-gray-800 p-3 rounded-xl border border-gray-700 flex justify-between items-center">
                <div>
                  <div className="font-bold text-gray-200">{card.type.replace(/_/g, ' ')}</div>
                  {card.boughtThisTurn && <div className="text-xs text-yellow-500">Bought this turn</div>}
                </div>
                {card.type !== 'VICTORY_POINT' && (
                  <button 
                    onClick={() => handlePlayCard(card)}
                    disabled={card.boughtThisTurn || !isMyTurn}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                  >
                    Play
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {activeCard && (
          <div className="absolute inset-0 bg-gray-900 rounded-2xl p-6 flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4">Play {activeCard.type.replace(/_/g, ' ')}</h3>
            
            {activeCard.type === 'KNIGHT' && (
              <p className="text-gray-300 text-sm mb-6">Move the robber and steal a resource from an adjacent player.</p>
            )}
            {activeCard.type === 'ROAD_BUILDING' && (
              <p className="text-gray-300 text-sm mb-6">Place 2 new roads as if you had just built them.</p>
            )}
            
            {activeCard.type === 'YEAR_OF_PLENTY' && (
              <div className="space-y-4 mb-6">
                <p className="text-gray-300 text-sm">Take any 2 resources from the bank.</p>
                <div className="flex gap-4">
                  <select value={yopRes1} onChange={e => setYopRes1(e.target.value)} className="bg-gray-800 text-white p-2 rounded-lg flex-1">
                    <option value="WOOD">Wood</option><option value="BRICK">Brick</option>
                    <option value="SHEEP">Sheep</option><option value="WHEAT">Wheat</option><option value="ORE">Ore</option>
                  </select>
                  <select value={yopRes2} onChange={e => setYopRes2(e.target.value)} className="bg-gray-800 text-white p-2 rounded-lg flex-1">
                    <option value="WOOD">Wood</option><option value="BRICK">Brick</option>
                    <option value="SHEEP">Sheep</option><option value="WHEAT">Wheat</option><option value="ORE">Ore</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeCard.type === 'MONOPOLY' && (
              <div className="space-y-4 mb-6">
                <p className="text-gray-300 text-sm">When you play this card, announce 1 type of resource. All other players must give you all of their resources of that type.</p>
                <select value={monopolyRes} onChange={e => setMonopolyRes(e.target.value)} className="bg-gray-800 text-white p-2 rounded-lg w-full">
                  <option value="WOOD">Wood</option><option value="BRICK">Brick</option>
                  <option value="SHEEP">Sheep</option><option value="WHEAT">Wheat</option><option value="ORE">Ore</option>
                </select>
              </div>
            )}
            
            <div className="mt-auto flex gap-3">
              <button onClick={() => setActiveCard(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={confirmPlay} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl">Play Card</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
