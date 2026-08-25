---
name: monopoly-engine
description: Use this skill when working on the Monopoly engine to understand the official rules and edge cases.
---
# Monopoly Game Logic (Official Rules)

**Preparation**: 
- Players start with $1500.

**Movement & Turn**:
- If a player rolls doubles, they take another turn. If they roll doubles three times in a row, they go immediately to Jail.
- Passing "GO" grants the player $200 from the Bank.

**Banker & Properties**: 
- The Bank never "goes broke." If it runs out of money, it may issue as much as needed by writing on ordinary paper.
- Unowned properties landed on must be bought or auctioned. The auction starts at any price. 
- Base rent applies to unowned properties if bought, but owned properties charge rent depending on the state of the property.
- When all properties of a color group are owned by one player (Monopoly), the rent for unimproved properties in that group is doubled.

**Railroads & Utilities**:
- **Railroads**: Rent scales based on the number owned: 1 = $25, 2 = $50, 3 = $100, 4 = $200.
- **Utilities**: Rent is 4x the dice roll if one utility is owned, and 10x the dice roll if both are owned.

**Taxes**:
- Income Tax: Pay $200.
- Luxury Tax: Pay $100.

**Houses & Hotels**:
- Must be built evenly (you cannot have more than a one-house difference across properties in a color group).
- Must be sold evenly.
- Cannot be built if any property in the color group is mortgaged.
- There are exactly 32 houses and 12 hotels in the bank. If there are none left, players cannot buy them.
- If multiple players want the last houses, they are auctioned off.

**Mortgages**:
- Properties can be mortgaged for half their listed price.
- Must sell all buildings on the color group before mortgaging any property in that group.
- No rent is collected on mortgaged properties.
- Unmortgaging costs the mortgage value + 10% interest.

**Trading**:
- Players can trade cash, properties, and "Get Out of Jail Free" cards with each other at any time.
- Properties can only be traded if there are no buildings on *any* property in that color group. All buildings in the group must be sold back to the Bank before a trade can occur.

**Jail**:
- A player goes to jail if: their piece lands on "Go to Jail", they draw a "Go to Jail" card, or they roll doubles three times in a row.
- Escape by: rolling doubles on any of the next 3 turns, using a "Get Out of Jail Free" card, or paying $50 before rolling on either of the first two turns in jail. On the 3rd turn, they *must* pay $50 if they don't roll doubles.
- A player can still buy/sell properties, build/sell houses, and collect rent while in jail.

**Bankruptcy**:
- If a player owes more than they can pay (via cash, selling buildings at half price, and mortgaging), they are bankrupt.
- If bankrupt to another player: turn over all assets (properties, cash) to that player. Mortgaged properties remain mortgaged, but the new owner must immediately pay 10% interest.
- If bankrupt to the Bank: turn over all assets. The Bank immediately auctions off all properties.

