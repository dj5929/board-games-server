import { useEffect, useState, useRef } from 'react';

interface Props {
  playerId: string;
  playerIndex: number;
  targetPosition: number;
}

const PLAYER_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];

export function PlayerToken({ playerId, playerIndex, targetPosition }: Props) {
  const [visualPosition, setVisualPosition] = useState(targetPosition);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const tokenRef = useRef<HTMLDivElement>(null);

  // Animate to target position step-by-step
  useEffect(() => {
    if (visualPosition === targetPosition) return;

    const timer = setTimeout(() => {
      setVisualPosition((prev) => {
        const next = (prev + 1) % 40;
        // Optional: slight ticking sound as token moves space by space?
        // SoundEngine.playDiceRoll(); // Or another very quiet tick
        return next;
      });
    }, 200); // 200ms per space

    return () => clearTimeout(timer);
  }, [visualPosition, targetPosition]);

  // Update DOM coordinates based on visualPosition
  useEffect(() => {
    const updateCoords = () => {
      const spaceEl = document.querySelector(`[data-space-index="${visualPosition}"]`);
      if (spaceEl && tokenRef.current) {
        const spaceRect = spaceEl.getBoundingClientRect();
        // We need to place it relative to the closest relative container
        // But since we are absolutely positioned in a full-screen or board context, 
        // it's better to rely on a shared offset parent.
        // Let's assume the parent of all tokens is a relative container that covers the whole board.
        const boardEl = document.getElementById('board-container');
        if (boardEl) {
          const boardRect = boardEl.getBoundingClientRect();
          const x = spaceRect.left - boardRect.left + spaceRect.width / 2;
          const y = spaceRect.top - boardRect.top + spaceRect.height / 2;
          setCoords({ x, y });
        }
      }
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    // Might need a small delay on initial mount to ensure layout is done
    setTimeout(updateCoords, 100);

    return () => window.removeEventListener('resize', updateCoords);
  }, [visualPosition]);

  // Offset based on player index so they don't perfectly overlap
  const offsetX = (playerIndex % 2 === 0 ? -6 : 6) + (playerIndex > 1 ? 6 : 0);
  const offsetY = (playerIndex < 2 ? -6 : 6) + (playerIndex % 2 === 0 ? 0 : 6);

  return (
    <div
      ref={tokenRef}
      title={playerId}
      className={`absolute w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white shadow-lg z-20 ${PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]}`}
      style={{
        left: coords ? coords.x + offsetX : 0,
        top: coords ? coords.y + offsetY : 0,
        opacity: coords ? 1 : 0,
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.2s linear, top 0.2s linear, opacity 0.2s',
      }}
    />
  );
}
