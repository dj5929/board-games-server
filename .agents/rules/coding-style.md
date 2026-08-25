# Coding Style Guide

* Prefer functional programming paradigms over heavy Object-Oriented class hierarchies.
* Export TypeScript interfaces with an `I` prefix (e.g., `IGameEngine`, `IPlayer`).
* Use explicitly discriminated unions for Actions and Events (e.g., `type PlayerAction = { type: 'ROLL_DICE' } | { type: 'BUY_PROPERTY', propertyId: string }`).
* Avoid using `any` type under any circumstances. If unknown, use `unknown` and validate with Zod.
* **Branded Types:** Use branded types (e.g., `PlayerId`, `PropertyId`) instead of `string` for unique identifiers to prevent accidental mixing of IDs.
* **Exhaustive Switch Checking:** Use a `never` fallback in switch statements for discriminated unions to ensure all actions are explicitly handled.
* **Result Pattern:** Return a `Result` union (`{ success: true, data: T } | { success: false, error: E }`) instead of silently ignoring invalid actions or throwing exceptions.
* **Immutability:** Use `readonly` for arrays and objects to enforce immutability at compile time.
* **Strict TSConfig:** Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` to catch edge cases involving nullability and missing properties.
