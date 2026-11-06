import { WIDTH, HEIGHT, SPELLS, createGame, update, dash, selectUpgrade, xpRequired, formatTime, orbitPositions, familiarPosition, clamp } from './core.js';
import { THEMES, SKINS, createProgress, recordProgress } from './cosmetics.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
canvas.width = WIDTH; canvas.height = HEIGHT;
$('stage').style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
const ctx = canvas.getContext('2d');
let game = createGame();
game.state = 'menu';
let previousState = '', previousLevel = 0, lastFrame = 0, ambientTime = 0, soundEnabled = false, audioContext;
let record = { time: 0, kills: 0 };
try { const value = JSON.parse(localStorage.getItem('lumen-record')); if (value && Number.isFinite(value.time) && Number.isFinite(value.kills)) record = value; } catch { /* Storage may be unavailable in private browsing. */ }
const keys = new Set();
const touch = { x: 0, y: 0, active: false, id: null };
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let progress = createProgress({ bestTime: record.time, totalKills: record.kills });
try { progress = createProgress(JSON.parse(localStorage.getItem('lumen-progress')) || progress); } catch { /* Keep session progress when storage is blocked. */ }
let theme = THEMES.find(t => t.id === progress.theme), skin = SKINS.find(s => s.id === progress.skin);
let toastUntil = 0, saveTimer = 0;
function saveProgress() { try { localStorage.setItem('lumen-progress', JSON.stringify(progress)); } catch { /* Optional persistence. */ } }
function applyLook() {
  theme = THEMES.find(t => t.id === progress.theme); skin = SKINS.find(s => s.id === progress.skin);
  document.documentElement.style.setProperty('--lime', theme.accent);
  $('field-name').textContent = theme.name.toUpperCase();
}
function renderCollection() {
  for (const [id, catalog, key] of [['theme-select', THEMES, 'theme'], ['skin-select', SKINS, 'skin']]) {
    $(id).replaceChildren(...catalog.map(item => {
      const option = document.createElement('option'); option.value = item.id;
      option.textContent = item.unlocked(progress) ? item.name : `${item.name} · закрыто`;
      option.disabled = !item.unlocked(progress); option.selected = item.id === progress[key]; return option;
    }));
  }
  const catalog = [...THEMES, ...SKINS];
  $('collection-count').textContent = `Открыто ${catalog.filter(item => item.unlocked(progress)).length} / ${catalog.length} · условия`;
  $('unlock-list').replaceChildren(...catalog.map(item => {
    const li = document.createElement('li'); li.className = item.unlocked(progress) ? 'earned' : '';
    li.textContent = `${item.unlocked(progress) ? '✓' : '○'} ${item.name}: ${item.requirement}`; return li;
  }));
}
function syncProgress() {
  const unlocked = recordProgress(progress, game);
  if (unlocked.length) {
    $('unlock-toast').textContent = `Открыто: ${unlocked.join(' · ')}. Выбери в коллекции!`;
    $('unlock-toast').hidden = false; toastUntil = ambientTime + 5; renderCollection();
  }
  saveProgress();
}
for (const [id, key, catalog] of [['theme-select', 'theme', THEMES], ['skin-select', 'skin', SKINS]]) {
  $(id).addEventListener('change', event => {
    pause();
    const item = catalog.find(item => item.id === event.target.value);
    if (item?.unlocked(progress)) { progress[key] = item.id; applyLook(); saveProgress(); }
  });
}
$('starter-spell').replaceChildren(...SPELLS.filter(spell => spell.id !== 'spark').map(spell => {
  const option = document.createElement('option'); option.value = spell.id; option.textContent = spell.name; return option;
}));
$('starter-spell').value = 'fireball';
$('spell-catalog').replaceChildren(...SPELLS.map(spell => {
  const row = document.createElement('div'); row.className = 'spell-entry';
  row.innerHTML = `<strong style="color:${spell.color}">${spell.icon} ${spell.name}</strong><p>${spell.description}</p>`; return row;
}));
function renderLoadout() {
  $('active-spells').replaceChildren(...SPELLS.filter(s => game.player.magic[s.id]).map(spell => {
    const badge = document.createElement('span'); badge.className = 'spell-badge'; badge.style.color = spell.color;
    badge.title = `${spell.name} · ранг ${game.player.magic[spell.id]}: ${spell.description}`;
    badge.innerHTML = `${spell.icon}<small>${game.player.magic[spell.id]}</small>`; badge.setAttribute('aria-label', badge.title); return badge;
  }));
}
renderCollection(); applyLook();

function refreshRecord() { $('record').textContent = formatTime(record.time); $('record-caption').textContent = record.kills ? `${record.kills} врагов побеждено в лучшем забеге.` : 'Каждая попытка — начало.'; }
refreshRecord();
function tone(frequency, duration = .08, volume = .04) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Sound is optional. */ }
}
function clearInput() { keys.clear(); touch.x = 0; touch.y = 0; touch.active = false; touch.id = null; $('joystick-knob').style.transform = ''; }
function start() { clearInput(); game = createGame($('starter-spell').value); previousState = ''; previousLevel = 0; tone(392, .2); syncUI(); canvas.focus({ preventScroll: true }); }
function pause() { if (game.state === 'playing') { game.state = 'paused'; clearInput(); syncUI(); } }
function resume() { if (game.state === 'paused') { game.state = 'playing'; syncUI(); canvas.focus({ preventScroll: true }); } }
function doDash() { if (dash(game)) tone(165, .14, .06); }
function choose(index) { const choice = game.choices[index]; if (choice && selectUpgrade(game, choice.id)) { renderLoadout(); syncProgress(); tone(660, .2); syncUI(); if (game.state === 'playing') canvas.focus({ preventScroll: true }); } }
$('start-button').addEventListener('click', start);
$('restart-button').addEventListener('click', start);
$('pause-button').addEventListener('click', pause);
$('resume-button').addEventListener('click', resume);
$('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('sound-button').textContent = `Звук: ${soundEnabled ? 'вкл.' : 'выкл.'}`;
  $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
  $('sound-button').setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
  tone(523, .15);
  if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
});
document.addEventListener('keydown', event => {
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const controlCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyP', 'Escape'];
  if (game.state !== 'menu' && controlCodes.includes(event.code) && !(event.code === 'Space' && event.target instanceof HTMLButtonElement)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape') game.state === 'paused' ? resume() : pause();
  if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) doDash();
  if (game.state === 'upgrade' && /^Digit[123]$/.test(event.code)) choose(Number(event.code.slice(-1)) - 1);
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { clearInput(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); pause(); } });
const joystick = $('joystick');
function moveJoystick(event) {
  if (event.pointerId !== touch.id) return;
  const rect = joystick.getBoundingClientRect();
  let x = (event.clientX - rect.left - rect.width / 2) / 35, y = (event.clientY - rect.top - rect.height / 2) / 35;
  const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
  touch.x = Math.abs(x) < .12 ? 0 : x; touch.y = Math.abs(y) < .12 ? 0 : y;
  $('joystick-knob').style.transform = `translate(${x * 27}px, ${y * 27}px)`;
}
joystick.addEventListener('pointerdown', event => { if (touch.active) return; event.preventDefault(); touch.active = true; touch.id = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
joystick.addEventListener('pointermove', moveJoystick);
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, event => { if (event.pointerId === touch.id) clearInput(); });
$('touch-dash').addEventListener('pointerdown', event => { event.preventDefault(); doDash(); });

function syncUI() {
  const changed = previousState !== game.state || previousLevel !== game.level;
  if (changed) {
    syncProgress(); renderLoadout();
    $('overlay').hidden = game.state === 'playing';
    for (const [id, state] of [['welcome', 'menu'], ['pause-dialog', 'paused'], ['upgrade-dialog', 'upgrade']]) $(id).hidden = game.state !== state;
    $('end-dialog').hidden = !['won', 'lost'].includes(game.state);
    $('hud').hidden = game.state === 'menu'; $('xp-hud').hidden = game.state === 'menu';
    $('touch-controls').hidden = !isTouch || game.state !== 'playing';
    if (game.state === 'upgrade') {
      clearInput();
      $('upgrade-choices').replaceChildren(...game.choices.map((choice, index) => {
        const button = document.createElement('button'); button.className = 'upgrade-card';
        button.innerHTML = `<span class="upgrade-icon" aria-hidden="true">${choice.icon}</span><strong>${choice.name}</strong><span class="upgrade-rank">${choice.spell ? (game.player.magic[choice.id] ? `РАНГ ${game.player.magic[choice.id]} → ${game.player.magic[choice.id] + 1}` : 'НОВОЕ ЗАКЛИНАНИЕ') : 'ПАССИВНОЕ УСИЛЕНИЕ'}</span><p>${choice.description}</p><small>ВЫБРАТЬ · ${index + 1}</small>`;
        button.addEventListener('click', () => choose(index)); return button;
      }));
      tone(784, .25);
      $('upgrade-choices').firstElementChild.focus({ preventScroll: true });
    }
    if (game.state === 'paused') $('resume-button').focus({ preventScroll: true });
    if (game.state === 'lost' || game.state === 'won') {
      clearInput();
      const won = game.state === 'won';
      $('end-eyebrow').textContent = won ? 'РАССВЕТ ПРИШЁЛ' : 'ЕЩЁ ОДНА ИСКРА';
      $('end-title').textContent = won ? 'Ты остался светом.' : 'Свет вернётся.';
      $('end-copy').textContent = won ? 'Три минуты тьмы позади. Роща запомнит твоё имя.' : 'Даже маленькая искра оставляет след. Попробуем ещё раз?';
      $('result-time').textContent = formatTime(game.time); $('result-kills').textContent = game.kills; $('result-level').textContent = game.level;
      if (game.time > record.time || (game.time === record.time && game.kills > record.kills)) {
        record = { time: game.time, kills: game.kills };
        try { localStorage.setItem('lumen-record', JSON.stringify(record)); } catch { /* Optional persistence. */ }
        refreshRecord();
      }
      tone(won ? 880 : 147, .45); $('restart-button').focus({ preventScroll: true });
    }
    previousState = game.state; previousLevel = game.level;
  }
  $('timer').textContent = formatTime(game.time);
  $('health-text').textContent = `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
  $('health-bar').style.width = `${game.player.hp / game.player.maxHp * 100}%`;
  $('health-bar').style.background = game.player.hp < game.player.maxHp * .3 ? '#ed9b8d' : '#d4f793';
  $('xp-bar').style.width = `${clamp(game.xp / xpRequired(game.level) * 100, 0, 100)}%`;
  $('xp-text').textContent = `ОПЫТ ${game.xp} / ${xpRequired(game.level)}`;
  $('level').textContent = game.level; $('kills').textContent = game.kills;
  $('wave-label').textContent = game.state === 'menu' ? 'ОЖИДАНИЕ ЗАБЕГА' : `ВОЛНА ${Math.min(4, 1 + Math.floor(game.time / 45))} / 4`;
  $('dash-label').textContent = game.player.dashCooldown > 0 ? `РЫВОК · ${game.player.dashCooldown.toFixed(1)} С` : `${isTouch ? '↯' : 'ПРОБЕЛ'} · РЫВОК ГОТОВ`;
}

function circle(x, y, radius, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2); ctx.fill(); }
function diamond(x, y, radius, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + radius * .65, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius * .65, y); ctx.closePath(); ctx.fill(); }
function glow(x, y, radius, color) { const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius); gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent'); circle(x, y, radius, gradient); }
function outline(x, y, radius, color, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); }
const terrainHash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function drawWorld(camera) {
  ctx.fillStyle = theme.ground; ctx.fillRect(camera.x, camera.y, WIDTH, HEIGHT);
  const size = 96;
  for (let ix = Math.floor(camera.x / size) - 1; ix <= Math.ceil((camera.x + WIDTH) / size); ix++) {
    for (let iy = Math.floor(camera.y / size) - 1; iy <= Math.ceil((camera.y + HEIGHT) / size); iy++) {
      const hash = terrainHash(ix, iy), x = ix * size + hash * 68, y = iy * size + terrainHash(iy + 3, ix) * 68;
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.strokeRect(ix * size, iy * size, size, size);
      ctx.globalAlpha = .5;
      if (theme.id === 'frost') {
        diamond(x, y, 5 + hash * 12, theme.detail); diamond(x + 9, y + 4, 5, theme.detail);
      } else if (theme.id === 'embers') {
        ctx.strokeStyle = theme.detail; ctx.beginPath(); ctx.moveTo(x - 9, y - 8); ctx.lineTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.lineTo(x + 8, y + 17); ctx.stroke();
        if (hash > .7) circle(x + 5, y + 3, 2, theme.light);
      } else if (theme.id === 'astral') {
        outline(x, y, 3 + hash * 8, theme.detail); diamond(x + 13, y - 7, 2, theme.light);
      } else {
        ctx.strokeStyle = theme.detail; ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x - 3, y - 4); ctx.moveTo(x, y + 9); ctx.lineTo(x + 6, y); ctx.stroke();
        ctx.fillStyle = theme.detail; ctx.beginPath(); ctx.ellipse(x + 21, y, 4 + hash * 7, 3 + hash * 4, -.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const t = reducedMotion ? 0 : ambientTime;
      if (hash > .55) { ctx.globalAlpha = .25 + Math.sin(t + hash * 10) * .15; circle(x + Math.sin(t * .3 + hash) * 10, y - 20, 1.5, theme.light); ctx.globalAlpha = 1; }
    }
  }
  // Ruins repeat across world coordinates, not screen coordinates: no border walls.
  for (let ix = Math.floor(camera.x / 700); ix <= Math.ceil((camera.x + WIDTH) / 700); ix++) {
    for (let iy = Math.floor(camera.y / 700); iy <= Math.ceil((camera.y + HEIGHT) / 700); iy++) {
      if (terrainHash(ix + 7, iy + 2) > .4 && (ix || iy)) continue;
      const x = ix * 700, y = iy * 700;
      outline(x, y, 110, `${theme.light}14`); outline(x, y, 118, `${theme.light}0c`);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; diamond(x + Math.cos(a) * 114, y + Math.sin(a) * 114, 4, `${theme.light}20`); }
    }
  }
}
function drawZone(zone) {
  const pulse = reducedMotion ? 0 : Math.sin(ambientTime * 4) * 4;
  circle(zone.x, zone.y, zone.radius, `${zone.color}0e`);
  if (zone.kind === 'meteor') {
    outline(zone.x, zone.y, zone.radius, `${zone.color}88`, 2);
    outline(zone.x, zone.y, zone.radius * clamp(zone.age / .8, 0, 1), zone.color, 2);
    ctx.strokeStyle = zone.color; ctx.beginPath(); ctx.moveTo(zone.x - 10, zone.y); ctx.lineTo(zone.x + 10, zone.y); ctx.moveTo(zone.x, zone.y - 10); ctx.lineTo(zone.x, zone.y + 10); ctx.stroke();
  } else if (zone.kind === 'void') {
    glow(zone.x, zone.y, zone.radius, '#bb9bff25'); circle(zone.x, zone.y, 22 + pulse, '#161124');
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = `${zone.color}77`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(zone.x, zone.y, 35 + i * 22, 15 + i * 11, ambientTime + i, 0, Math.PI * 1.5); ctx.stroke(); }
  } else if (zone.kind === 'poison') {
    for (let i = 0; i < 7; i++) { const a = i * 2.4; circle(zone.x + Math.cos(a) * zone.radius * .5, zone.y + Math.sin(a) * zone.radius * .5, zone.radius * .4 + pulse, `${zone.color}12`); }
    outline(zone.x, zone.y, zone.radius, `${zone.color}33`);
  } else if (zone.kind === 'storm') {
    for (let i = -1; i <= 1; i++) circle(zone.x + i * 21, zone.y - 40, 27, '#7681b44a');
    outline(zone.x, zone.y, zone.radius, `${zone.color}33`);
  } else if (zone.kind === 'runes') {
    ctx.save(); ctx.translate(zone.x, zone.y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = zone.age > .7 ? zone.color : `${zone.color}44`; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28); ctx.restore();
    diamond(zone.x, zone.y, 7, zone.color); outline(zone.x, zone.y, 29, `${zone.color}55`);
  }
}
function drawEffect(e) {
  const alpha = clamp(e.life / e.maxLife, 0, 1); ctx.globalAlpha = alpha;
  if (e.kind === 'ring') { outline(e.x, e.y, e.radius * (1 - alpha * .8), e.color, 2 + alpha * 3); outline(e.x, e.y, e.radius, `${e.color}66`); }
  if (e.kind === 'beam' || e.kind === 'bolt') {
    ctx.strokeStyle = e.color; ctx.lineWidth = e.kind === 'beam' ? e.radius * alpha : 2;
    ctx.beginPath(); ctx.moveTo(e.x, e.y);
    if (e.kind === 'bolt') for (let i = 1; i < 7; i++) ctx.lineTo(e.x + (e.x2 - e.x) * i / 7 + (i % 2 ? -9 : 9), e.y + (e.y2 - e.y) * i / 7);
    ctx.lineTo(e.x2, e.y2); ctx.stroke();
    if (e.kind === 'beam') { ctx.strokeStyle = '#fff8df'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  if (e.kind === 'meteor') { glow(e.x, e.y, e.radius, '#ff907a55'); ctx.strokeStyle = e.color; ctx.lineWidth = 10 * alpha; ctx.beginPath(); ctx.moveTo(e.x - alpha * 90, e.y - alpha * 150); ctx.lineTo(e.x, e.y); ctx.stroke(); circle(e.x, e.y, 13 * alpha, '#fff0bd'); }
  ctx.globalAlpha = 1;
}
function drawEnemy(enemy) {
  const { x, y, radius: r, type } = enemy;
  const bob = reducedMotion ? 0 : Math.sin(ambientTime * 4 + enemy.phase) * 3;
  const body = enemy.hit ? '#e9ffdf' : enemy.slow > 0 ? '#81cce2' : type === 'brute' ? skin.heavy : skin.body;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(0, r, r, r * .35, 0, 0, Math.PI * 2); ctx.fill();
  if (skin.id === 'crystals') {
    diamond(0, 0, r * 1.4, body); diamond(-r * .5, r * .2, r * .8, body); diamond(r * .5, r * .3, r * .7, skin.heavy);
    ctx.strokeStyle = skin.eye; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
  } else if (skin.id === 'masks') {
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, -r); ctx.lineTo(r * .75, r * .65); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r * .75, r * .65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.face; ctx.fillRect(-r * .6, -r * .3, r * .4, r * .2); ctx.fillRect(r * .2, -r * .3, r * .4, r * .2); ctx.fillRect(-2, r * .3, 4, r * .45);
  } else if (skin.id === 'cinders') {
    glow(0, 0, r * 1.8, '#ff9e6420'); ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-r, r * .6); ctx.quadraticCurveTo(-r * 1.2, -r * .4, -r * .4, -r); ctx.lineTo(0, -r * 1.6); ctx.lineTo(r * .5, -r * .4); ctx.quadraticCurveTo(r * 1.6, r, 0, r); ctx.fill();
    circle(0, r * .1, r * .4, skin.face);
  } else if (type === 'wisp') { diamond(0, 0, r * 1.5, enemy.hit ? '#fff' : '#a8a0d1'); diamond(0, 1, r * .8, '#423f63'); }
  else {
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-r, r); ctx.quadraticCurveTo(-r * 1.4, -r, 0, -r * 1.1); ctx.quadraticCurveTo(r * 1.4, -r, r, r); ctx.lineTo(r * .4, r * .65); ctx.lineTo(0, r); ctx.lineTo(-r * .4, r * .65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin.face; ctx.beginPath(); ctx.ellipse(0, -r * .1, r * .65, r * .5, 0, 0, Math.PI * 2); ctx.fill();
  }
  circle(-r * .27, -r * .14, type === 'brute' ? 2.5 : 1.8, skin.eye); circle(r * .27, -r * .14, type === 'brute' ? 2.5 : 1.8, skin.eye);
  if (type === 'brute') { ctx.strokeStyle = skin.eye; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * .6, -r * .7); ctx.lineTo(-r * .9, -r * 1.4); ctx.moveTo(r * .6, -r * .7); ctx.lineTo(r * .9, -r * 1.4); ctx.stroke(); }
  if (enemy.slow > 0) outline(0, 0, r + 4, '#b4ecff77');
  ctx.restore();
}
function render() {
  const p = game.player, camera = { x: p.x - WIDTH / 2, y: p.y - HEIGHT / 2 };
  ctx.save(); ctx.translate(-camera.x, -camera.y); drawWorld(camera);
  if (game.state === 'menu') {
    for (let i = 0; i < 7; i++) { const a = i * 1.2; drawEnemy({ x: p.x + Math.cos(a) * Math.min(340, WIDTH * .4), y: p.y + Math.sin(a) * 220, radius: i % 3 === 0 ? 19 : 13, type: i % 3 === 0 ? 'brute' : 'shade', hit: 0, phase: i }); }
    ctx.restore(); return;
  }
  for (const zone of game.zones) drawZone(zone);
  for (const gem of game.gems) { diamond(gem.x, gem.y, gem.value > 2 ? 7 : 5, '#84dcc3'); diamond(gem.x - 1, gem.y - 1, 2, '#e2ffdf'); }
  for (const enemy of game.enemies) drawEnemy(enemy);
  for (const b of game.bullets) {
    ctx.strokeStyle = `${b.color}70`; ctx.lineWidth = b.kind === 'fireball' ? 6 : 3; ctx.beginPath(); ctx.moveTo(b.x - b.vx * .025, b.y - b.vy * .025); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (b.kind === 'blade' || b.kind === 'boomerang') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.age * 16); ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, b.kind === 'blade' ? 8 : 13, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore();
    } else { circle(b.x, b.y, b.radius, b.color); circle(b.x, b.y, b.radius * .4, '#fffbe2'); }
  }
  for (const e of game.effects) drawEffect(e);
  glow(p.x, p.y, 75, '#c5ef8f14');
  const moons = orbitPositions(game);
  if (moons.length) outline(p.x, p.y, 69, '#aacdb51c');
  for (const moon of moons) { glow(moon.x, moon.y, 19, '#a5eddf40'); diamond(moon.x, moon.y, 10, '#b2ffe7'); }
  if (p.magic.familiar) { const f = familiarPosition(game); glow(f.x, f.y, 23, '#9ff4ea33'); diamond(f.x, f.y, 10, '#9ff4ea'); circle(f.x, f.y, 3, '#fff'); }
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.invincible > 0 && Math.floor(p.invincible * 22) % 2) ctx.globalAlpha = .55;
  ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(0, 16, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, reducedMotion ? 0 : Math.sin(ambientTime * 5) * 1.5);
  ctx.fillStyle = '#4e8c80'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-12, -10, -17, 16); ctx.quadraticCurveTo(0, 24, 17, 16); ctx.quadraticCurveTo(12, -10, 0, -12); ctx.fill();
  ctx.fillStyle = '#263e3e'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, 15); ctx.lineTo(8, 15); ctx.fill();
  circle(0, -10, 10, '#78a88d'); circle(0, -7, 7, '#152d31'); circle(-3, -8, 1.5, '#e3ffc1'); circle(3, -8, 1.5, '#e3ffc1');
  ctx.strokeStyle = '#bbcb9b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(17, 16); ctx.lineTo(17, -16); ctx.stroke(); diamond(17, -21, 6, theme.accent);
  if (p.dashTime > 0) outline(0, 0, 24, theme.accent, 2);
  ctx.restore();
  for (const particle of game.particles) { ctx.globalAlpha = particle.life / particle.maxLife; circle(particle.x, particle.y, 2, particle.color); } ctx.globalAlpha = 1;
  // Draw after combat effects so health remains legible directly above the mage.
  const healthWidth = WIDTH < 600 ? 96 : 66, healthTop = p.y - (WIDTH < 600 ? 59 : 50);
  ctx.fillStyle = '#071419ee'; ctx.fillRect(p.x - healthWidth / 2, healthTop, healthWidth, 23);
  ctx.fillStyle = '#ffffff26'; ctx.fillRect(p.x - healthWidth / 2 + 3, healthTop + 16, healthWidth - 6, 5);
  ctx.fillStyle = p.hp < p.maxHp * .3 ? '#ff9b87' : '#d4f793'; ctx.fillRect(p.x - healthWidth / 2 + 3, healthTop + 16, (healthWidth - 6) * clamp(p.hp / p.maxHp, 0, 1), 5);
  ctx.font = `${WIDTH < 600 ? 12 : 10}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#edf6e8'; ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, p.x, healthTop + 12);
  ctx.restore();
  if (p.hp < p.maxHp * .3) { ctx.strokeStyle = '#cd665b55'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WIDTH, HEIGHT); }
}

let uiTime = 0;
function frame(timestamp) {
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
  lastFrame = timestamp; ambientTime += dt;
  const kills = game.kills, hp = game.player.hp;
  update(game, { x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touch.x, y: Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + touch.y }, dt);
  if (game.kills > kills) tone(440 + game.kills % 5 * 55, .05, .015);
  if (game.player.hp < hp) tone(100, .12, .05);
  saveTimer += dt;
  if (saveTimer >= 1) { syncProgress(); saveTimer = 0; }
  if (ambientTime >= toastUntil) $('unlock-toast').hidden = true;
  uiTime += dt;
  if (uiTime > .08 || previousState !== game.state || previousLevel !== game.level) { syncUI(); uiTime = 0; }
  render(); requestAnimationFrame(frame);
}
syncUI(); requestAnimationFrame(frame);
