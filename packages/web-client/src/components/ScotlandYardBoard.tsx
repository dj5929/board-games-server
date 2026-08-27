
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ScotlandYardState, TransportType } from '@packages/scotland-yard-engine';
import { scotlandYardPositions, scotlandYardGraph } from '@packages/scotland-yard-engine';

interface Props {
  state: ScotlandYardState | null;
  localPlayerIds: string[];
}

export function ScotlandYardBoard({ state, localPlayerIds }: Props) {
  const VIEWPORT_WIDTH = 1600;
  const VIEWPORT_HEIGHT = 1200;

  // Deduce if we are currently looking for a move
  const activePlayer = state?.players.find(p => p.id === state.activePlayerId);

  return (
    <div className="w-full max-w-6xl flex-1 bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative">
      <TransformWrapper
        initialScale={0.8}
        initialPositionX={0}
        initialPositionY={0}
        minScale={0.2}
        maxScale={3}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button className="bg-gray-800 text-white p-2 rounded shadow hover:bg-gray-700 border border-gray-600" onClick={() => zoomIn()}>+</button>
              <button className="bg-gray-800 text-white p-2 rounded shadow hover:bg-gray-700 border border-gray-600" onClick={() => zoomOut()}>-</button>
              <button className="bg-gray-800 text-white p-2 rounded shadow hover:bg-gray-700 border border-gray-600" onClick={() => resetTransform()}>Reset</button>
            </div>
            
            <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing">
              <svg 
                viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`} 
                className="w-full h-full"
                style={{ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, backgroundColor: '#0f172a' }} // tailwind slate-900
              >
                {/* Edges */}
                {Object.entries(scotlandYardGraph).map(([sourceId, node]) => {
                   const s = Number(sourceId);
                   const sPos = scotlandYardPositions[s];
                   if (!sPos) return null;

                   return (
                     <g key={`edges-${s}`}>
                       {/* Taxi edges */}
                       {node.taxi.map(target => {
                         const tPos = scotlandYardPositions[target];
                         if (!tPos || target < s) return null; // Avoid double drawing
                         return <line key={`taxi-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#eab308" strokeWidth="4" opacity="0.6" />
                       })}
                       {/* Bus edges */}
                       {node.bus.map(target => {
                         const tPos = scotlandYardPositions[target];
                         if (!tPos || target < s) return null;
                         return <line key={`bus-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#14b8a6" strokeWidth="6" opacity="0.6" />
                       })}
                       {/* Underground edges */}
                       {node.underground.map(target => {
                         const tPos = scotlandYardPositions[target];
                         if (!tPos || target < s) return null;
                         return <line key={`ug-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#ef4444" strokeWidth="8" opacity="0.6" />
                       })}
                       {/* Secret edges */}
                       {node.secret.map(target => {
                         const tPos = scotlandYardPositions[target];
                         if (!tPos || target < s) return null;
                         return <line key={`sec-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#f8fafc" strokeWidth="4" strokeDasharray="8,8" opacity="0.6" />
                       })}
                     </g>
                   )
                })}

                {/* Nodes */}
                {Object.entries(scotlandYardPositions).map(([id, pos]) => {
                  const nodeId = Number(id);
                  
                  return (
                    <g key={`node-${nodeId}`} 
                       transform={`translate(${pos.x}, ${pos.y})`}
                    >
                      <circle 
                        r="14" 
                        fill="#1e293b" 
                        stroke="#64748b" 
                        strokeWidth="2"
                      />
                      <text 
                        y="5" 
                        textAnchor="middle" 
                        fill="#f8fafc" 
                        fontSize="14" 
                        fontFamily="sans-serif"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        {nodeId}
                      </text>
                    </g>
                  );
                })}

                {/* Player Tokens */}
                {state && state.players.map(player => {
                   // If Mr X and not visible on this turn, don't show, UNLESS local player is Mr X
                   const isLocal = localPlayerIds.includes(player.id);
                   const isMrX = player.role === 'MR_X';
                   const isRevealed = state.mrXRevealedTurns.includes(state.mrXLog.length);
                   const showToken = !isMrX || isRevealed || isLocal || state.status === 'FINISHED';

                   if (!showToken) return null;

                   const pos = scotlandYardPositions[player.position];
                   if (!pos) return null;

                   const isActive = player.id === state.activePlayerId;
                   const color = isMrX ? '#000000' : (player.id.charCodeAt(0) % 2 === 0 ? '#3b82f6' : '#ec4899'); // Simplified color for detectives

                   return (
                     <g key={`player-${player.id}`} 
                        transform={`translate(${pos.x}, ${pos.y})`}
                        style={{ transition: 'transform 0.5s ease-in-out' }}
                     >
                       {isActive && (
                         <circle r="24" fill="transparent" stroke="#fbbf24" strokeWidth="4" className="animate-spin-slow" strokeDasharray="10 5" />
                       )}
                       <circle r="10" fill={color} stroke="#ffffff" strokeWidth="2" />
                       {isMrX && <text y="4" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">X</text>}
                     </g>
                   )
                })}
              </svg>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
