import { useEffect, useState } from 'react';

export interface SpaceCoords {
  [position: number]: { x: number; y: number };
}

interface Props {
  playerId: string;
  playerIndex: number;
  targetPosition: number;
  spaceCoords: SpaceCoords | null;
}

const PLAYER_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];

export function PlayerToken({ playerId, playerIndex, targetPosition, spaceCoords }: Props) {
  const [visualPosition, setVisualPosition] = useState(targetPosition);

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

  // Positions are measured once per board by MonopolyBoard and passed down, so a
  // token never queries the DOM or forces its own layout reflow.
  const coords = spaceCoords?.[visualPosition] ?? null;

  // Offset based on player index so they don't perfectly overlap
  const offsetX = (playerIndex % 2 === 0 ? -6 : 6) + (playerIndex > 1 ? 6 : 0);
  const offsetY = (playerIndex < 2 ? -6 : 6) + (playerIndex % 2 === 0 ? 0 : 6);

  return (
    <div
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
