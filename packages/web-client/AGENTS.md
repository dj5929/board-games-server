# UI Patterns & Best Practices

* **HUD Injection:** Instead of cluttering the board component with game logic, the active player's Heads-Up Display (HUD) and interactive controls are injected into the center of the board via the `children` prop. `GameRoom.tsx` acts as the smart container passing state down into the dumb `MonopolyBoard.tsx` presentational component.

## Board Rendering

* **Space Color Bars:** Properties use solid colors. Special spaces (Chance, Community Chest, Income/Luxury Tax) use a distinct multi-colored gradient bar to differentiate them from standard properties. Corner cells (Go, Jail, Free Parking, Go to Jail) remain colorless with no bars.
* **Token Placement:** To preserve text readability, player tokens on cells with a color bar are aligned parallel to the bar along the inner edge of the cell, rather than floating in the center. For corner cells without bars, tokens remain centered.

