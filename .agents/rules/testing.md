# Testing & QA Rules

* **Unit Testing First**: Write unit tests first (TDD).
* **Test Logic Edge Cases**: When implementing mechanics (e.g. rent calculations, building rules, mortgages), always cross-reference official Monopoly rules and explicitly write test cases for edge conditions (like dynamically scaling rent for utilities/railroads based on the exact state).
* **Document Test Coverage**: Always update the Testing Matrix below after implementing tests to keep it accurate.
* **Pure Reducers**: All state mutations and game logic must be unit-tested strictly against the `MonopolyEngine.ts` pure reducers. 

---

# Testing Status Matrix

## ✅ Tests Completed (Passing)

### Core Engine (`@packages/monopoly-engine`)
1. **MVP Mechanics (Phase 2):**
   - Dice rolling resolves correctly with injected mock RNG.
   - Turn ending correctly advances `currentPlayerIndex`.
2. **Property & Rent (Phase 5):**
   - Landing on an unowned property resolves without crashing.
   - Purchasing an unowned property deducts correct funds and updates ownership.
   - Landing on an owned property auto-deducts the correct base rent and credits the owner.
   - Rent calculation accurately scales for Railroads (based on number owned).
   - Rent calculation accurately scales for Utilities (4x or 10x based on the dice roll).
3. **Monopoly Detection (Phase 8):**
   - Rent is strictly doubled if the owner holds all properties in a color group (and no houses are built).
4. **Mortgaging (Phase 8):**
   - `MORTGAGE_PROPERTY` succeeds (grants half price, sets flag) and correctly ignores mortgaged properties for rent calculations.
   - `UNMORTGAGE_PROPERTY` succeeds (deducts mortgage value + 10% interest).
   - Validates that a player cannot mortgage unowned properties.
   - Validates that a player cannot unmortgage if they have insufficient bank funds.
   - Validates that a player cannot mortgage a property if there are buildings on any property in its color group.
5. **Houses & Hotels (Phase 8):**
   - Buying a house deducts the correct `housePrice` from the bank.
   - Rent deductions dynamically scale using the `rentWithHouses` array when a property has 1-4 houses or a hotel.
   - **Even Building Rule:** Strictly blocks buying a house if it would create an uneven distribution on the color group.
   - **Even Building Rule:** Strictly blocks selling a house if it would leave the remaining properties uneven.
   - Blocks buying a house if *any* property in the color group is currently mortgaged.

6. **Cards & Special Spaces (Phase 7):**
   - **Chance & Community Chest:** Drawing cards executes payloads correctly (e.g. advance to GO, pay $50) and reshuffling logic works securely.
   - Taxes and passing GO resolve perfectly.
7. **Trading System (Phase 9):**
   - **Trading System:** Proposing, accepting, and rejecting trades work accurately. Cash and properties swap ownership securely without duplicating assets.
8. **Bankruptcy & Debt (Phase 11):**
   - **Debt Resolution:** Engine effectively halts turn actions if a player falls into debt.
   - **Bankruptcy Transfer:** A bankrupt player successfully transfers all assets (houses, mortgaged properties, cash) to the creditor or Bank.
   - **Win Condition:** Engine correctly resolves a winner and ends the game (`FINISHED` state) when only 1 active player remains, bypassing infinite loops.

### Web Client UI (Automated QA)
- **Lobby & Rooms:** Creating a room via Fastify HTTP endpoint succeeds.
- **WebSockets:** Multiple React clients successfully connect to the same live room.
- **State Sync:** Dice rolls, property purchases, rent transfers, trading, and debt all instantly reflect across connected React clients without desyncing.

---

## ⏳ Tests To Implement (Pending)

### Phase 12: Audio & Visual Polish
- [x] **UI Rendering:** Add tests for Web Client audio toggle state.
