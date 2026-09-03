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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <AudioToggle />
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <Suspense fallback={<LoadingFallback />}>
          {!gameConfig ? (
            <Lobby onJoinRoom={(roomId, localPlayerIds, gameType, sessionToken) => setGameConfig({ roomId, localPlayerIds, gameType, sessionToken })} />
          ) : (
            gameConfig.gameType === 'monopoly' ? 
              <GameRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} /> :
            gameConfig.gameType === 'catan' ?
              <CatanRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} /> :
              <ScotlandYardRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} />
          )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
