import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { CatanRoom } from './components/CatanRoom';

import { AudioToggle } from './components/AudioToggle';

interface GameConfig {
  roomId: string;
  localPlayerIds: string[];
  gameType: 'monopoly' | 'catan';
}

function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <AudioToggle />
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {!gameConfig ? (
          <Lobby onJoinRoom={(roomId, localPlayerIds, gameType) => setGameConfig({ roomId, localPlayerIds, gameType })} />
        ) : (
          gameConfig.gameType === 'monopoly' ? 
            <GameRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} onLeave={() => setGameConfig(null)} /> :
            <CatanRoom roomId={gameConfig.roomId} localPlayerIds={gameConfig.localPlayerIds} onLeave={() => setGameConfig(null)} />
        )}
      </main>
    </div>
  );
}

export default App;
