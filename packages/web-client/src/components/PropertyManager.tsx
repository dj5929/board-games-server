import type { IMonopolyState } from '@packages/monopoly-engine';
import { BOARD_SPACES } from '@packages/monopoly-engine';
import type { PropertyId } from '@packages/engine-core';

interface Props {
  propertyId: string;
  state: IMonopolyState;
  activePlayerId: string;
  isMyTurn: boolean;
  onAction: (actionType: string, propertyId: string) => void;
  onClose: () => void;
}

export function PropertyManager({ propertyId, state, activePlayerId, isMyTurn, onAction, onClose }: Props) {
  const space = BOARD_SPACES.find((s) => s.id === propertyId);
  const activePlayer = state.players.find((p) => p.id === activePlayerId);

  if (!space || !activePlayer || space.type !== 'PROPERTY') {
    return null;
  }

  const pId = propertyId as PropertyId;
  const isOwnedByMe = state.ownership[pId] === activePlayerId;
  const isMortgaged = !!state.mortgagedProperties[pId];
  const buildings = state.buildings[pId] || 0;
  
  // Basic info
  const mortgageValue = Math.floor((space.price || 0) / 2);
  const unmortgageCost = Math.floor(mortgageValue * 1.1);

  // Validation logic (mirrors backend Engine)
  const groupSpaces = space.colorGroup ? BOARD_SPACES.filter(s => s.colorGroup === space.colorGroup) : [];
  
  // Can Mortgage? Must have 0 buildings on entire group.
  const groupHasBuildings = groupSpaces.some(s => (state.buildings[s.id] || 0) > 0);
  const canMortgage = isOwnedByMe && !isMortgaged && !groupHasBuildings;
  
  // Can Unmortgage? Must have enough cash.
  const canUnmortgage = isOwnedByMe && isMortgaged && activePlayer.money >= unmortgageCost;

  // Monopoly validation for Houses
  const ownsAll = groupSpaces.length > 0 && groupSpaces.every(s => state.ownership[s.id] === activePlayerId);
  const anyMortgaged = groupSpaces.some(s => state.mortgagedProperties[s.id]);
  
  const minBuildings = Math.min(...groupSpaces.map(s => state.buildings[s.id] || 0));
  const maxBuildings = Math.max(...groupSpaces.map(s => state.buildings[s.id] || 0));
  
  const canBuyHouse = isOwnedByMe && space.housePrice && ownsAll && !anyMortgaged && buildings < 5 && buildings <= minBuildings && activePlayer.money >= space.housePrice;
  const canSellHouse = isOwnedByMe && space.housePrice && buildings > 0 && buildings >= maxBuildings;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 shadow-2xl mt-2 w-full max-w-sm animate-fade-in-up">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-bold text-white">{space.name}</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex justify-between text-sm text-gray-300 mb-4 border-b border-gray-700 pb-2">
        <span>Status: {isMortgaged ? <span className="text-red-400 font-bold">Mortgaged</span> : <span className="text-green-400">Active</span>}</span>
        <span>Buildings: {buildings === 5 ? 'Hotel' : buildings}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!isMortgaged ? (
          <button 
            onClick={() => onAction('MORTGAGE_PROPERTY', propertyId)}
            disabled={!isMyTurn || !canMortgage}
            className="col-span-2 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700 font-bold py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title={groupHasBuildings ? "Sell all buildings in color group first" : ""}
          >
            Mortgage (+${mortgageValue})
          </button>
        ) : (
          <button 
            onClick={() => onAction('UNMORTGAGE_PROPERTY', propertyId)}
            disabled={!isMyTurn || !canUnmortgage}
            className="col-span-2 bg-green-900/50 hover:bg-green-800 text-green-200 border border-green-700 font-bold py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Unmortgage (-${unmortgageCost})
          </button>
        )}

        {space.housePrice && (
          <>
            <button 
              onClick={() => onAction('BUY_HOUSE', propertyId)}
              disabled={!isMyTurn || !canBuyHouse}
              className="bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700 font-bold py-2 px-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex flex-col items-center"
              title={!ownsAll ? "Must own full color group" : anyMortgaged ? "Cannot build if group has mortgages" : ""}
            >
              <span>Build</span>
              <span className="text-xs font-normal">${space.housePrice}</span>
            </button>
            <button 
              onClick={() => onAction('SELL_HOUSE', propertyId)}
              disabled={!isMyTurn || !canSellHouse}
              className="bg-orange-900/50 hover:bg-orange-800 text-orange-200 border border-orange-700 font-bold py-2 px-3 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex flex-col items-center"
            >
              <span>Demolish</span>
              <span className="text-xs font-normal">+${Math.floor(space.housePrice / 2)}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
