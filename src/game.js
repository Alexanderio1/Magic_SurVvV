import { WIDTH, HEIGHT, RUN_DURATION, createGame, update, dash, selectUpgrade, xpRequired, formatTime, orbitPositions, clamp } from './core.js';

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
const scenery = Array.from({ length: 100 }, (_, i) => ({ x: ((i * 173.3 + 73) % WIDTH), y: ((i * 93.7 + 29) % HEIGHT), size: 1 + i % 4, phase: i * 1.9 }));

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
function start() { clearInput(); game = createGame(); previousState = ''; previousLevel = 0; tone(392, .2); syncUI(); canvas.focus({ preventScroll: true }); }
function pause() { if (game.state === 'playing') { game.state = 'paused'; clearInput(); syncUI(); } }
function resume() { if (game.state === 'paused') { game.state = 'playing'; syncUI(); canvas.focus({ preventScroll: true }); } }
function doDash() { if (dash(game)) tone(165, .14, .06); }
function choose(index) { const choice = game.choices[index]; if (choice && selectUpgrade(game, choice.id)) { tone(660, .2); syncUI(); if (game.state === 'playing') canvas.focus({ preventScroll: true }); } }
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
    $('overlay').hidden = game.state === 'playing';
    for (const [id, state] of [['welcome', 'menu'], ['pause-dialog', 'paused'], ['upgrade-dialog', 'upgrade']]) $(id).hidden = game.state !== state;
    $('end-dialog').hidden = !['won', 'lost'].includes(game.state);
    $('hud').hidden = game.state === 'menu'; $('xp-hud').hidden = game.state === 'menu';
    $('touch-controls').hidden = !isTouch || game.state !== 'playing';
    if (game.state === 'upgrade') {
      clearInput();
      $('upgrade-choices').replaceChildren(...game.choices.map((choice, index) => {
        const button = document.createElement('button'); button.className = 'upgrade-card';
        button.innerHTML = `<span class="upgrade-icon" aria-hidden="true">${choice.icon}</span><strong>${choice.name}</strong><p>${choice.description}</p><small>ВЫБРАТЬ · ${index + 1}</small>`;
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
  $('level').textContent = game.level; $('kills').textContent = game.kills;
  $('wave-label').textContent = game.state === 'menu' ? 'ОЖИДАНИЕ ЗАБЕГА' : `ВОЛНА ${Math.min(4, 1 + Math.floor(game.time / 45))} / 4`;
  $('dash-label').textContent = game.player.dashCooldown > 0 ? `РЫВОК · ${game.player.dashCooldown.toFixed(1)} С` : `${isTouch ? '↯' : 'ПРОБЕЛ'} · РЫВОК ГОТОВ`;
}

function circle(x, y, radius, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
function diamond(x, y, radius, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + radius * .65, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius * .65, y); ctx.closePath(); ctx.fill(); }
function glow(x, y, radius, color) { const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius); gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent'); circle(x, y, radius, gradient); }
const background = document.createElement('canvas'); background.width = WIDTH; background.height = HEIGHT;
const bg = background.getContext('2d');
function prepareBackground() {
  bg.fillStyle = '#122329'; bg.fillRect(0, 0, WIDTH, HEIGHT);
  const grad = bg.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 650); grad.addColorStop(0, '#1b3335'); grad.addColorStop(1, '#0b1921'); bg.fillStyle = grad; bg.fillRect(0, 0, WIDTH, HEIGHT);
  bg.strokeStyle = '#759f7c09'; bg.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 56) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, HEIGHT); bg.stroke(); }
  for (let y = 0; y < HEIGHT; y += 56) { bg.beginPath(); bg.moveTo(0, y); bg.lineTo(WIDTH, y); bg.stroke(); }
  bg.save(); bg.translate(WIDTH / 2, HEIGHT / 2); bg.strokeStyle = '#aecb8d0e';
  for (const radius of [115, 122, 212, 219]) { bg.beginPath(); bg.arc(0, 0, radius, 0, Math.PI * 2); bg.stroke(); }
  for (let i = 0; i < 12; i++) { bg.save(); bg.rotate(i * Math.PI / 6); bg.strokeRect(-5, 198, 10, 10); bg.restore(); }
  bg.restore();
  for (const s of scenery) {
    bg.strokeStyle = '#47625425'; bg.lineWidth = 1; bg.beginPath(); bg.moveTo(s.x, s.y + 5); bg.lineTo(s.x - 2, s.y - s.size); bg.moveTo(s.x, s.y + 5); bg.lineTo(s.x + 4, s.y); bg.stroke();
    if (s.size > 3) { bg.fillStyle = '#263a3b'; bg.beginPath(); bg.ellipse(s.x + 12, s.y, 5 + s.size, 3 + s.size, -.4, 0, Math.PI * 2); bg.fill(); }
  }
  for (let i = 0; i < 20; i++) {
    const x = i * 65 - 40, y = i % 2 ? 12 : HEIGHT - 12;
    bg.fillStyle = '#0b1b21'; bg.beginPath(); bg.moveTo(x - 45, y); bg.lineTo(x - 10, y + (y < 100 ? 68 : -68)); bg.lineTo(x + 25, y); bg.fill();
  }
}
prepareBackground();
function render() {
  ctx.drawImage(background, 0, 0);
  const t = reducedMotion ? 0 : ambientTime;
  for (let i = 0; i < 28; i++) {
    const s = scenery[i]; const x = s.x + Math.sin(t * .3 + s.phase) * 15, y = s.y + Math.cos(t * .2 + s.phase) * 11;
    circle(x, y, 1.2, `rgba(186,220,142,${.15 + Math.sin(t + s.phase) * .12})`);
  }
  if (game.state === 'menu') {
    for (let i = 0; i < 7; i++) { const a = i * 1.2, x = WIDTH / 2 + Math.cos(a) * 340, y = HEIGHT / 2 + Math.sin(a) * 220; drawEnemy({ x, y, radius: i % 3 === 0 ? 19 : 13, type: i % 3 === 0 ? 'brute' : 'shade', hit: 0, phase: i }); }
    for (const s of scenery.slice(30, 42)) diamond(s.x, s.y, 5, '#84c6a980');
    return;
  }
  for (const gem of game.gems) { diamond(gem.x, gem.y, gem.value > 2 ? 7 : 5, '#84dcc3'); diamond(gem.x - 1, gem.y - 1, 2, '#e2ffdf'); }
  for (const ring of game.rings) { ctx.strokeStyle = `rgba(174,222,247,${ring.life * 1.5})`; ctx.lineWidth = 2 + ring.life * 4; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius * (1 - ring.life), 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = `rgba(174,222,247,${ring.life * .4})`; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2); ctx.stroke(); }
  for (const enemy of game.enemies) drawEnemy(enemy);
  for (const bullet of game.bullets) {
    ctx.strokeStyle = '#b9efad70'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bullet.x - bullet.vx * .025, bullet.y - bullet.vy * .025); ctx.lineTo(bullet.x, bullet.y); ctx.stroke(); circle(bullet.x, bullet.y, 4, '#e2ffc1');
  }
  const p = game.player;
  glow(p.x, p.y, 75, '#c5ef8f14');
  const moons = orbitPositions(game);
  if (moons.length) { ctx.strokeStyle = '#aacdb51c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 69, 0, Math.PI * 2); ctx.stroke(); }
  for (const moon of moons) { glow(moon.x, moon.y, 19, '#a5eddf40'); diamond(moon.x, moon.y, 10, '#b2ffe7'); }
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.invincible > 0 && Math.floor(p.invincible * 22) % 2) ctx.globalAlpha = .55;
  ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(0, 16, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  const bob = reducedMotion ? 0 : Math.sin(t * 5) * 1.5;
  ctx.translate(0, bob);
  ctx.fillStyle = '#4e8c80'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-12, -10, -17, 16); ctx.quadraticCurveTo(0, 24, 17, 16); ctx.quadraticCurveTo(12, -10, 0, -12); ctx.fill();
  ctx.fillStyle = '#263e3e'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, 15); ctx.lineTo(8, 15); ctx.fill();
  circle(0, -10, 10, '#78a88d'); circle(0, -7, 7, '#152d31');
  circle(-3, -8, 1.5, '#e3ffc1'); circle(3, -8, 1.5, '#e3ffc1');
  ctx.strokeStyle = '#bbcb9b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(17, 16); ctx.lineTo(17, -16); ctx.stroke(); diamond(17, -21, 6, '#d4f793');
  if (p.dashTime > 0) { ctx.strokeStyle = '#d4f793'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  for (const particle of game.particles) { ctx.globalAlpha = particle.life / particle.maxLife; circle(particle.x, particle.y, 2, particle.color); } ctx.globalAlpha = 1;
  if (p.hp < p.maxHp * .3) { ctx.strokeStyle = '#cd665b55'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WIDTH, HEIGHT); }
}
function drawEnemy(enemy) {
  const { x, y, radius: r, type } = enemy;
  const bob = reducedMotion ? 0 : Math.sin(ambientTime * 4 + enemy.phase) * 3;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(0, r, r, r * .35, 0, 0, Math.PI * 2); ctx.fill();
  if (type === 'wisp') {
    diamond(0, 0, r * 1.5, enemy.hit ? '#fff' : '#a8a0d1'); diamond(0, 1, r * .8, '#423f63'); circle(0, -1, 2, '#ece6ff');
  } else {
    ctx.fillStyle = enemy.hit ? '#e9ffdf' : type === 'brute' ? '#836d66' : '#546d69';
    ctx.beginPath(); ctx.moveTo(-r, r); ctx.quadraticCurveTo(-r * 1.4, -r, 0, -r * 1.1); ctx.quadraticCurveTo(r * 1.4, -r, r, r); ctx.lineTo(r * .4, r * .65); ctx.lineTo(0, r); ctx.lineTo(-r * .4, r * .65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = type === 'brute' ? '#382e32' : '#20373b'; ctx.beginPath(); ctx.ellipse(0, -r * .1, r * .65, r * .5, 0, 0, Math.PI * 2); ctx.fill();
    circle(-r * .27, -r * .14, type === 'brute' ? 2.5 : 1.8, type === 'brute' ? '#f6b4a0' : '#b7e7d0'); circle(r * .27, -r * .14, type === 'brute' ? 2.5 : 1.8, type === 'brute' ? '#f6b4a0' : '#b7e7d0');
    if (type === 'brute') { ctx.strokeStyle = '#c09f82'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * .6, -r * .7); ctx.lineTo(-r * .9, -r * 1.4); ctx.moveTo(r * .6, -r * .7); ctx.lineTo(r * .9, -r * 1.4); ctx.stroke(); }
  }
  ctx.restore();
}
let uiTime = 0;
function frame(timestamp) {
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .05) : 0;
  lastFrame = timestamp; ambientTime += dt;
  const kills = game.kills, hp = game.player.hp;
  update(game, { x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touch.x, y: Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + touch.y }, dt);
  if (game.kills > kills) tone(440 + game.kills % 5 * 55, .05, .015);
  if (game.player.hp < hp) tone(100, .12, .05);
  uiTime += dt;
  if (uiTime > .08 || previousState !== game.state || previousLevel !== game.level) { syncUI(); uiTime = 0; }
  render(); requestAnimationFrame(frame);
}
syncUI(); requestAnimationFrame(frame);
