import { lazy, Suspense, useState } from 'react';
import { AudioToggle } from './components/AudioToggle';

const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));
const GameRoom = lazy(() => import('./components/GameRoom').then(m => ({ default: m.GameRoom })));
const CatanRoom = lazy(() => import('./components/CatanRoom').then(m => ({ default: m.CatanRoom })));
const ScotlandYardRoom = lazy(() => import('./components/ScotlandYardRoom').then(m => ({ default: m.ScotlandYardRoom })));

interface GameConfig {
  roomId: string;
  localPlayerIds: string[];
  gameType: 'monopoly' | 'catan' | 'scotland-yard';
  sessionToken: string;
  spectatorId?: string;
  roomCode?: string;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-lg animate-pulse">Loading...</div>
    </div>
  );
}

function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  const roomProps = gameConfig ? {
    roomId: gameConfig.roomId,
    localPlayerIds: gameConfig.localPlayerIds,
    sessionToken: gameConfig.sessionToken,
    spectatorId: gameConfig.spectatorId,
    roomCode: gameConfig.roomCode,
    onLeave: () => setGameConfig(null)
  } : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <AudioToggle />
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <Suspense fallback={<LoadingFallback />}>
          {!gameConfig || !roomProps ? (
            <Lobby
              onJoinRoom={(roomId, localPlayerIds, gameType, sessionToken, roomCode) => setGameConfig({ roomId, localPlayerIds, gameType, sessionToken, roomCode })}
              onSpectate={(roomId, gameType, spectatorId, token, roomCode) => setGameConfig({ roomId, localPlayerIds: [], gameType, sessionToken: token, spectatorId, roomCode })}
            />
          ) : (
            gameConfig.gameType === 'monopoly' ?
              <GameRoom {...roomProps} /> :
            gameConfig.gameType === 'catan' ?
              <CatanRoom {...roomProps} /> :
              <ScotlandYardRoom {...roomProps} />
          )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
