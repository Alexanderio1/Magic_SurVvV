import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, dash, selectUpgrade, chooseUpgrades, spawnEnemy, xpRequired, WIDTH, HEIGHT, SPELLS, RUN_DURATION, formatTime } from '../src/core.js';
const idle = { x: 0, y: 0 };
const random = () => .5;
function step(game, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds * 60); i++) update(game, input, 1 / 60, random); }
function enemy(game, options = {}) {
  const e = spawnEnemy(game, random);
  Object.assign(e, { x: game.player.x + 100, y: game.player.y, hp: 20, maxHp: 20, speed: 0 }, options);
  return e;
}

test('diagonal speed is normalized and movement crosses former arena bounds in both directions', () => {
  const a = createGame(), b = createGame();
  a.spawnTimer = b.spawnTimer = 999;
  const origin = { ...a.player };
  step(a, .5, { x: 1, y: 0 }); step(b, .5, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(a.player.x - origin.x, a.player.y - origin.y) - Math.hypot(b.player.x - origin.x, b.player.y - origin.y)) < .001);
  step(a, 20, { x: 1, y: 1 });
  assert.ok(a.player.x > WIDTH * 2); assert.ok(a.player.y > HEIGHT * 2);
  step(a, 50, { x: -1, y: -1 });
  assert.ok(a.player.x < -WIDTH * 2); assert.ok(a.player.y < -HEIGHT * 2);
});
test('auto fire defeats an enemy and creates collectable experience', () => {
  const game = createGame(); game.spawnTimer = 999; enemy(game);
  step(game, .4);
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
  const nova = createGame(); nova.player.magic.nova = 1; nova.spellTimers.nova = 0; nova.fireTimer = 999; enemy(nova);
  update(nova, idle, .01, random); assert.equal(nova.kills, 1); assert.equal(nova.effects.length, 1);
  const orbit = createGame(); orbit.player.magic.orbit = 1; orbit.fireTimer = 999; enemy(orbit, { x: orbit.player.x + 69 });
  update(orbit, idle, .01, random); assert.equal(orbit.kills, 1);
});
test('capped upgrades are excluded and healing respects maximum health', () => {
  const game = createGame(); game.player.shots = 5; game.player.magic.orbit = 4;
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

test('experience costs accelerate and time alone never grants levels', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(xpRequired), [10, 15, 21, 28, 37]);
  assert.ok(xpRequired(20) - xpRequired(19) > xpRequired(3) - xpRequired(2));
  const game = createGame(); game.spawnTimer = 999;
  step(game, 120); assert.equal(game.level, 1); assert.equal(game.xp, 0);
});
test('enemies spawn around the current camera, including negative world coordinates', () => {
  const game = createGame(); game.player.x = -12000; game.player.y = 9000;
  for (const n of [.01, .26, .51, .76]) {
    const e = spawnEnemy(game, () => n);
    const dx = Math.abs(e.x - game.player.x), dy = Math.abs(e.y - game.player.y);
    assert.ok(dx > WIDTH / 2 || dy > HEIGHT / 2);
    assert.ok(dx <= WIDTH / 2 + 41 && dy <= HEIGHT / 2 + 41);
  }
});
test('distant entities are retired without granting kills or experience', () => {
  const game = createGame(); game.fireTimer = game.spawnTimer = 999;
  enemy(game, { x: 100000 }); game.gems.push({ x: -100000, y: 0, value: 100 });
  update(game, idle, .01, random);
  assert.equal(game.enemies.length, 0); assert.equal(game.gems.length, 0); assert.equal(game.kills, 0); assert.equal(game.xp, 0);
});
for (const spell of SPELLS.filter(s => s.id !== 'spark')) {
  test(`${spell.id} inflicts damage independently of the basic attack`, () => {
    const game = createGame(spell.id); game.fireTimer = game.spawnTimer = 999; game.player.invincible = 100;
    game.spellTimers[spell.id] = 0;
    enemy(game, { x: spell.id === 'orbit' ? 69 : spell.id === 'runes' ? 20 : 80 });
    step(game, 3);
    assert.equal(game.kills, 1, `${spell.id} must defeat the target without basic arrows`);
  });
}
test('fireball explodes into multiple enemies and lightning chains without double hits', () => {
  const fire = createGame('fireball'); fire.fireTimer = fire.spawnTimer = 999; fire.spellTimers.fireball = 0;
  enemy(fire, { x: 100, y: 0 }); enemy(fire, { x: 120, y: 40 }); step(fire, .3); assert.equal(fire.kills, 2);
  const bolt = createGame('lightning'); bolt.fireTimer = bolt.spawnTimer = 999; bolt.spellTimers.lightning = 0;
  for (const x of [100, 230, 400]) enemy(bolt, { x });
  update(bolt, idle, .01, random); assert.equal(bolt.kills, 3);
});
test('frost slows surviving enemies and meteor damage waits for its warning', () => {
  const frost = createGame('frost'); frost.fireTimer = frost.spawnTimer = 999; frost.spellTimers.frost = 0;
  const e = enemy(frost, { hp: 100, speed: 100 }); update(frost, idle, .01, random);
  assert.ok(e.slow > 2); assert.ok(e.x > 99.5 && e.x < 100);
  const meteor = createGame('meteor'); meteor.fireTimer = meteor.spawnTimer = 999; meteor.spellTimers.meteor = 0;
  const target = enemy(meteor); step(meteor, .5); assert.equal(target.hp, 20);
  step(meteor, .4); assert.equal(meteor.kills, 1);
});
test('void pulls enemies, beam pierces a line and runes wait until armed', () => {
  const hole = createGame('void'); hole.fireTimer = hole.spawnTimer = 999; hole.spellTimers.void = 0;
  enemy(hole, { x: 100, hp: 1000 }); const pulled = enemy(hole, { x: 180, hp: 1000 }); step(hole, .1); assert.ok(pulled.x < 175);
  const beam = createGame('beam'); beam.fireTimer = beam.spawnTimer = 999; beam.spellTimers.beam = 0;
  for (const x of [100, 250, 500]) enemy(beam, { x }); enemy(beam, { x: 400, y: 80 });
  update(beam, idle, .01, random); assert.equal(beam.kills, 3); assert.equal(beam.enemies.length, 1);
  const rune = createGame('runes'); rune.fireTimer = rune.spawnTimer = 999; rune.spellTimers.runes = 0; rune.player.invincible = 99;
  const target = enemy(rune, { x: 20 }); step(rune, .5); assert.equal(target.hp, 20); step(rune, .3); assert.equal(rune.kills, 1);
});
test('upgrade offers mix a new spell, a learned rank and a passive', () => {
  const game = createGame('fireball'); const choices = chooseUpgrades(game.player, random);
  assert.ok(choices.some(c => c.spell && !game.player.magic[c.id]));
  assert.ok(choices.some(c => c.spell && game.player.magic[c.id]));
  assert.ok(choices.some(c => !c.spell));
  for (const spell of SPELLS) game.player.magic[spell.id] = spell.max;
  assert.ok(chooseUpgrades(game.player, random).every(c => !c.spell));
});
