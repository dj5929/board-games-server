import type { CatanPlayer } from '@packages/catan-engine';
import type { PlayerId } from '@packages/engine-core';

interface Props {
  victims: CatanPlayer[];
  onSelect: (playerId: PlayerId) => void;
  onCancel: () => void; // If they want to pick a different hex, they cancel this
}

export function CatanRobberVictimModal({ victims, onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative text-center">
        <h2 className="text-2xl font-bold text-white mb-2 text-red-500">Steal Resource</h2>
        <p className="text-gray-300 text-sm mb-6">
          Choose a player to steal a random resource from.
        </p>

        {victims.length === 0 ? (
          <div className="mb-6">
            <p className="text-gray-500 mb-4">No players have resources here.</p>
            <button 
              onClick={() => onSelect(undefined as any)}
              className="w-full p-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
            >
              Confirm Placement
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {victims.map(v => (
              <button 
                key={v.id}
                onClick={() => onSelect(v.id)}
                className="w-full p-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="font-bold text-white">{v.id}</span>
                </div>
                <span className="text-xs text-gray-500">({Object.values(v.resources).reduce((a, b) => a + b, 0)} cards)</span>
              </button>
            ))}
          </div>
        )}

        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-white underline text-sm"
        >
          Cancel (Pick different hex)
        </button>
      </div>
    </div>
  );
}
