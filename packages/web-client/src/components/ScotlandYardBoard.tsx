
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import type { ScotlandYardState } from '@packages/scotland-yard-engine';
import { scotlandYardPositions, scotlandYardGraph } from '@packages/scotland-yard-engine';

interface Props {
  state: ScotlandYardState | null;
  localPlayerIds: string[];
}

const VIEWPORT_WIDTH = 1600;
const VIEWPORT_HEIGHT = 1200;

function MrXShadow() {
  return (
    <g transform="translate(80, 1120)" style={{ opacity: 0.85 }}>
      <circle r="10" fill="#000000" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 2" />
      <text x="18" y="4" fill="#cbd5e1" fontSize="18" fontWeight="bold" pointerEvents="none">
        Mr. X is on the move...
      </text>
    </g>
  );
}

const StaticGraph = memo(function StaticGraph() {
  return (
    <>
      {Object.entries(scotlandYardGraph).map(([sourceId, node]) => {
        const s = Number(sourceId);
        const sPos = scotlandYardPositions[s];
        if (!sPos) return null;

        return (
          <g key={`edges-${s}`}>
            {node.taxi.map(target => {
              const tPos = scotlandYardPositions[target];
              if (!tPos || target < s) return null;
              return <line key={`taxi-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#eab308" strokeWidth="4" opacity="0.6" />
            })}
            {node.bus.map(target => {
              const tPos = scotlandYardPositions[target];
              if (!tPos || target < s) return null;
              return <line key={`bus-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#14b8a6" strokeWidth="6" opacity="0.6" />
            })}
            {node.underground.map(target => {
              const tPos = scotlandYardPositions[target];
              if (!tPos || target < s) return null;
              return <line key={`ug-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#ef4444" strokeWidth="8" opacity="0.6" />
            })}
            {node.secret.map(target => {
              const tPos = scotlandYardPositions[target];
              if (!tPos || target < s) return null;
              return <line key={`sec-${s}-${target}`} x1={sPos.x} y1={sPos.y} x2={tPos.x} y2={tPos.y} stroke="#f8fafc" strokeWidth="4" strokeDasharray="8,8" opacity="0.6" />
            })}
          </g>
        )
      })}

      {Object.entries(scotlandYardPositions).map(([id, pos]) => {
        const nodeId = Number(id);
        return (
          <g key={`node-${nodeId}`} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <text y="5" textAnchor="middle" fill="#f8fafc" fontSize="14" fontFamily="sans-serif" fontWeight="bold" pointerEvents="none">
              {nodeId}
            </text>
          </g>
        );
      })}
    </>
  );
});

const PlayerTokens = memo(function PlayerTokens({ state, localPlayerIds }: { state: ScotlandYardState; localPlayerIds: string[] }) {
  return (
    <>
      {state.players.map(player => {
        const isMrX = player.role === 'MR_X';
        const isRevealed = state.mrXRevealedTurns.includes(state.mrXLog.length);
        const isMrXActiveTurn = state.activePlayerId === player.id;

        let showToken = true;

        if (isMrX) {
          const isLocal = localPlayerIds.includes(player.id);
          const isHotSeat = localPlayerIds.length > 1;

          if (isHotSeat) {
            showToken = isRevealed || isMrXActiveTurn || state.status === 'FINISHED';
          } else if (!isLocal) {
            showToken = isRevealed || state.status === 'FINISHED';
          }
        }

        if (!showToken) return <MrXShadow key={`shadow-${player.id}`} />;

        const pos = scotlandYardPositions[player.position];
        if (!pos) return null;

        const isActive = player.id === state.activePlayerId;
        const color = isMrX ? '#000000' : (player.id.charCodeAt(0) % 2 === 0 ? '#3b82f6' : '#ec4899');

        return (
          <g key={`player-${player.id}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ transition: 'transform 0.5s ease-in-out' }}>
            {isActive && (
              <circle r="24" fill="transparent" stroke="#fbbf24" strokeWidth="4" className="animate-spin-slow" strokeDasharray="10 5" />
            )}
            <circle r="10" fill={color} stroke="#ffffff" strokeWidth="2" />
            {isMrX && <text y="4" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" pointerEvents="none">X</text>}
          </g>
        )
      })}
    </>
  );
});

export const ScotlandYardBoard = memo(function ScotlandYardBoard({ state, localPlayerIds }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(0.5);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateFit = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const scale = Math.min(rect.width / VIEWPORT_WIDTH, rect.height / VIEWPORT_HEIGHT);
        const capped = Math.max(0.1, Math.min(scale, 1.2));
        setFitScale(capped);
        setReady(true);
      }
    };

    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(el);
    window.addEventListener('resize', updateFit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateFit);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative">
      {ready && (
      <TransformWrapper
        initialScale={fitScale}
        initialPositionX={0}
        initialPositionY={0}
        minScale={0.1}
        maxScale={3}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.005 }}
        pinch={{ step: 0.005 }}
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
                style={{ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, backgroundColor: '#0f172a' }}
              >
                <StaticGraph />
                {state && <PlayerTokens state={state} localPlayerIds={localPlayerIds} />}
              </svg>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
      )}
    </div>
  );
});
