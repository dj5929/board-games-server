import { useEffect, useState } from 'react';
import { GAME_CONFIGS, type GameType } from '@packages/engine-core';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ROOM_POLL_MS = 5000;

/** A single row of the server's public room browser (`GET /rooms`). */
export interface RoomSummary {
  roomId: string;
  gameType: GameType;
  label: string;
  seats: number;
  capacity: number;
  connectedCount: number;
  availableSeats: number;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';
  isFull: boolean;
  isHotSeat: boolean;
  botCount: number;
  hasBots: boolean;
  spectatorCount: number;
}

const GAME_BADGE: Record<GameType, { bg: string; initial: string }> = {
  'monopoly': { bg: 'bg-blue-600', initial: 'M' },
  'catan': { bg: 'bg-orange-600', initial: 'C' },
  'scotland-yard': { bg: 'bg-green-700', initial: 'SY' },
};

interface Props {
  onJoinRoom: (roomId: string, localPlayerIds: string[], gameType: GameType, sessionToken: string) => void;
  onSpectate: (roomId: string, gameType: GameType, spectatorId: string, token: string) => void;
}

export function Lobby({ onJoinRoom, onSpectate }: Props) {
  const [joinId, setJoinId] = useState('');
  const [spectateId, setSpectateId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const [playerCount, setPlayerCount] = useState<number>(GAME_CONFIGS['monopoly'].minPlayers);
  const [gameType, setGameType] = useState<GameType>('monopoly');
  const [botCount, setBotCount] = useState<number>(0);
  const [isPublic, setIsPublic] = useState(true);
  const [roomFilter, setRoomFilter] = useState<'all' | GameType>('all');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  // Live public-room directory. Polled so the Lobby reflects joiners leaving,
  // games starting, and newly created rooms without a separate push channel.
  // Re-runs whenever the game-type filter changes (server-side `?gameType=`).
  useEffect(() => {
    let cancelled = false;
    const query = roomFilter === 'all' ? '' : `?gameType=${roomFilter}`;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/rooms${query}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.rooms)) setRooms(data.rooms as RoomSummary[]);
      } catch {
        // The server may be starting up; keep polling silently.
      }
    };
    load();
    const interval = setInterval(load, ROOM_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomFilter]);

  const selectGameType = (type: GameType) => {
    setGameType(type);
    const config = GAME_CONFIGS[type];
    const clamped = Math.min(Math.max(playerCount, config.minPlayers), config.maxPlayers);
    setPlayerCount(clamped);
    // The creator's first seat is always a human, so bots may never fill it.
    setBotCount((prev) => Math.min(prev, clamped - 1));
  };

  const requestJoin = async (targetId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${targetId}/join`, { method: 'POST' });
      if (res.status === 404) throw new Error('Room not found');
      if (res.status === 400) throw new Error('Room is full');

      const data = await res.json();
      if (data.playerId) {
        onJoinRoom(targetId, [data.playerId], data.gameType || 'monopoly', data.sessionToken);
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to join room');
    }
    setIsLoading(false);
  };

  const requestSpectate = async (targetId: string) => {
    setIsSpectating(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(targetId)}/spectate`, { method: 'POST' });
      if (res.status === 404) throw new Error('Room not found');

      const data = await res.json();
      if (data.spectatorId) {
        onSpectate(data.roomId, data.gameType || 'monopoly', data.spectatorId, data.token);
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to watch room');
    }
    setIsSpectating(false);
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      // Bots always occupy the tail seats (pN, pN-1, ...); p1 stays human.
      const botIds = Array.from({ length: botCount }, (_, i) => `p${playerCount - botCount + 1 + i}`);
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount, gameType, hotSeat: mode === 'local', bots: botIds, isPublic })
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

  const handleJoin = () => {
    if (joinId) requestJoin(joinId.trim());
  };

  const handleSpectate = () => {
    if (spectateId) requestSpectate(spectateId.trim());
  };

  return (
    <div className="w-full max-w-xl bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700 flex flex-col gap-6">
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
            aria-label="Select Monopoly"
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gameType === 'monopoly' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Monopoly
          </button>
          <button
            onClick={() => selectGameType('catan')}
            aria-label="Select Catan"
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${gameType === 'catan' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Catan
          </button>
          <button
            onClick={() => selectGameType('scotland-yard')}
            aria-label="Select Scotland Yard"
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

        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
            aria-label="Public room"
          />
          <span className="text-sm text-gray-300">List this room in the public browser</span>
        </label>
      </div>

      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow hover:shadow-blue-500/25 active:scale-95 disabled:opacity-50"
      >
        {isLoading ? 'Creating...' : 'Create New Game'}
      </button>

      <div className="flex flex-col gap-3 p-4 bg-gray-900 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Open Rooms</span>
          <span className="text-xs text-gray-500">{rooms.length} live</span>
        </div>
        <div className="flex gap-1.5 flex-wrap" aria-label="Filter public rooms by game">
          {(['all', 'monopoly', 'catan', 'scotland-yard'] as const).map((type) => {
            const active = roomFilter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                aria-label={type === 'all' ? 'Show all rooms' : `Filter to ${GAME_CONFIGS[type].label} rooms`}
                onClick={() => setRoomFilter(type)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? type === 'all'
                      ? 'bg-gray-700 text-white'
                      : GAME_BADGE[type].bg
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {type === 'all' ? 'All' : GAME_CONFIGS[type].label}
              </button>
            );
          })}
        </div>
        {rooms.length === 0 ? (
          <p className="text-xs text-gray-500">
            {roomFilter === 'all'
              ? 'No public rooms right now. Create one above to appear here.'
              : `No ${GAME_CONFIGS[roomFilter].label} rooms right now.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {rooms.map((room) => {
              const badge = GAME_BADGE[room.gameType] ?? GAME_BADGE.monopoly;
              const statusTone =
                room.status === 'LOBBY'
                  ? 'bg-blue-900/50 text-blue-400 border-blue-800'
                  : room.status === 'IN_PROGRESS'
                    ? 'bg-green-900/50 text-green-400 border-green-800'
                    : 'bg-gray-800 text-gray-500 border-gray-700';
              const statusLabel =
                room.status === 'LOBBY' ? 'Open' : room.status === 'IN_PROGRESS' ? 'Playing' : 'Ended';
              return (
                <li key={room.roomId} className="flex items-center gap-3 bg-gray-800 rounded-lg border border-gray-700 p-2.5">
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-white text-xs ${badge.bg}`}>
                    {badge.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{room.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusTone}`}>{statusLabel}</span>
                      {room.isHotSeat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800">Hot Seat</span>
                      )}
                      {room.hasBots && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400 border border-purple-800">
                          {room.botCount} Bot{room.botCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{room.roomId}</span>
                      {` · ${room.connectedCount}/${room.seats} seats taken · ${room.availableSeats} open${room.spectatorCount > 0 ? ` · ${room.spectatorCount} watching` : ''}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => requestJoin(room.roomId)}
                      disabled={room.availableSeats === 0 || isLoading}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        room.availableSeats === 0
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {room.availableSeats === 0 ? 'Full' : 'Join'}
                    </button>
                    <button
                      onClick={() => requestSpectate(room.roomId)}
                      disabled={isSpectating}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-teal-300 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800 transition-colors"
                    >
                      Watch
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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

      <div className="flex flex-col gap-2 p-4 bg-gray-900 rounded-xl border border-gray-700">
        <p className="text-sm text-gray-400">
          Or watch a game as a <span className="text-teal-400 font-semibold">spectator</span> — no seat required.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room ID to watch"
            value={spectateId}
            onChange={(e) => setSpectateId(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:border-teal-500 transition-colors"
          />
          <button
            onClick={handleSpectate}
            disabled={!spectateId || isSpectating}
            className="bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow hover:shadow-teal-500/25 active:scale-95 disabled:opacity-50"
          >
            {isSpectating ? 'Connecting...' : 'Spectate'}
          </button>
        </div>
      </div>
    </div>
  );
}
