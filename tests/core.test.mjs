import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, dash, selectUpgrade, chooseUpgrades, spawnEnemy, xpRequired, WIDTH, HEIGHT, RUN_DURATION, formatTime } from '../src/core.js';
const idle = { x: 0, y: 0 };
const random = () => .5;
function step(game, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds * 60); i++) update(game, input, 1 / 60, random); }
function enemy(game, options = {}) {
  const e = spawnEnemy(game, random);
  Object.assign(e, { x: game.player.x + 100, y: game.player.y, hp: 20, maxHp: 20, speed: 0 }, options);
  return e;
}

test('diagonal movement has the same speed and stays inside the arena', () => {
  const a = createGame(), b = createGame();
  a.spawnTimer = b.spawnTimer = 999;
  const origin = { ...a.player };
  step(a, .5, { x: 1, y: 0 }); step(b, .5, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(a.player.x - origin.x, a.player.y - origin.y) - Math.hypot(b.player.x - origin.x, b.player.y - origin.y)) < .001);
  step(a, 20, { x: 1, y: 1 });
  assert.equal(a.player.x, WIDTH - 20); assert.equal(a.player.y, HEIGHT - 38);
});
test('auto fire defeats an enemy and creates collectable experience', () => {
  const game = createGame(); game.spawnTimer = 999; enemy(game);
  step(game, .6);
  assert.equal(game.kills, 1); assert.equal(game.enemies.length, 0); assert.equal(game.gems.length, 1);
  step(game, .6, { x: 1, y: 0 });
  assert.equal(game.gems.length, 0); assert.equal(game.xp, 2);
});
test('experience opens upgrades, freezes time and applies exactly one choice', () => {
  const game = createGame(); game.gems.push({ x: game.player.x, y: game.player.y, value: xpRequired(1) });
  update(game, idle, .02, random);
  assert.equal(game.state, 'upgrade'); assert.equal(game.level, 2); assert.equal(new Set(game.choices.map(c => c.id)).size, 3);
  const before = game.time; step(game, 1); assert.equal(game.time, before);
  assert.equal(selectUpgrade(game, 'does-not-exist'), false);
  const id = game.choices[0].id;
  assert.equal(selectUpgrade(game, id), true); assert.equal(game.state, 'playing'); assert.equal(selectUpgrade(game, id), false);
});
test('overflow experience is retained and can award successive levels', () => {
  const game = createGame(); game.xp = xpRequired(1) + xpRequired(2) + 3;
  update(game, idle, .01, random); selectUpgrade(game, game.choices[0].id, random);
  assert.equal(game.level, 3); assert.equal(game.state, 'upgrade'); assert.equal(game.xp, 3);
});
test('dash avoids contact damage and cannot be reused during cooldown', () => {
  const game = createGame(); game.spawnTimer = 999; game.fireTimer = 999;
  enemy(game, { x: game.player.x, y: game.player.y });
  assert.equal(dash(game), true); assert.equal(dash(game), false);
  update(game, idle, .02, random); assert.equal(game.player.hp, 100);
  game.enemies = []; step(game, 4.1); assert.equal(dash(game), true);
});
test('contact invulnerability prevents damage on every frame; death ends run', () => {
  const game = createGame(); game.spawnTimer = 999; game.fireTimer = 999;
  const e = enemy(game, { x: game.player.x, y: game.player.y, damage: 10 });
  update(game, idle, .01, random); assert.equal(game.player.hp, 90);
  step(game, .1); assert.equal(game.player.hp, 90);
  game.player.invincible = 0; game.player.hp = 5; e.x = game.player.x; e.y = game.player.y;
  update(game, idle, .01, random); assert.equal(game.state, 'lost'); assert.equal(game.player.hp, 0);
});
test('nova and orbit upgrades damage enemies', () => {
  const nova = createGame(); nova.player.nova = 1; nova.novaTimer = 0; nova.fireTimer = 999; enemy(nova);
  update(nova, idle, .01, random); assert.equal(nova.kills, 1); assert.equal(nova.rings.length, 1);
  const orbit = createGame(); orbit.player.orbits = 1; orbit.fireTimer = 999; enemy(orbit, { x: orbit.player.x + 69 });
  update(orbit, idle, .01, random); assert.equal(orbit.kills, 1);
});
test('capped upgrades are excluded and healing respects maximum health', () => {
  const game = createGame(); game.player.shots = 5; game.player.orbits = 4;
  for (let i = 0; i < 20; i++) assert.ok(chooseUpgrades(game.player).every(c => !['multishot', 'orbit'].includes(c.id)));
  game.player.regen = 100; update(game, idle, .05, random); assert.equal(game.player.hp, 100);
});
test('paused games do not advance; survival at 180 seconds wins', () => {
  const game = createGame(); game.state = 'paused'; step(game, 1); assert.equal(game.time, 0);
  game.state = 'playing'; game.time = RUN_DURATION - .01; update(game, idle, .02, random);
  assert.equal(game.state, 'won'); assert.equal(game.time, RUN_DURATION); assert.equal(formatTime(game.time), '03:00');
});
test('enemy types unlock as the run progresses', () => {
  const game = createGame(); assert.equal(spawnEnemy(game, () => .1).type, 'shade');
  game.time = 30; assert.equal(spawnEnemy(game, () => .1).type, 'wisp');
  game.time = 90; assert.equal(spawnEnemy(game, () => .1).type, 'brute');
});
