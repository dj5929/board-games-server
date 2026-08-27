

interface Props {
  game: 'CATAN' | 'MONOPOLY';
  onClose: () => void;
}

export function RulebookModal({ game, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 p-6 md:p-8 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 animate-fade-in-up overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">
            {game === 'CATAN' ? 'Catan Rules' : 'Monopoly Rules'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        
        <div className="text-gray-300 space-y-4">
          {game === 'CATAN' ? (
            <>
              <h3 className="text-xl font-bold text-orange-400">Objective</h3>
              <p>Be the first player to reach <strong>10 Victory Points (VP)</strong>.</p>
              
              <h3 className="text-xl font-bold text-orange-400 mt-4">On Your Turn</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Roll Dice:</strong> Generates resources for all players whose settlements/cities are adjacent to the terrain hex with the rolled number.</li>
                <li><strong>Trade:</strong> Trade resources with other players, or with the Bank (4 of one resource for 1 of another).</li>
                <li><strong>Build:</strong> Build roads, settlements, or upgrade to cities using your resources.</li>
              </ul>
              
              <h3 className="text-xl font-bold text-orange-400 mt-4">Building Costs & VP</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Road:</strong> 1 Wood, 1 Brick</li>
                <li><strong>Settlement:</strong> 1 Wood, 1 Brick, 1 Wheat, 1 Sheep (Worth 1 VP, gives 1 resource when rolled)</li>
                <li><strong>City:</strong> 2 Wheat, 3 Ore (Worth 2 VP, gives 2 resources when rolled)</li>
              </ul>
              
              <h3 className="text-xl font-bold text-orange-400 mt-4">The Robber (Rolling a 7)</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>No resources are produced.</li>
                <li>Any player with more than 7 resource cards must discard half of them (rounded down).</li>
                <li>The player who rolled the 7 moves the Robber to a new hex, blocking its resource production.</li>
              </ul>

              <h3 className="text-xl font-bold text-orange-400 mt-4">Progression Strategy</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Early Game:</strong> Prioritize Wood and Brick to build roads and new settlements. Try to secure high-probability hexes (6s and 8s).</li>
                <li><strong>Mid Game:</strong> Focus on Wheat and Ore to upgrade settlements into Cities. If you have excess of one resource, build near a 3:1 port or a specialized 2:1 port.</li>
                <li><strong>Late Game:</strong> Buy Development Cards to secure hidden Victory Points or knights. Compete for the Longest Road or Largest Army (worth 2 VP each).</li>
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-blue-400">Objective</h3>
              <p>Become the wealthiest player through buying, renting, and trading properties, forcing all other players into bankruptcy.</p>
              
              <h3 className="text-xl font-bold text-blue-400 mt-4">On Your Turn</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Roll Dice:</strong> Move your token forward the number of spaces rolled.</li>
                <li><strong>Unowned Properties:</strong> If you land on an unowned property, you may buy it for its listed price.</li>
                <li><strong>Owned Properties:</strong> If you land on a property owned by another player, you must pay them rent.</li>
                <li><strong>Special Spaces:</strong> Follow the instructions if you land on Chance, Community Chest, Tax spaces, or Go to Jail.</li>
              </ul>
              
              <h3 className="text-xl font-bold text-blue-400 mt-4">Jail</h3>
              <p>You go to Jail if you:</p>
              <ul className="list-disc pl-5 space-y-2 mb-2">
                <li>Land on the "Go to Jail" space.</li>
                <li>Draw a "Go to Jail" card.</li>
                <li>Roll doubles three times in a row.</li>
              </ul>
              <p>To get out, you can:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Pay a $50 fine before rolling the dice.</li>
                <li>Use a "Get Out of Jail Free" card.</li>
                <li>Roll doubles.</li>
              </ul>
              
              <h3 className="text-xl font-bold text-blue-400 mt-4">Bankruptcy</h3>
              <p>If you owe more money than you can pay, you are bankrupt and must retire from the game.</p>

              <h3 className="text-xl font-bold text-blue-400 mt-4">Progression Strategy</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Early Game:</strong> Buy as many properties as possible. Railroads are highly valuable early on for consistent income. Don't worry too much about monopolies yet.</li>
                <li><strong>Mid Game:</strong> Focus on completing color sets through trading. The Orange and Red properties are statistically the most landed on due to players leaving Jail.</li>
                <li><strong>Late Game:</strong> Build houses and hotels aggressively on your monopolies. If you go to Jail in the late game, stay there as long as possible to avoid landing on opponents' deadly properties while collecting your own rent.</li>
              </ul>
            </>
          )}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold shadow-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
