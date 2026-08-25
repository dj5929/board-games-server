---
name: catan-engine
description: Use this skill when working on the Catan engine to understand the official rules and edge cases.
---
# Catan Game Logic (Official Rules)

**Preparation**:
- The board consists of 19 hexes (wood, brick, sheep, wheat, ore, and desert).
- Each player starts with 2 settlements and 2 roads.

**Turn Structure**:
- A turn consists of two phases, which occur in this order:
  1. **Production Phase**: Play a development card (optional), roll both dice, and collect resources (or resolve a 7).
  2. **Action Phase**: In any order (optional), the active player may:
     - Trade with other players or the supply.
     - Build roads, settlements, cities, and buy development cards.
     - Play a development card (if they did not play one before the dice roll).

**Resource Production**:
- If the dice roll is 2-6 or 8-12, all hexes with that number produce 1 resource of their type for adjacent settlements, and 2 for adjacent cities.
- The Desert produces nothing.

**The Robber & The "7" Roll**:
- If a 7 is rolled, no resources are produced.
- Any player with more than 7 resource cards must discard half (rounded down).
- The active player MUST move the Robber to a new hex.
- The active player steals 1 random resource card from an opponent who has a settlement/city adjacent to the new Robber hex.
- A hex with the Robber on it does not produce resources until the Robber is moved again.

**Building**:
- **Road (1 Wood, 1 Brick)**: Must connect to an existing friendly road, settlement, or city. A player is limited to 15 roads.
- **Settlement (1 Wood, 1 Brick, 1 Wheat, 1 Sheep)**: Must connect to a friendly road. Cannot be built adjacent to ANY existing settlement/city (Distance Rule: must be at least 2 edges away from all other buildings). A player is limited to 5 settlements. To build more, one must be upgraded to a city first.
- **City (2 Wheat, 3 Ore)**: Replaces an existing settlement. Produces 2 resources instead of 1. A player is limited to 4 cities.
- **Development Card (1 Wheat, 1 Sheep, 1 Ore)**: Kept hidden until played. Cannot be traded or given away.

**Trading**:
- **General Trade with the Supply (4:1)**: Player can trade 4 of the same resource for 1 of any other resource.
- **Port Trade with the Supply**: If a player has a building on a 3:1 port, they can trade 3 of the same resource for 1. If on a 2:1 specialized port, they can trade 2 of that specific resource for 1.
- **Trade with Other Players**: Players can trade freely with each other. During their turn, other players may only trade with the active player, not with each other or the supply. Matching resource cards cannot be traded (e.g., trading 3 ore for 1 ore is not allowed).

**Development Cards**:
- Only 1 Development Card can be played per turn.
- A Development Card cannot be played on the same turn it was bought.
- **VP Card Exception**: A player may play multiple VP cards (even on the turn they buy them) in order to win the game.

**Win Condition**:
- The first player to reach 10 or more Victory Points (VPs) on their turn wins immediately.
- VPs come from Settlements (1 VP), Cities (2 VP), Longest Route (2 VP, requires at least 5 continuous roads), Largest Army (2 VP, requires at least 3 Knight cards), and VP Development Cards (1 VP).

