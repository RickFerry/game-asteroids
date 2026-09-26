# AGENTS.md

Vanilla HTML5 canvas Asteroids clone. No build, no dependencies, no bundler, no package.json.

## Run

- Open `index.html` directly in a browser, or `npx serve .` (http://localhost:3000).
- `node smoke_test.js` — headless smoke test (stubs the canvas, exits non-zero on failure). Run it after touching game logic. No lint / typecheck tooling; don't invent a toolchain — the browser is the final verifier.

## Structure

- `index.html` — 800x600 canvas + inline CSS, loads `game.js` as a plain `<script>` (no `type="module"`).
- `game.js` (single ~720-line file) holds everything: input, classes (`Bullet`, `Asteroid`, `Ship`, `Particle`, `SpeedUp`, `ShieldUp`, `Comet`), `update(dt)`/`draw()`, `collideAsteroids()`, and the rAF `loop()`. Keep changes inside this file.

## Conventions

- Comments, HUD text, and README are in **Spanish**; match the language.
- Input: `keys[code]` = currently held, `pressed(code)` = edge-triggered (clears itself). One-shot actions (fire, restart) must use `pressed()`.
- Game `state` is one of `'playing' | 'dead' | 'gameover'`; `update()` branches on it first.
- Per-size constants are parallel arrays indexed by asteroid size 1..3: `RADII`, `SPEEDS`, `POINTS` (game.js:62-64). Change them together. Scalar tunables live right below (power-ups + collision + comet, game.js:66-86).
- `dt` is seconds, clamped to 0.05 in `loop()`. Use `dt` for all movement, never frame counts.
- Everything wraps toroidally via `wrap()` — **except bullets**: they die at the screen border (by design, `Bullet.update`). The asteroid collision pass computes wrap-aware deltas, so it handles pairs straddling an edge.

## Gotchas

- **README.md is ahead of the code**: it advertises power-ups and a "estrella fugaz" — the first is now real (`SpeedUp`), the second only half-exists (the `Comet` class is a separate entity, not an asteroid *type* as the README implies). Trust `game.js` as the source of truth; don't "restore" missing features unless asked.
- Power-ups share **one roll per asteroid kill** (`game.js:554`): `drop < SHIELD_CHANCE` (0.10) → `ShieldUp`, else `drop < SHIELD_CHANCE + SPEED_CHANCE` (0.22) → `SpeedUp`, else nothing. Keep the bands additive — a second independent `Math.random()` would double the total drop rate. Each power-up class owns its effect via `apply(ship)`, so the pickup loop must not grow `instanceof` branches.
- Power-up "Velocidad": collection sets `ship.speedTimer = SPEED_TIME` (5s); `THRUST * SPEED_MULT` doubles both acceleration and max speed because drag is applied per-frame (linear in `a`). Reset happens via `ship.reset()`, not manually.
- Power-up "Escudo": collection sets `ship.shieldTimer = SHIELD_TIME` (5s) and draws a pulsing green halo at `SHIELD_R` around the hull. While active, touching an asteroid **destroys it instead of killing the ship** — same `split()`/`explode()` path as a bullet kill but **no points and no drop roll**, and touching a comet **pulverizes it whole** (fragments only ever come from a bullet). Both destroy loops run before the `killShip()` branch; the shield checks come first, and `ship.invincible` still gates plain death.
- Scoring in code: small=100, medium=50, large=20 (`POINTS`). README's table matches — keep them in sync if you change either.
- Asteroid-vs-asteroid physics (`collideAsteroids()`, game.js:388) runs **only in the `playing` branch**, right after bullet kills resolve — it needs the post-filter array and adds new asteroids to it. Rules: different sizes → the smaller (if size ≥ 2) shatters via `split()` and the bigger absorbs `IMPULSE_SHARE` of the impulse; equal sizes → elastic bounce + a spawned size-1 chip. Size-1 rocks never break from collisions. **Collisions award no points** — shooting is the only scoring path (otherwise ramming would out-score shooting).
- Comet: born only from a **size-3 kill** (`COMET_CHANCE` = 5%), at `2 * SPEEDS[3]` for `COMET_TTL` (10s), worth 500. Shot → splits into 3 fragments (worth 0, so shooting comets can't be farmed) that still kill the ship. It lives in its own `comets` array, **not** in `asteroids`, on purpose: it must not block the `asteroids.length === 0` level-clear check, and `nextLevel()` wipes it. Birth point is pushed to `COMET_SAFE` from the ship so a point-blank kill can't insta-kill you.
