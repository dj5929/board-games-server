import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { CatanRoom } from './components/CatanRoom';
import { ScotlandYardRoom } from './components/ScotlandYardRoom';

import { AudioToggle } from './components/AudioToggle';

interface GameConfig {
  roomId: string;
  localPlayerIds: string[];
  gameType: 'monopoly' | 'catan' | 'scotland-yard';
  sessionToken: string;
}

function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <AudioToggle />
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {!gameConfig ? (
          <Lobby onJoinRoom={(roomId, localPlayerIds, gameType, sessionToken) => setGameConfig({ roomId, localPlayerIds, gameType, sessionToken })} />
        ) : (
          gameConfig.gameType === 'monopoly' ? 
            <GameRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} /> :
          gameConfig.gameType === 'catan' ?
            <CatanRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} /> :
            <ScotlandYardRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} sessionToken={gameConfig.sessionToken} onLeave={() => setGameConfig(null)} />
        )}
      </main>
    </div>
  );
}

export default App;
