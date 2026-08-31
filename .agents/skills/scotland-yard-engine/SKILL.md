---
name: scotland-yard-engine
description: Use this skill when working on the Scotland Yard engine to understand the official rules and edge cases.
---
# Scotland Yard Game Logic (Official Rules)

**Overview**: One player is "Mr. X" and the others are detectives. All travel around a map of London using tickets (the "ticket economy"). Mr. X moves in secret; the detectives try to catch him.

**Preparation**:
- The board has numbered locations connected by colored routes (solid, dashed, and ferries).
- Mr. X starts at a hidden location; each detective starts at a location determined by the start of the game.
- Each detective receives 11 bus tickets, 8 taxi tickets, and 4 underground (metro) tickets.
- Mr. X receives 4 taxi tickets, 3 bus tickets, 3 underground tickets, and 2 double-move tickets (hidden from the detectives).
- A travel log records Mr. X's boarding/transport types each turn.

**Movement & Turn**:
- The game proceeds in turns. On each turn, every detective moves first (in turn order), then Mr. X moves.
- A player moves from their current location to an adjacent location along a route.
- The transport used must match the route color and is the only way to traverse that route.

**Ticket Types & Routes**:
- **Taxi (solid, black)**: Two locations connected by a solid black line.
- **Bus (dashed, gray)**: Two locations connected by a dashed line.
- **Underground/Metro (red)**: Two locations connected by a solid red line.
- **Ferry (water)**: Two locations connected by a blue line across water; requires a special ferry ticket (ferries are printed with their own color / separate from the standard three ticket types).

**Ticket Economy**:
- Using a ticket requires spending the corresponding ticket.
- If a player has no ticket of the required type, they cannot use that route.
- Detectives' tickets are replenished after each "round" of travel (each detective receives a new set of tickets at the start of each round).
- Mr. X does not get free tickets every round; he must manage his limited supply.

**Mr. X's Hidden Movement**:
- Mr. X's current location is always hidden from the detectives.
- Each turn, after moving, Mr. X reveals a "clue": the transport type he used on that move.
- Mr. X must reveal (show) his true location on turns that appear in the "reveal" positions of the travel log (typically turns 3, 8, 13, 18, 23).
- If Mr. X uses a double-move ticket, he moves twice and reveals only the transport of the second move (in some versions, he reveals nothing for a double move).

**Double-Move Tickets**:
- Mr. X has 2 double-move tickets that allow him to move twice in one turn.
- He may not use a double-move ticket on a turn in which he is required to reveal his location.
- Using a double move consumes a ticket for each move made (and consumes the double-move ticket itself).

**Transport Log / Clue Sheet**:
- The log records the sequence of Mr. X's moves by transport type.
- When Mr. X is required to reveal, the detectives mark his location; otherwise they narrow down the possible starting/current locations based on the transport types used.

**Winning**:
- **Detectives win** if a detective catches Mr. X, i.e., moves onto his current location, or if Mr. X has no legal move on his turn (is trapped / has no tickets or routes available).
- **Mr. X wins** if he evades capture for the entire game (typically 22 turns / until the last move of the game is made without being caught).

**Key Edge Cases**:
- A detective cannot move onto another detective's location.
- A detective can move onto Mr. X's location to catch him (that is how a capture occurs).
- Mr. X cannot stay in place; every move must travel along a route.
- If Mr. X runs out of tickets or has no legal moves before the game ends, he loses.

---

## Implementation Notes (Codebase-Specific)

This section describes how the rules above are enforced in code, including the **shared / same-board** behaviour that lets everyone (including Mr. X) play on a single board.

### Engine (`packages/scotland-yard-engine`)
- `getInitialState`: Mr. X is `playerOrder[0]` and receives taxi 4 / bus 3 / underground 3 / secret `(playerCount - 1)` / double 2. Detectives receive taxi 10 / bus 8 / underground 4 / secret 0 / double 0.
- Reveal turns are `MR_X_REVEAL_TURNS = [3, 8, 13, 18, 24]`. Mr. X wins after 24 logged moves.
- `DOUBLE_MOVE` (Mr. X only) consumes a `double` token plus one ticket per leg; both legs are appended to `mrXLog`. Capture is checked after each leg.
- The engine strips `targetNode` from `PLAYER_MOVED` events on hidden turns; the reveal turn is decided by `mrXRevealedTurns.includes(mrXLog.length)`.

### Hidden-Movement & Per-Player Projection
- **`getStateForPlayer(state, playerId)`** (engine): an optional `IGameEngine` hook the server uses to scrub hidden info per connection. Scotland Yard implements it to zero out Mr. X's `position` (set to `0`, which is not a real board node) for any non-Mr-X viewer — **except** on reveal turns or when the game is `FINISHED`, when everyone may see his location. Mr. X himself always receives his true position.
- **`Room.broadcastState`** (`packages/server/src/Room.ts`): when the engine exposes `getStateForPlayer`, it sends a per-connection projected `STATE_UPDATE` instead of one shared payload, so Mr. X's real location is never leaked over the wire.

### Shared / Same-Board Visibility (`ScotlandYardBoard.tsx`)
- When **everyone plays on one shared board** (hot-seat: `localPlayerIds.length > 1`), Mr. X's token is **hidden** except when:
  - It is a reveal turn (`mrXRevealedTurns`), OR
  - It is Mr. X's own active turn (he must see his location to move), OR
  - The game is finished.
- When Mr. X is hidden, a `MrXShadow` indicator ("Mr. X is on the move...") is rendered in place of his token.
- For **private / online** single-player views: a detective viewer only sees Mr. X on reveal turns or after game over; a lone Mr. X viewer always sees his own position (the server already delivers his projected true state).
- The sidebar (`ScotlandYardRoom.tsx`) shows the Mr. X travel log, per-local-player ticket inventories (secret/double only for Mr. X), and supports node-number entry with a ticket dropdown and double-move mode — the map itself is display-only (movement is dispatched via the node input / auto-deduced tickets).
