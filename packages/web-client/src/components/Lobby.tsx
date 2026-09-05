import { useState } from 'react';
import { GAME_CONFIGS, type GameType } from '@packages/engine-core';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Props {
  onJoinRoom: (roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void;
}

export function Lobby({ onJoinRoom }: Props) {
  const [joinId, setJoinId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const [playerCount, setPlayerCount] = useState<number>(GAME_CONFIGS['monopoly'].minPlayers);
  const [gameType, setGameType] = useState<GameType>('monopoly');
  const [botCount, setBotCount] = useState<number>(0);

  const selectGameType = (type: GameType) => {
    setGameType(type);
    const config = GAME_CONFIGS[type];
    const clamped = Math.min(Math.max(playerCount, config.minPlayers), config.maxPlayers);
    setPlayerCount(clamped);
    // The creator's first seat is always a human, so bots may never fill it.
    setBotCount((prev) => Math.min(prev, clamped - 1));
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      // Bots always occupy the tail seats (pN, pN-1, ...); p1 stays human.
      const botIds = Array.from({ length: botCount }, (_, i) => `p${playerCount - botCount + 1 + i}`);
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount, gameType, hotSeat: mode === 'local', bots: botIds })
      });
      const data = await res.json();
      if (data.roomId) {
        const localPlayerIds = mode === 'local' ? data.playerIds : [data.playerIds[0]];
        onJoinRoom(data.roomId, localPlayerIds, data.gameType || gameType, data.sessionToken);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to create room. Is the server running?');
    }
    setIsLoading(false);
  };

  const handleJoin = async () => {
    if (!joinId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${joinId}/join`, { method: 'POST' });
      if (res.status === 404) throw new Error('Room not found');
      if (res.status === 400) throw new Error('Room is full');

      const data = await res.json();
      if (data.playerId) {
        onJoinRoom(joinId, [data.playerId], data.gameType || 'monopoly', data.sessionToken);
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to join room');
    }
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700 flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-center">Welcome to the Lobby</h2>

      <div className="flex flex-col gap-3 p-4 bg-gray-900 rounded-xl border border-gray-700">
        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Game Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('online')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${mode === 'online' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Online
          </button>
          <button
            onClick={() => setMode('local')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${mode === 'local' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Hot Seat (Local)
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {mode === 'online' ? 'Connect from another machine to play together. You control the first seat.' : 'All players share this screen and take turns.'}
        </p>

        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-2">Game</label>
        <div className="flex gap-2">
          <button
            onClick={() => selectGameType('monopoly')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gameType === 'monopoly' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Monopoly
          </button>
          <button
            onClick={() => selectGameType('catan')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gameType === 'catan' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Catan
          </button>
          <button
            onClick={() => selectGameType('scotland-yard')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gameType === 'scotland-yard' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Scotland Yard
          </button>
        </div>

        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-2">Players</label>
        <select
          aria-label="Number of players"
          value={playerCount}
          onChange={e => {
            const next = Number(e.target.value);
            setPlayerCount(next);
            setBotCount(prev => Math.min(prev, next - 1));
          }}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white outline-none focus:border-blue-500"
        >
          {Array.from(
            { length: GAME_CONFIGS[gameType].maxPlayers - GAME_CONFIGS[gameType].minPlayers + 1 },
            (_, i) => GAME_CONFIGS[gameType].minPlayers + i
          ).map(count => (
            <option key={count} value={count}>{count} Players</option>
          ))}
        </select>

        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider mt-2">Computer Players (Bots)</label>
        <select
          aria-label="Computer players"
          value={botCount}
          onChange={e => setBotCount(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2 text-white outline-none focus:border-purple-500"
        >
          {Array.from({ length: playerCount }, (_, i) => i).map(bots => (
            <option key={bots} value={bots}>
              {bots === 0 ? 'None' : bots === 1 ? '1 Computer' : `${bots} Computers`}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Computer players auto-fill from the last seat; the first seat always stays a human slot.
        </p>
      </div>

      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow hover:shadow-blue-500/25 active:scale-95 disabled:opacity-50"
      >
        {isLoading ? 'Creating...' : 'Create New Game'}
      </button>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-gray-600"></div>
        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">or join a room</span>
        <div className="flex-grow border-t border-gray-600"></div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Room ID"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={handleJoin}
          disabled={!joinId || isLoading}
          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow hover:shadow-purple-500/25 active:scale-95 disabled:opacity-50"
        >
          Join
        </button>
      </div>
    </div>
  );
}
