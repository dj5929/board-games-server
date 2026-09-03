import { useState, useMemo } from 'react';
import type { IMonopolyState } from '@packages/monopoly-engine';
import { BOARD_SPACES } from '@packages/monopoly-engine';
import type { PropertyId } from '@packages/engine-core';

interface Props {
  state: IMonopolyState;
  activePlayerId: string;
  onProposeTrade: (trade: { toPlayerId: string; offeredProperties: string[]; requestedProperties: string[]; offeredMoney: number; requestedMoney: number }) => void;
  onCancel: () => void;
}

export function TradeManager({ state, activePlayerId, onProposeTrade, onCancel }: Props) {
  const otherPlayers = state.players.filter(p => p.id !== activePlayerId);
  const [targetPlayerId, setTargetPlayerId] = useState(otherPlayers[0]?.id || '');
  const [offeredProperties, setOfferedProperties] = useState<string[]>([]);
  const [requestedProperties, setRequestedProperties] = useState<string[]>([]);
  const [offeredMoney, setOfferedMoney] = useState(0);
  const [requestedMoney, setRequestedMoney] = useState(0);

  const activePlayer = state.players.find(p => p.id === activePlayerId)!;
  const targetPlayer = state.players.find(p => p.id === targetPlayerId);

  // Precompute which color groups have any buildings so isTradable is an O(1)
  // map lookup instead of filtering BOARD_SPACES on every property.
  const colorGroupsWithBuildings = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const [id, count] of Object.entries(state.buildings)) {
      if ((count || 0) > 0) {
        const space = BOARD_SPACES.find(s => s.id === id);
        if (space?.colorGroup) map.set(space.colorGroup, true);
      }
    }
    return map;
  }, [state.buildings]);

  const isTradable = (propId: string) => {
    const space = BOARD_SPACES.find(s => s.id === propId);
    if (!space || !space.colorGroup) return true;
    return !colorGroupsWithBuildings.get(space.colorGroup);
  };

  const myProperties = Object.keys(state.ownership).filter(id => state.ownership[id as PropertyId] === activePlayerId && isTradable(id));
  const targetProperties = Object.keys(state.ownership).filter(id => state.ownership[id as PropertyId] === targetPlayerId && isTradable(id));

  const toggleProperty = (id: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(id)) {
      setList(list.filter(p => p !== id));
    } else {
      setList([...list, id]);
    }
  };

  const handlePropose = () => {
    if (!targetPlayerId) return;
    onProposeTrade({
      toPlayerId: targetPlayerId,
      offeredProperties,
      requestedProperties,
      offeredMoney,
      requestedMoney
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
          <h2 className="text-2xl font-bold text-white">Propose Trade</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        <div className="mb-4">
          <label className="text-gray-400 text-sm block mb-1">Select Trading Partner:</label>
          <select 
            value={targetPlayerId} 
            onChange={e => {
              setTargetPlayerId(e.target.value);
              setRequestedProperties([]);
              setRequestedMoney(0);
            }}
            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2"
          >
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-6 min-h-0">
          {/* Your Offer */}
          <div className="flex-1 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold text-blue-400 mb-3">Your Offer</h3>
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-1">Money to Offer (Max: ${activePlayer.money})</label>
              <input 
                type="number" 
                min="0" 
                max={activePlayer.money}
                value={offeredMoney}
                onChange={e => setOfferedMoney(Math.min(activePlayer.money, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-2">Properties to Offer</label>
              <div className="flex flex-col gap-2">
                {myProperties.length === 0 ? <p className="text-sm text-gray-500">No tradable properties.</p> : myProperties.map(id => {
                  const space = BOARD_SPACES.find(s => s.id === id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-sm text-gray-300">
                      <input 
                        type="checkbox" 
                        checked={offeredProperties.includes(id)}
                        onChange={() => toggleProperty(id, offeredProperties, setOfferedProperties)}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                      {space?.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Their Offer */}
          <div className="flex-1 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold text-orange-400 mb-3">You Want</h3>
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-1">Money to Request (Max: ${targetPlayer?.money || 0})</label>
              <input 
                type="number" 
                min="0" 
                max={targetPlayer?.money || 0}
                value={requestedMoney}
                onChange={e => setRequestedMoney(Math.min(targetPlayer?.money || 0, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-2">Properties to Request</label>
              <div className="flex flex-col gap-2">
                {targetProperties.length === 0 ? <p className="text-sm text-gray-500">No tradable properties.</p> : targetProperties.map(id => {
                  const space = BOARD_SPACES.find(s => s.id === id);
                  return (
                    <label key={id} className="flex items-center gap-2 text-sm text-gray-300">
                      <input 
                        type="checkbox" 
                        checked={requestedProperties.includes(id)}
                        onChange={() => toggleProperty(id, requestedProperties, setRequestedProperties)}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                      {space?.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors font-bold">
            Cancel
          </button>
          <button 
            onClick={handlePropose}
            disabled={!targetPlayerId || (offeredProperties.length === 0 && requestedProperties.length === 0 && offeredMoney === 0 && requestedMoney === 0)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-colors"
          >
            Propose Trade
          </button>
        </div>
      </div>
    </div>
  );
}
