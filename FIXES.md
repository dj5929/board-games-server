# 🛠️ Codebase Fixes & Improvements

This document tracks identified bugs, type safety issues, and planned improvements across the Board Game Server project.

## 🟢 Completed Fixes

### 1. `PlayerId` Type Import Error
- **Location:** `packages/web-client/src/components/CatanDevCardManager.tsx`
- **Issue:** The `PlayerId` type was incorrectly imported from `@packages/catan-engine`, which does not re-export it.
- **Fix:** Updated the import statement to pull `PlayerId` directly from `@packages/engine-core`.
- **Status:** 🟢 Fixed

### 2. Catan Engine Robber Placement Immutability Violation
- **Location:** `packages/catan-engine/src/CatanEngine.ts`
- **Issue:** The `MOVE_ROBBER` and `PLAY_KNIGHT` actions mutated the `hasRobber` property on the `hex` objects in place instead of creating deep clones, violating the strict immutability guidelines.
- **Fix:** Swapped direct mutations for shallow clones mapping of specific target hex objects (`nextBoard.hexes[targetHexIndex] = { ...nextBoard.hexes[targetHexIndex]!, hasRobber: true };`).
- **Status:** 🟢 Fixed

### 3. Monopoly Engine Reducer CPU Usage Optimization
- **Location:** `packages/monopoly-engine/src/MonopolyEngine.ts`
- **Issue:** The reducer utilized `structuredClone` on every game action, creating massive JSON serialization/deserialization CPU overheads during game loops.
- **Fix:** Replaced the deep cloning pattern with multi-level ES6 spread shallow cloning logic to drastically enhance loop efficiency.
- **Status:** 🟢 Fixed

### 4. Catan Robber Victim Modal Freeze
- **Location:** `packages/web-client/src/components/CatanRobberVictimModal.tsx`
- **Issue:** The UI lacked a confirm button when placing the robber on a hex with no victims, causing the game to freeze.
- **Fix:** Added a fallback "Confirm Placement" button to dispatch `MOVE_ROBBER` / `PLAY_KNIGHT` without a target player.
- **Status:** 🟢 Fixed

### 5. Catan Missing Toast Notifications
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** Several advanced Catan engine events were processed silently, confusing players.
- **Fix:** Added toast notification UI for `RESOURCES_DISCARDED`, `ROBBER_MOVED`, `STOLEN_RESOURCE`, `DEV_CARD_BOUGHT`, and `DEV_CARD_PLAYED`.
- **Status:** 🟢 Fixed

### 6. Road Building UI Lock
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** The UI strictly required selecting exactly two roads to play the Road Building card, with no way to cancel or place just one road, causing a soft lock.
- **Fix:** Added a contextual "Finish (Build 1 Road)" and "Cancel Road Building" button in the Turn Actions menu to safely exit or submit a single road.
- **Status:** 🟢 Fixed

### 7. Catan Trade Manager Port Detection Bug
- **Location:** `packages/web-client/src/components/CatanTradeManager.tsx`
- **Issue:** The trade manager attempted to access `adjacentEdges` from the dynamic game state vertex, which only stores ownership data. This caused maritime trade port discounts to fail.
- **Fix:** Switched to referencing the static `boardGraph.vertices` to correctly look up adjacent edges and evaluate port ownership.
- **Status:** 🟢 Fixed

### 8. Catan Room Null Player Crash
- **Location:** `packages/web-client/src/components/CatanRoom.tsx`
- **Issue:** The UI crashed when evaluating pending discards if the local player (`me`) was undefined (e.g. spectating).
- **Fix:** Added a null check before accessing `pendingDiscards[me.id]`.
- **Status:** 🟢 Fixed

## 🔴 Planned Improvements & Known Issues

*(No active known issues currently logged)*
