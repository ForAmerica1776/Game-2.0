# Fish Eats Crackers

A tiny HTML5 Canvas game. Eat crackers to extend your life. Avoid obstacles. Survive as long as possible.

## How to run

- Option 1: Use any static server from this folder, then open `index.html` in a browser.
  - Python 3: `python3 -m http.server 8000` and open `http://localhost:8000/fish-crackers-game/`
  - Node: `npx serve` (or any static server)
- Option 2: Open `index.html` directly in a modern browser (may be blocked by some CSP/extension setups).

## Controls

- Move: WASD or Arrow Keys
- Dash: Space (short cooldown)

## Game rules

- Your life ticks down over time. Eat crackers to restore life and score points.
- Obstacles reduce your life on contact. There's brief invulnerability after getting hit.
- Difficulty increases over time: more obstacles, faster crackers, more frequent spawns.

Have fun!