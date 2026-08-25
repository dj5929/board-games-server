# Architectural Golden Rules

* **Rule 1: The Core is Pure.** The game engine (`@packages/monopoly-engine` or `@packages/engine-core`) must NEVER import networking, database, or UI libraries. It must be a purely deterministic state machine: `(currentState, playerAction) => Result<{ nextState, events }, string>`.
* **Rule 2: Modular Game Interface.** Every board game must implement the standard `IGameEngine` interface. The WebSocket server should not know the rules of Monopoly; it only routes standard actions to the engine.
* **Rule 3: Immutability.** Never mutate the state object directly. Always use deep cloning (e.g., `structuredClone` or Immer) to return a fresh state object. Enforce this immutability at compile time using TypeScript's `readonly` keyword on all state arrays and object properties.
* **Rule 4: Invert Randomness.** Dice rolls and card shuffling must use a seedable Random Number Generator (RNG) passed in as a dependency, so all game logic can be predictably unit-tested.
