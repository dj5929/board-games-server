import React, { memo } from 'react';
import type { ICatanState, Hex, ResourceType, Vertex, Edge } from '@packages/catan-engine';

interface Props {
  state: ICatanState | null;
  playerId: string;
  buildMode: 'SETTLEMENT' | 'ROAD' | 'CITY' | null;
  onVertexClick: (vertexId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onHexClick?: (hexId: string) => void;
  children?: React.ReactNode;
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  WOOD: '#22c55e', // green-500
  BRICK: '#dc2626', // red-600
  SHEEP: '#84cc16', // lime-500
  WHEAT: '#eab308', // yellow-500
  ORE: '#71717a', // zinc-500
  DESERT: '#d6d3d1' // stone-300
};

const HEX_SIZE = 55;
const BOARD_OFFSET_X = 400;
const BOARD_OFFSET_Y = 300;

function getHexCoordinates(q: number, r: number) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 3 / 2 * r;
  return { x: x + BOARD_OFFSET_X, y: y + BOARD_OFFSET_Y };
}

function getCoordsFromId(id: string) {
  const hexes = id.split('|').map(h => {
    const [q, r] = h.split(',').map(Number);
    return getHexCoordinates(q, r);
  });
  const x = hexes.reduce((sum, h) => sum + h.x, 0) / hexes.length;
  const y = hexes.reduce((sum, h) => sum + h.y, 0) / hexes.length;
  return { x, y, hexes };
}

const HexPolygon = memo(function HexPolygon({ hex, onClick, isClickable }: { hex: Hex, onClick?: () => void, isClickable?: boolean }) {
  const { x, y } = getHexCoordinates(hex.q, hex.r);
  const points = Array.from({ length: 6 }).map((_, i) => {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    return `${x + HEX_SIZE * Math.cos(angle_rad)},${y + HEX_SIZE * Math.sin(angle_rad)}`;
  }).join(' ');

  return (
    <g className={`hover:opacity-90 transition-opacity group ${isClickable ? 'cursor-pointer' : ''}`} onClick={isClickable ? onClick : undefined}>
      <polygon 
        points={points} 
        fill={RESOURCE_COLORS[hex.resource]} 
        stroke={isClickable ? "#fbbf24" : "#1f2937"} 
        strokeWidth={isClickable ? "4" : "2"}
        className={`drop-shadow-sm ${isClickable ? 'animate-pulse' : ''}`}
      />
      {hex.numberToken && (
        <g transform={`translate(${x}, ${y})`}>
          <circle r="16" fill="#ffedd5" stroke="#fdba74" strokeWidth="2" className="shadow-inner" />
          <text 
            textAnchor="middle" 
            dominantBaseline="central" 
            fill={hex.numberToken === 6 || hex.numberToken === 8 ? '#ef4444' : '#1f2937'} 
            fontWeight="bold" 
            fontSize={hex.numberToken === 6 || hex.numberToken === 8 ? "18" : "14"}
          >
            {hex.numberToken}
          </text>
        </g>
      )}
      {hex.hasRobber && (
        <circle cx={x} cy={y + 15} r="8" fill="#111827" />
      )}
    </g>
  );
});

const VertexNode = memo(function VertexNode({ vertex, colors, buildMode, onClick }: { vertex: Vertex, colors: Record<string, string>, buildMode: 'SETTLEMENT' | 'ROAD' | 'CITY' | null, onClick: () => void }) {
  const { x, y } = getCoordsFromId(vertex.id);
  const isClickable = buildMode === 'SETTLEMENT' || (buildMode === 'CITY' && vertex.building === 'SETTLEMENT');
  
  if (!vertex.building && !isClickable) return null;
  
  return (
    <g transform={`translate(${x}, ${y})`} onClick={isClickable ? onClick : undefined} className={isClickable ? "cursor-pointer hover:scale-150 transition-transform origin-center" : ""}>
      {!vertex.building && isClickable && (
        <circle r="12" fill="white" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="2" className="animate-pulse" />
      )}
      {vertex.building === 'SETTLEMENT' && (
        <rect x="-8" y="-8" width="16" height="16" fill={colors[vertex.owner!]} stroke="white" strokeWidth="2" rx="2" />
      )}
      {vertex.building === 'CITY' && (
        <polygon points="0,-12 12,0 12,12 -12,12 -12,0" fill={colors[vertex.owner!]} stroke="white" strokeWidth="2" />
      )}
    </g>
  );
});

const EdgeNode = memo(function EdgeNode({ edge, colors, buildMode, onClick }: { edge: Edge, colors: Record<string, string>, buildMode: 'SETTLEMENT' | 'ROAD' | 'CITY' | null, onClick: () => void }) {
  const { x, y, hexes } = getCoordsFromId(edge.id);
  const isClickable = buildMode === 'ROAD' && !edge.owner;

  if (!edge.owner && !isClickable && !edge.port) return null;

  const h1 = hexes[0]!;
  const h2 = hexes[1]!;
  let angle = Math.atan2(h2.y - h1.y, h2.x - h1.x) * (180 / Math.PI);
  angle += 90;

  const dx = x - BOARD_OFFSET_X;
  const dy = y - BOARD_OFFSET_Y;
  const outAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  const portColor = edge.port === '3:1' ? '#3b82f6' : (RESOURCE_COLORS[edge.port as ResourceType] || '#fff');

  return (
    <g transform={`translate(${x}, ${y})`}>
      {edge.port && (
        <g transform={`rotate(${outAngle}) translate(18, 0)`}>
          <circle cx="0" cy="0" r="12" fill={portColor} stroke="white" strokeWidth="2" className="drop-shadow-sm" />
          <text textAnchor="middle" dominantBaseline="central" fill="white" fontWeight="bold" fontSize="10">
            {edge.port === '3:1' ? '3:1' : '2:1'}
          </text>
        </g>
      )}
      
      <g transform={`rotate(${angle})`} onClick={isClickable ? onClick : undefined} className={isClickable ? "cursor-pointer hover:scale-125 transition-transform" : ""}>
        {!edge.owner && isClickable && (
          <rect x="-4" y="-20" width="8" height="40" fill="white" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="2" rx="4" className="animate-pulse" />
        )}
        {edge.owner && (
          <rect x="-4" y="-20" width="8" height="40" fill={colors[edge.owner]!} stroke="white" strokeWidth="2" rx="4" />
        )}
      </g>
    </g>
  );
});

export const CatanBoard = memo(function CatanBoard({ state, playerId: _playerId, buildMode, onVertexClick, onEdgeClick, onHexClick, children }: Props) {
  if (!state) return null;
  const playerColors = Object.fromEntries(state.players.map(p => [p.id, p.color]));

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 relative">
      <div className="flex-1 bg-blue-400/20 rounded-3xl p-4 overflow-x-auto flex justify-center items-center shadow-inner border border-blue-500/30">
        <svg width="800" height="600" viewBox="0 0 800 600" className="max-w-full h-auto drop-shadow-2xl">
          <rect width="100%" height="100%" fill="#38bdf8" rx="24" opacity="0.3" />
          
          <g id="hexes">
            {state.board.hexes.map(hex => (
              <HexPolygon 
                key={hex.id} 
                hex={hex} 
                onClick={onHexClick ? () => onHexClick(hex.id) : undefined} 
                isClickable={!!onHexClick && !hex.hasRobber} 
              />
            ))}
          </g>
          
          <g id="edges">
            {Object.values(state.board.edges).map(edge => (
              <EdgeNode key={edge.id} edge={edge} colors={playerColors} buildMode={buildMode} onClick={() => onEdgeClick(edge.id)} />
            ))}
          </g>
          
          <g id="vertices">
            {Object.values(state.board.vertices).map(vertex => (
              <VertexNode key={vertex.id} vertex={vertex} colors={playerColors} buildMode={buildMode} onClick={() => onVertexClick(vertex.id)} />
            ))}
          </g>
        </svg>
      </div>
      
      <div className="lg:w-80 flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
});
