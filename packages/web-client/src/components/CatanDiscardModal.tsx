import { useState } from 'react';
import type { ResourceType } from '@packages/catan-engine';

interface Props {
  requiredAmount: number;
  resources: Record<Exclude<ResourceType, 'DESERT'>, number>;
  onSubmit: (discarded: Record<Exclude<ResourceType, 'DESERT'>, number>) => void;
}

export function CatanDiscardModal({ requiredAmount, resources, onSubmit }: Props) {
  const [discarded, setDiscarded] = useState<Record<Exclude<ResourceType, 'DESERT'>, number>>({
    WOOD: 0,
    BRICK: 0,
    SHEEP: 0,
    WHEAT: 0,
    ORE: 0,
  });

  const totalDiscarded = Object.values(discarded).reduce((a, b) => a + b, 0);

  const handleAdjust = (res: Exclude<ResourceType, 'DESERT'>, delta: number) => {
    const current = discarded[res];
    const next = current + delta;
    if (next < 0 || next > resources[res]!) return;
    if (delta > 0 && totalDiscarded >= requiredAmount) return;
    
    setDiscarded(prev => ({ ...prev, [res]: next }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-red-500/50 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative">
        <h2 className="text-2xl font-bold text-white mb-2 text-center text-red-500">The Robber Strikes!</h2>
        <p className="text-gray-300 text-sm text-center mb-6">
          You have more than 7 resources. You must discard {requiredAmount} cards.
        </p>

        <div className="space-y-3 mb-6">
          {(Object.keys(resources) as Exclude<ResourceType, 'DESERT'>[]).map(res => (
            <div key={res} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg">
              <div className="flex gap-2 items-center">
                <span className="font-bold text-gray-200">{res}</span>
                <span className="text-xs text-gray-500">(Have: {resources[res]})</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleAdjust(res, -1)}
                  disabled={discarded[res] === 0}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 font-bold"
                >-</button>
                <span className="w-4 text-center font-bold text-red-400">{discarded[res]}</span>
                <button 
                  onClick={() => handleAdjust(res, 1)}
                  disabled={discarded[res] === resources[res] || totalDiscarded >= requiredAmount}
                  className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 font-bold"
                >+</button>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => onSubmit(discarded)}
          disabled={totalDiscarded !== requiredAmount}
          className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {totalDiscarded === requiredAmount ? 'Confirm Discard' : `Select ${requiredAmount - totalDiscarded} more`}
        </button>
      </div>
    </div>
  );
}
