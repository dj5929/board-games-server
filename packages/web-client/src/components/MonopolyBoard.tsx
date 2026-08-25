import React from 'react';
import type { IMonopolyState } from '@packages/monopoly-engine';
import { BOARD_SPACES } from '@packages/monopoly-engine';
import { PlayerToken } from './PlayerToken';

interface Props {
  state: IMonopolyState;
  playerId: string;
  children?: React.ReactNode;
}

// Map property IDs to Tailwind color classes
const PROPERTY_COLORS: Record<string, string> = {
  'mediterranean': 'bg-amber-900',
  'baltic': 'bg-amber-900',
  'oriental': 'bg-sky-400',
  'vermont': 'bg-sky-400',
  'connecticut': 'bg-sky-400',
  'st_charles': 'bg-pink-500',
  'states': 'bg-pink-500',
  'virginia': 'bg-pink-500',
  'st_james': 'bg-orange-500',
  'tennessee': 'bg-orange-500',
  'new_york': 'bg-orange-500',
  'kentucky': 'bg-red-600',
  'indiana': 'bg-red-600',
  'illinois': 'bg-red-600',
  'atlantic': 'bg-yellow-400',
  'ventnor': 'bg-yellow-400',
  'marvin': 'bg-yellow-400',
  'pacific': 'bg-green-600',
  'north_carolina': 'bg-green-600',
  'pennsylvania': 'bg-green-600',
  'park_place': 'bg-blue-800',
  'boardwalk': 'bg-blue-800',
  // Railroads
  'reading': 'bg-gray-700',
  'penn_rr': 'bg-gray-700',
  'bo_rr': 'bg-gray-700',
  'short_line': 'bg-gray-700',
  // Utilities
  'electric': 'bg-gray-500',
  'water': 'bg-gray-500',
  // Special spaces (Chance, Community Chest, Tax)
  'chance1': 'bg-gradient-to-br from-purple-700 via-purple-400 to-purple-800',
  'chance2': 'bg-gradient-to-br from-purple-700 via-purple-400 to-purple-800',
  'chance3': 'bg-gradient-to-br from-purple-700 via-purple-400 to-purple-800',
  'chest1': 'bg-gradient-to-br from-yellow-500 via-yellow-300 to-yellow-600',
  'chest2': 'bg-gradient-to-br from-yellow-500 via-yellow-300 to-yellow-600',
  'chest3': 'bg-gradient-to-br from-yellow-500 via-yellow-300 to-yellow-600',
  'tax1': 'bg-gradient-to-br from-lime-500 via-lime-300 to-lime-600',
  'tax2': 'bg-gradient-to-br from-lime-500 via-lime-300 to-lime-600',
};

const PLAYER_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];

// Helper to determine Grid Column and Row for each of the 40 spaces
// Grid is 11x11, coordinates are 1-indexed for CSS Grid.
// Bottom Row: col 11 to 1, row 11
// Left Col: col 1, row 11 to 1
// Top Row: col 1 to 11, row 1
// Right Col: col 11, row 1 to 11
function getGridPosition(index: number): { gridColumn: number, gridRow: number } {
  if (index >= 0 && index <= 10) {
    // Bottom row (Right to Left)
    return { gridColumn: 11 - index, gridRow: 11 };
  } else if (index > 10 && index <= 20) {
    // Left column (Bottom to Top)
    return { gridColumn: 1, gridRow: 11 - (index - 10) };
  } else if (index > 20 && index <= 30) {
    // Top row (Left to Right)
    return { gridColumn: 1 + (index - 20), gridRow: 1 };
  } else {
    // Right column (Top to Bottom)
    return { gridColumn: 11, gridRow: 1 + (index - 30) };
  }
}

export function MonopolyBoard({ state, children }: Props) {
  return (
    <div className="w-full">
      <div className="w-full max-w-6xl aspect-square bg-green-50 p-1 md:p-2 rounded-xl shadow-2xl border-4 border-gray-900 relative mx-auto" id="board-container">
        {state.players.map((p, i) => (
          <PlayerToken 
            key={p.id} 
            playerId={p.id} 
            playerIndex={i} 
            targetPosition={p.position} 
          />
        ))}
      <div 
        className="w-full h-full grid gap-0.5" 
        style={{
          gridTemplateColumns: '2fr repeat(9, 1fr) 2fr',
          gridTemplateRows: '2fr repeat(9, 1fr) 2fr'
        }}
      >
        {BOARD_SPACES.map((space, index) => {
          const { gridColumn, gridRow } = getGridPosition(index);
          const colorClass = PROPERTY_COLORS[space.id];
          const ownerId = state.ownership[space.id];
          const ownerIndex = state.players.findIndex(p => p.id === ownerId);
          const ownerColor = ownerIndex !== -1 ? PLAYER_COLORS[ownerIndex % PLAYER_COLORS.length] : null;

          const isCorner = index % 10 === 0;

          // Figure out which orientation the color bar should be
          let barClasses = "";
          let flexDir = "flex-col";
          if (index >= 0 && index < 10) { // Bottom row
            barClasses = "w-full h-1/4 rounded-b-sm border-t border-black/20 order-first";
            flexDir = "flex-col justify-start";
          } else if (index >= 10 && index < 20) { // Left col
            barClasses = "w-1/4 h-full rounded-r-sm border-l border-black/20 order-last";
            flexDir = "flex-row justify-between";
          } else if (index >= 20 && index < 30) { // Top row
            barClasses = "w-full h-1/4 rounded-t-sm border-b border-black/20 order-last";
            flexDir = "flex-col justify-end";
          } else if (index >= 30 && index < 40) { // Right col
            barClasses = "w-1/4 h-full rounded-l-sm border-r border-black/20 order-first";
            flexDir = "flex-row justify-start";
          }

          return (
            <div 
              key={space.id} 
              data-space-index={index}
              style={{ gridColumn, gridRow }}
              className={`bg-white relative border border-gray-300 flex ${flexDir} overflow-hidden ${isCorner ? 'p-1 md:p-2 justify-center items-center' : 'text-center'}`}
            >
              {colorClass && (
                <div className={`${colorClass} ${barClasses} shadow-sm shrink-0`} />
              )}
              
              <div className={`flex flex-col items-center justify-center p-0.5 md:p-1 w-full h-full text-[8px] md:text-[10px] leading-tight flex-1 ${colorClass ? (flexDir.includes('flex-row') ? 'w-3/4' : 'h-3/4') : ''}`}>
                <span className={`font-bold ${isCorner ? 'text-xs md:text-sm' : ''} text-gray-900 text-center leading-tight md:leading-snug break-words hyphens-auto`}>{space.name}</span>
                {space.price && <span className="text-gray-600 font-semibold text-[7px] md:text-[9px] mt-0.5">${space.price}</span>}
                {ownerColor && (
                  <div className={`mt-0.5 md:mt-1 text-[7px] md:text-[8px] font-bold px-1 rounded text-white ${ownerColor}`}>
                    {ownerId}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Center Board Area */}
        <div 
          className="col-start-2 col-end-11 row-start-2 row-end-11 bg-green-50 flex items-center justify-center p-2 md:p-6 rounded"
        >
          {children}
        </div>
      </div>
    </div>
  </div>
  );
}
