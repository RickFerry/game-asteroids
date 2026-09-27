'use strict';
// Smoke test headless de game.js: node smoke_test.js  (sale con código != 0 si algo falla)
const fs = require('fs');
const vm = require('vm');

const ctxStub = new Proxy({}, {
  get: (t, k) => (k === 'canvas' ? undefined : () => {}),
  set: () => true,
});

const store = new Map();
const sandbox = {
  console,
  Math,
  process,
  document: { getElementById: () => ({ getContext: () => ctxStub, width: 800, height: 600 }) },
  window: { addEventListener() {} },
  requestAnimationFrame() {},
  // game.js pide localStorage al cargar (skinIndex = loadSkin()): tiene que existir
  // antes del vm.runInContext o el sandbox muere antes del primer assert
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  },
};

const TESTS = `
function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
}

initGame();
draw();
assert(__frames() > 0, 'carga y dibuja sin errores');

// drop: cada power-up tiene su propio sorteo (independientes: pueden caer varios juntos)
// asteroides fijados a mano: los de initGame() son aleatorios y pueden comerse el tiro
const realRandom = Math.random;
Math.random = () => 0.11;   // < 0.12 (velocidad y triplete), >= 0.10 (sin escudo)
asteroids = [new Asteroid(100, 100, 1), new Asteroid(700, 550, 3)];
bullets.push(new Bullet(100, 100, 0));
update(0.016);
Math.random = realRandom;
assert(powerups.length === 2, 'asteroide suelta velocidad y triplete (sorteos independientes)');
assert(powerups.every(p => dist(p, { x: 100, y: 100 }) < 5), 'los power-ups nacen donde murió el asteroide');
assert(ship.speedTimer === 0, 'sin bónus antes de colectar');

ship.x = 100; ship.y = 100;
update(0.016);
assert(powerups.length === 0, 'nave colecta los power-ups');
assert(ship.speedTimer === 5, 'bónus de velocidad dura 5 segundos');
assert(ship.tripleActive === true, 'el Triplete queda activo');

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

// ── Drop: cada power-up tiene su propio sorteo ──
const dropAt = r => {
  initGame();
  Math.random = () => r;
  asteroids = [new Asteroid(300, 300, 1), new Asteroid(700, 550, 3)];
  bullets.push(new Bullet(300, 300, 0));
  update(0.016);
  Math.random = r0;
  return powerups.map(p => p.constructor.name).sort();
};
assert(dropAt(0.05).join()   === 'ShieldUp,SpeedUp,TripleShot', '0.05 suelta los tres a la vez (sorteos independientes)');
assert(dropAt(0.11).join()   === 'SpeedUp,TripleShot', '0.11 suelta Velocidad y Triplete, no Escudo');
assert(dropAt(0.119).join()  === 'SpeedUp,TripleShot', 'el Triplete entra por debajo de 0.12');
assert(dropAt(0.121).length === 0, 'a 0.121 el Triplete ya no cae (y tampoco la velocidad)');
assert(dropAt(0.5).length === 0, '0.5 no suelta nada');

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

// ── Triplete: recogida, duración indefinida y pérdida por muerte / nivel ──
initGame();
asteroids = [new Asteroid(700, 550, 3)];   // lejos: evita nextLevel
let bs = ship.tryShoot();
assert(bs.length === 1, 'sin bónus dispara un solo tiro');

ship.x = 100; ship.y = 100;
powerups.push(new TripleShot(ship.x, ship.y));
update(0.016);
assert(powerups.length === 0, 'nave colecta el Triplete');
assert(ship.tripleActive === true, 'Triplete se activa al recogerlo');
assert(ship.shieldTimer === 0, 'recoger Triplete no activa el Escudo');
assert(ship.speedTimer === 0, 'recoger Triplete no activa la Velocidad');

ship.reset();
assert(ship.tripleActive === false, 'reset limpia el Triplete (muerte / nuevo nivel)');

// el Triplete no caduca con el tiempo
initGame();
ship.tripleActive = true;
ship.shootCooldown = 0;
bs = ship.tryShoot();
assert(bs.length === 3, 'con Triplete dispara 3 tiros');
const ang = a => Math.atan2(a.vy, a.vx);
assert(Math.abs(ang(bs[0]) - (ship.angle - TRIPLE_SPREAD)) < 1e-9, 'tiro izquierdo desviado -TRIPLE_SPREAD');
assert(Math.abs(ang(bs[1]) - ship.angle) < 1e-9, 'tiro central sale recto');
assert(Math.abs(ang(bs[2]) - (ship.angle + TRIPLE_SPREAD)) < 1e-9, 'tiro derecho desviado +TRIPLE_SPREAD');

ship.invincible = 999;
for (let i = 0; i < 200; i++) update(0.05);
assert(ship.tripleActive === true, 'el Triplete no caduca con el tiempo (200 updates)');

// se pierde al cambiar de nivel
initGame();
ship.tripleActive = true;
asteroids = [];
update(0.016);
assert(ship.tripleActive === false, 'el Triplete se pierde al cambiar de nivel');

// se pierde al morir (el reset lo limpia al reaparecer)
initGame();
ship.tripleActive = true;
killShip();
for (let i = 0; i < 41; i++) update(0.05);   // deadTimer = 2s → reaparece
assert(ship.tripleActive === false, 'el Triplete se pierde al morir');

// ── Skins ──
assert(skinIndex === 0, 'arranca en la skin 0 sin nada guardado');

localStorage.setItem(SKIN_KEY, '99');
assert(loadSkin() === 0, 'índice fuera de rango vuelve a la skin 0');
localStorage.setItem(SKIN_KEY, '2');
assert(loadSkin() === 2, 'índice guardado se restaura');
localStorage.removeItem(SKIN_KEY);
assert(loadSkin() === 0, 'sin guardado vuelve a la skin 0');

setSkin(1);
assert(skinIndex === 1, 'setSkin cambia la skin activa');
assert(localStorage.getItem(SKIN_KEY) === '1', 'setSkin persiste en localStorage');
setSkin(0);

justPressed['Digit2'] = true;
update(0.016);
assert(skinIndex === 1, 'tecla 2 selecciona la skin 2');
assert(localStorage.getItem(SKIN_KEY) === '1', 'el cambio por tecla se persiste');
justPressed['Digit1'] = true;
update(0.016);
assert(skinIndex === 0, 'tecla 1 vuelve a la skin 1');

assert(SKINS.every(s => Math.max(...s.hull.map(p => p[0])) >= 19),
       'todas las skins tienen el nariz en x >= 19 (NOSE = 21)');

for (let i = 0; i < SKINS.length; i++) { skinIndex = i; draw(); }
skinIndex = 0;
assert(true, 'las 3 skins y sus miniaturas se dibujan sin errores');
`;

let frames = 0;
sandbox.requestAnimationFrame = () => { frames++; };
sandbox.__frames = () => frames;

const src = fs.readFileSync(__dirname + '/game.js', 'utf8') + TESTS;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'game.js+tests' });
