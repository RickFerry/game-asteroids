# AGENTS.md

Vanilla HTML5 canvas Asteroids clone. No build, no dependencies, no bundler, no package.json.

## Run

- Open `index.html` directly in a browser, or `npx serve .` (http://localhost:3000).
- `node smoke_test.js` — headless smoke test (stubs the canvas, exits non-zero on failure). Run it after touching game logic. No lint / typecheck tooling; don't invent a toolchain — the browser is the final verifier.

## Structure

- `index.html` — 800x600 canvas + inline CSS, loads `game.js` as a plain `<script>` (no `type="module"`).
- `game.js` (single ~830-line file) holds everything: input, classes (`Bullet`, `Asteroid`, `Ship`, `Particle`, `SpeedUp`, `ShieldUp`, `TripleShot`, `Comet`), the `SKINS` array (skin data), `update(dt)`/`draw()`, `collideAsteroids()`, and the rAF `loop()`. Keep changes inside this file.

## Conventions

- Comments, HUD text, and README are in **Spanish**; match the language.
- Input: `keys[code]` = currently held, `pressed(code)` = edge-triggered (clears itself). One-shot actions (fire, restart) must use `pressed()`.
- Game `state` is one of `'playing' | 'dead' | 'gameover'`; `update()` branches on it first.
- Per-size constants are parallel arrays indexed by asteroid size 1..3: `RADII`, `SPEEDS`, `POINTS` (game.js:62-64). Change them together. Scalar tunables live right below (power-ups + collision + comet, game.js:66-92), and the `SKINS` data right after (game.js:94-101).
- `dt` is seconds, clamped to 0.05 in `loop()`. Use `dt` for all movement, never frame counts.
- Everything wraps toroidally via `wrap()` — **except bullets**: they die at the screen border (by design, `Bullet.update`). The asteroid collision pass computes wrap-aware deltas, so it handles pairs straddling an edge.
- Skins are **purely cosmetic**: `SKINS` holds `color` + `hull` polygon per skin, and the hull nose must stay `x >= 19` because `tryShoot()` spawns bullets at `NOSE = 21`. `skinIndex` persists in `localStorage` (`loadSkin()`/`setSkin()`), swaps on `Digit1..n` at the very top of `update()` (before the state branches, so it works in every state), and is drawn as HUD mini-previews by `drawSkinPreviews()`. Never vary `ship.radius` per skin — the flame is anchored to the hull tail (`Math.min(...hull.map(p => p[0])) + 4`) instead of a hardcoded offset, so a new skin needs no other change.

## Gotchas

- **README.md matches the code** for Escudo, Velocidad and the comet. Trust `game.js` as the source of truth; don't "restore" missing features unless asked.
- Power-ups share **one roll per asteroid kill** (`game.js:625`): `drop < SHIELD_CHANCE` (0.10) → `ShieldUp`, `drop < SHIELD_CHANCE + SPEED_CHANCE` (0.22) → `SpeedUp`, `drop < ... + TRIPLE_CHANCE` (0.27) → `TripleShot`, else nothing. Keep the bands additive — a second independent `Math.random()` would double the total drop rate. Each power-up class owns its effect via `apply(ship)`, so the pickup loop must not grow `instanceof` branches.
- Power-up "Triplete": collection sets `ship.tripleTimer = TRIPLE_TIME` (8s) and `tryShoot()` returns 3 bullets at `-TRIPLE_SPREAD / 0 / +TRIPLE_SPREAD`. Ship stroke turns `#f4f` while triple — highest priority in the stroke chain (triple > shield > speed > skin color), since that chain is the one place all four cosmetic states meet.
- Power-up "Velocidad": collection sets `ship.speedTimer = SPEED_TIME` (5s); `THRUST * SPEED_MULT` doubles both acceleration and max speed because drag is applied per-frame (linear in `a`). Reset happens via `ship.reset()`, not manually.
- Power-up "Escudo": collection sets `ship.shieldTimer = SHIELD_TIME` (5s) and draws a pulsing green halo at `SHIELD_R` around the hull. While active, touching an asteroid **destroys it instead of killing the ship** — same `split()`/`explode()` path as a bullet kill but **no points and no drop roll**, and touching a comet **pulverizes it whole** (fragments only ever come from a bullet). Both destroy loops run before the `killShip()` branch; the shield checks come first, and `ship.invincible` still gates plain death.
- Scoring in code: small=100, medium=50, large=20 (`POINTS`). README's table matches — keep them in sync if you change either.
- Asteroid-vs-asteroid physics (`collideAsteroids()`, game.js:510) runs **only in the `playing` branch**, right after bullet kills resolve — it needs the post-filter array and adds new asteroids to it. Rules: different sizes → the smaller (if size ≥ 2) shatters via `split()` and the bigger absorbs `IMPULSE_SHARE` of the impulse; equal sizes → elastic bounce + a spawned size-1 chip. Size-1 rocks never break from collisions. **Collisions award no points** — shooting is the only scoring path (otherwise ramming would out-score shooting).
- Comet: born only from a **size-3 kill** (`COMET_CHANCE` = 5%), at `2 * SPEEDS[3]` for `COMET_TTL` (10s), worth 500. Shot → splits into 3 fragments (worth 0, so shooting comets can't be farmed) that still kill the ship. It lives in its own `comets` array, **not** in `asteroids`, on purpose: it must not block the `asteroids.length === 0` level-clear check, and `nextLevel()` wipes it. Birth point is pushed to `COMET_SAFE` from the ship so a point-blank kill can't insta-kill you.
- `smoke_test.js` runs `game.js` inside a `vm` sandbox with an **explicit list of globals** — any new global read at load time (like `localStorage`, needed by `loadSkin()`) must be stubbed in `sandbox` before `vm.runInContext`, or the suite dies before the first assert.
- `smoke_test.js` sets asteroid positions **by hand** instead of trusting `initGame()`'s random spawns, and forces `Math.random` to a fixed value for drop rolls: a randomly spawned rock near the target would catch the test's bullet first and shift the drop point (~10% flaky failures). Keep new tests deterministic the same way.
