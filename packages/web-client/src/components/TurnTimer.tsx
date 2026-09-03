import { useEffect, useState } from 'react';

export interface TurnTimerMeta {
  turnStartedAt: number;
  turnTimeLimitMs: number;
}

interface Props {
  timer: TurnTimerMeta | undefined;
  isMyTurn: boolean;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Displays a live countdown for the active player's turn using the server-sent
 * `turnStartedAt`/`turnTimeLimitMs` metadata. Auto-hides when disabled.
 */
export function TurnTimer({ timer, isMyTurn }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer || timer.turnTimeLimitMs <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timer]);

  if (!timer || timer.turnTimeLimitMs <= 0) {
    return null;
  }

  const remaining = timer.turnStartedAt + timer.turnTimeLimitMs - now;
  const ratio = remaining / timer.turnTimeLimitMs;
  const low = ratio <= 0.25;

  const label = isMyTurn
    ? 'Your turn'
    : 'Opponent turn';

  const barClass = low
    ? 'bg-red-500'
    : isMyTurn
      ? 'bg-yellow-400'
      : 'bg-blue-500';

  const textClass = low
    ? 'text-red-300'
    : 'text-gray-200';

  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-3 py-1.5 min-w-[96px] ${
      low ? 'border-red-500/60 bg-red-900/30 animate-pulse' : 'border-gray-600 bg-gray-800/80'
    }`}>
      <div className="flex justify-between items-baseline gap-3">
        <span className={`text-[10px] uppercase tracking-wider ${textClass} opacity-80`}>{label}</span>
        <span className={`font-mono font-bold tabular-nums text-sm ${textClass}`}>
          {formatRemaining(remaining)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}
