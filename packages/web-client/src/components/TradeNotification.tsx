import type { IMonopolyState } from '@packages/monopoly-engine';
import { BOARD_SPACES } from '@packages/monopoly-engine';

interface Props {
  state: IMonopolyState;
  onAccept: () => void;
  onReject: () => void;
}

export function TradeNotification({ state, onAccept, onReject }: Props) {
  const trade = state.activeTrade;
  if (!trade) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col">
        <h2 className="text-2xl font-bold text-white mb-4">Trade Offer Received</h2>
        <p className="text-gray-300 mb-6">
          <span className="font-bold text-blue-400">{trade.fromPlayerId}</span> has proposed a trade to you.
        </p>

        <div className="flex flex-col gap-4 mb-6">
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold text-green-400 mb-2">You Will Receive:</h3>
            <ul className="text-gray-300 list-disc list-inside">
              {trade.offeredMoney > 0 && <li>${trade.offeredMoney}</li>}
              {trade.offeredProperties.map(id => {
                const space = BOARD_SPACES.find(s => s.id === id);
                return <li key={id}>{space?.name}</li>;
              })}
              {trade.offeredMoney === 0 && trade.offeredProperties.length === 0 && <li>Nothing</li>}
            </ul>
          </div>

          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold text-red-400 mb-2">You Will Give:</h3>
            <ul className="text-gray-300 list-disc list-inside">
              {trade.requestedMoney > 0 && <li>${trade.requestedMoney}</li>}
              {trade.requestedProperties.map(id => {
                const space = BOARD_SPACES.find(s => s.id === id);
                return <li key={id}>{space?.name}</li>;
              })}
              {trade.requestedMoney === 0 && trade.requestedProperties.length === 0 && <li>Nothing</li>}
            </ul>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <button 
            onClick={onReject}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-md transition-colors"
          >
            Reject
          </button>
          <button 
            onClick={onAccept}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-md transition-colors"
          >
            Accept Trade
          </button>
        </div>
      </div>
    </div>
  );
}
