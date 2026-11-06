import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, SPELLS } from '../src/core.js';
import { THEMES, SKINS, createProgress, recordProgress } from '../src/cosmetics.js';

test('cosmetics unlock at their exact gameplay conditions', () => {
  const p = createProgress(), g = createGame();
  g.time = 59.9; g.level = 4; g.kills = 99;
  assert.deepEqual(recordProgress(p, g), []);
  g.time = 60; g.level = 5; g.kills = 100;
  assert.deepEqual(recordProgress(p, g), ['Ледяные пустоши', 'Пепельные земли', 'Кристаллы']);
  for (const spell of SPELLS.slice(0, 6)) g.player.magic[spell.id] = 1;
  g.kills = 250; g.state = 'won';
  assert.deepEqual(recordProgress(p, g), ['Астральный сад', 'Угольки', 'Древние маски']);
  assert.ok([...THEMES, ...SKINS].every(c => c.unlocked(p)));
});
test('progress counts each kill and victory once across repeated updates and restarts', () => {
  const p = createProgress(), a = createGame(); a.kills = 70; a.state = 'won';
  recordProgress(p, a); recordProgress(p, a);
  assert.equal(p.totalKills, 70); assert.equal(p.wins, 1);
  const b = createGame(); b.kills = 30; recordProgress(p, b);
  assert.equal(p.totalKills, 100); assert.equal(p.wins, 1);
});
test('saved choices persist and locked or malformed choices fall back safely', () => {
  const p = createProgress({ totalKills: 250, bestTime: 75, theme: 'frost', skin: 'cinders' });
  assert.deepEqual(createProgress(JSON.parse(JSON.stringify(p))), p);
  const invalid = createProgress({ theme: 'astral', skin: 'masks', totalKills: -5, wins: 'yes', bestTime: Infinity });
  assert.equal(invalid.theme, 'grove'); assert.equal(invalid.skin, 'shades'); assert.equal(invalid.totalKills, 0); assert.equal(invalid.wins, 0);
  assert.deepEqual(createProgress(null), createProgress());
});
