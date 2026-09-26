'use strict';
// Smoke test headless de game.js: node smoke_test.js  (sale con código != 0 si algo falla)
const fs = require('fs');
const vm = require('vm');

const ctxStub = new Proxy({}, {
  get: (t, k) => (k === 'canvas' ? undefined : () => {}),
  set: () => true,
});

const sandbox = {
  console,
  Math,
  process,
  document: { getElementById: () => ({ getContext: () => ctxStub, width: 800, height: 600 }) },
  window: { addEventListener() {} },
  requestAnimationFrame() {},
};

const TESTS = `
function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
}

initGame();
draw();
assert(__frames() > 0, 'carga y dibuja sin errores');

// drop: un solo sorteo por asteroide (banda Velocidad: 0.10 <= r < 0.22)
// asteroides fijados a mano: los del initGame() son aleatorios y pueden comerse el tiro
const realRandom = Math.random;
Math.random = () => 0.15;
asteroids = [new Asteroid(100, 100, 1), new Asteroid(700, 550, 3)];
bullets.push(new Bullet(100, 100, 0));
update(0.016);
Math.random = realRandom;
assert(powerups.length === 1, 'asteroide suelta el power-up');
assert(dist(powerups[0], { x: 100, y: 100 }) < 5, 'power-up nace donde murió el asteroide');
assert(ship.speedTimer === 0, 'sin bónus antes de colectar');

ship.x = 100; ship.y = 100;
update(0.016);
assert(powerups.length === 0, 'nave colecta el power-up');
assert(ship.speedTimer === 5, 'bónus dura 5 segundos');

ship.invincible = 999;   // que un asteroide no mate la nave en medio de los tiempos
for (let i = 0; i < 10; i++) update(0.05);
assert(Math.abs(ship.speedTimer - 4.5) < 1e-9, 'temporizador baja con dt (4.5s tras 0.5s)');
for (let i = 0; i < 100; i++) update(0.05);
assert(!(ship.speedTimer > 0), 'bónus expira a los 5s');
draw();

keys['ArrowUp'] = true;
const normal = new Ship(); normal.invincible = 0;
const boosted = new Ship(); boosted.invincible = 0; boosted.speedTimer = 5;
for (let i = 0; i < 200; i++) { normal.update(0.016); boosted.update(0.016); }
const ratio = Math.hypot(boosted.vx, boosted.vy) / Math.hypot(normal.vx, normal.vy);
assert(ratio > 1.99 && ratio < 2.01, 'velocidad máxima x2 (ratio ' + ratio.toFixed(4) + ')');
keys['ArrowUp'] = false;

ship.reset();
assert(ship.speedTimer === 0, 'reset limpia el bónus (muerte / nuevo nivel)');

// ── Física: rebote entre asteroides del mismo tamaño ──
asteroids = [];
const ra = new Asteroid(400, 300, 2); ra.vx = 55; ra.vy = 0;
const rb = new Asteroid(440, 300, 2); rb.vx = -55; rb.vy = 0;
asteroids.push(ra, rb);
const mom = ra.vx + rb.vx;
collideAsteroids();
assert(Math.abs(ra.vx + rb.vx - mom) < 1e-9, 'rebote: momento lineal conservado');
assert(ra.vx < 0 && rb.vx > 0, 'rebote: intercambian la velocidad normal');
assert(dist(ra, rb) >= ra.radius + rb.radius - 0.01, 'rebote: quedan separados');
assert(asteroids.length === 3, 'rebote: sueltan una astilla de tamaño 1');
collideAsteroids();
assert(asteroids.length === 3, 'la astilla tamaño 1 no es comida por el rebote');

// ── Física: el mayor estrella al menor ──
asteroids = [];
const bg = new Asteroid(400, 300, 3); bg.vx = 32; bg.vy = 0;
const sm = new Asteroid(460, 300, 2); sm.vx = -55; sm.vy = 0;
asteroids.push(bg, sm);
collideAsteroids();
assert(sm.dead, 'estallido: el menor es destruido');
assert(asteroids.filter(x => x.size === 1).length === 2, 'estallido: genera 2 fragmentos de tamaño 1');
assert(bg.vx < 32 && bg.vx > 0, 'estallido: el mayor pierde velocidad sin invertirse');
assert(dist(bg, asteroids.find(x => x !== bg)) >= bg.radius, 'estallido: los fragmentos nacen fuera del mayor');

// ── Bala: no pasa de una pantalla a otra ──
const bt = new Bullet(W - 5, 300, 0);
bt.update(0.016);
assert(bt.dead, 'bala muere al salir de la pantalla');
assert(bt.x > W, 'bala no reaparece del otro lado');

// ── Cometa: nacimiento ──
const r0 = Math.random;
initGame();
Math.random = () => 0;          // < COMET_CHANCE; además suelta Escudo (irrelevante aquí)
asteroids = [];
asteroids.push(new Asteroid(300, 300, 3));   // muere
asteroids.push(new Asteroid(700, 550, 3));   // sobrevive y evita nextLevel
bullets.push(new Bullet(300, 300, 0));
update(0.016);
Math.random = r0;
assert(comets.length === 1, 'cometa nace con 5% al destruir un asteroide grande');
assert(comets[0].value === COMET_POINTS && comets[0].ttl === COMET_TTL, 'cometa vale 500 y vive 10s');
assert(Math.abs(Math.hypot(comets[0].vx, comets[0].vy) - 2 * SPEEDS[3]) < 1e-9, 'cometa va 2x más rápido que el asteroide grande');
assert(dist(comets[0], ship) >= COMET_SAFE - 0.01, 'cometa no nace encima de la nave');

initGame();
Math.random = () => 0;
asteroids = [];
asteroids.push(new Asteroid(300, 300, 1));   // pequeño: no suelta cometa
asteroids.push(new Asteroid(700, 550, 3));   // evita nextLevel
bullets.push(new Bullet(300, 300, 0));
update(0.016);
Math.random = r0;
assert(comets.length === 0, 'asteroide pequeño no suelta cometa');

initGame();
Math.random = () => 0.5;        // > COMET_CHANCE
asteroids = [];
asteroids.push(new Asteroid(300, 300, 3));
asteroids.push(new Asteroid(700, 550, 3));
bullets.push(new Bullet(300, 300, 0));
update(0.016);
Math.random = r0;
assert(comets.length === 0, 'los 5% no siempre sueltan cometa');

// ── Cometa: tiro, fragmentos y puntuación ──
initGame();
asteroids = [new Asteroid(700, 550, 3)];   // lejos, evita nextLevel e interferir
const c1 = new Comet(300, 300, 0);
c1.vx = 0; c1.vy = 0;
comets = [c1];
const sc1 = score;
bullets.push(new Bullet(297, 300, 0));   // viaja 8.3px -> queda a 5.3 del cometa
update(0.016);
assert(c1.dead && score === sc1 + 500, 'tiro acierta al cometa y suma 500');
assert(comets.length === COMET_PARTS, 'cometa se parte en 3 fragmentos');
assert(comets.every(f => f.radius < c1.radius && f.ttl <= COMET_PART_TTL), 'fragmentos son más pequeños y de vida corta');

const sc2 = score;
const frag = comets[0];
comets = [frag];                       // solo el fragmento objetivo
frag.vx = 0; frag.vy = 0;
bullets.push(new Bullet(frag.x - 5, frag.y, 0));  // viaja 8.3 -> queda a 3.3 del radio 4
update(0.016);
assert(frag.dead && score === sc2, 'fragmento destruido no da puntos');

// ── Cometa: mata a la nave ──
initGame();
asteroids = [new Asteroid(700, 550, 3)];
comets = [new Comet(400, 300, 0)];   // donde nace la nave
ship.invincible = 0;
update(0.016);
assert(state === 'dead' && lives === 2, 'cometa destruye la nave');

// ── Escudo: el sorteo único reparte escudo (10%), velocidad (12%) o nada ──
const dropBand = r => {
  initGame();
  Math.random = () => r;
  asteroids = [new Asteroid(300, 300, 1), new Asteroid(700, 550, 3)];
  bullets.push(new Bullet(300, 300, 0));
  update(0.016);
  Math.random = r0;
  return powerups.map(p => p.constructor.name).sort();
};
assert(dropBand(0.05).join() === 'ShieldUp', '0.05 suelta Escudo (10%)');
assert(dropBand(0.15).join() === 'SpeedUp', '0.15 suelta Velocidad, nunca ambas');
assert(dropBand(0.5).length === 0, '0.5 no suelta nada');

// ── Escudo: recogida, duración y reset ──
initGame();
ship.shieldTimer = SHIELD_TIME;
draw();                       // halo verde dibuja sin errores
assert(ship.shieldTimer === 5, 'Escudo dura 5 segundos');
ship.invincible = 999;
for (let i = 0; i < 10; i++) update(0.05);
assert(Math.abs(ship.shieldTimer - 4.5) < 1e-9, 'temporizador del escudo baja con dt');
for (let i = 0; i < 100; i++) update(0.05);
assert(!(ship.shieldTimer > 0), 'Escudo expira a los 5s');
ship.shieldTimer = SHIELD_TIME;
ship.reset();
assert(ship.shieldTimer === 0, 'reset limpia el Escudo (muerte / nuevo nivel)');

// ── Escudo: destruye el asteroide que toca, protege y no puntúa ──
initGame();
ship.shieldTimer = SHIELD_TIME;
ship.invincible = 0;
asteroids = [new Asteroid(700, 550, 3)];          // lejos: evita nextLevel
const rock = new Asteroid(ship.x + ship.radius + 4, ship.y, 3);
asteroids.push(rock);
const scShield = score;
update(0.016);
assert(rock.dead, 'escudo destruye el asteroide al tocarlo');
assert(state === 'playing' && lives === 3, 'escudo protege la nave');
assert(score === scShield, 'destruir con escudo no da puntos');
assert(asteroids.length === 3, 'el asteroide destruido se parte igual que con un tiro');

// sin escudo, el mismo impacto mata
ship.shieldTimer = 0;
const rock2 = new Asteroid(ship.x + ship.radius + 4, ship.y, 3);
asteroids.push(rock2);
update(0.016);
assert(state === 'dead' && lives === 2, 'sin escudo el mismo impacto mata');

// ── Escudo: pulveriza el cometa entero (sin fragmentos) ──
initGame();
ship.shieldTimer = SHIELD_TIME;
ship.invincible = 0;
asteroids = [new Asteroid(700, 550, 3)];
comets = [new Comet(ship.x, ship.y, 0)];
update(0.016);
assert(comets.length === 0, 'escudo pulveriza el cometa');
assert(state === 'playing' && lives === 3, 'escudo protege del cometa');
`;

let frames = 0;
sandbox.requestAnimationFrame = () => { frames++; };
sandbox.__frames = () => frames;

const src = fs.readFileSync(__dirname + '/game.js', 'utf8') + TESTS;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'game.js+tests' });
