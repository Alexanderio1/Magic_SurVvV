export const WIDTH = typeof window !== 'undefined' && window.matchMedia('(max-width: 540px)').matches ? 544 : 1120;
export const HEIGHT = 680;
export const RUN_DURATION = 180;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// 10, 15, 21, 28, 37…: experience, never elapsed time, awards levels.
export const xpRequired = level => Math.round(10 + 3.5 * (level - 1) + 1.1 * (level - 1) ** 1.8);
export const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export function direction(x, y) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
export function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
}
export const SPELLS = [
  { id: 'spark', icon: '✦', name: 'Магические стрелы', color: '#d4f793', description: 'Автоматические стрелы находят ближайших врагов.', max: 1 },
  { id: 'nova', icon: '◎', name: 'Лунная волна', color: '#aeddff', description: 'Взрыв вокруг мага. Ранг увеличивает урон и радиус.', cooldown: 3.5, max: 5 },
  { id: 'orbit', icon: '◈', name: 'Маленькие луны', color: '#b2ffe7', description: 'Вращающиеся огоньки режут врагов. Каждый ранг добавляет луну.', max: 4 },
  { id: 'fireball', icon: '●', name: 'Огненный шар', color: '#ffb477', description: 'Снаряд взрывается при попадании и задевает целую группу.', cooldown: 2, max: 5 },
  { id: 'frost', icon: '❄', name: 'Кольцо мороза', color: '#91dcff', description: 'Ледяная волна ранит и замедляет ближайших врагов на 2,5 секунды.', cooldown: 4.5, max: 5 },
  { id: 'lightning', icon: 'ϟ', name: 'Цепная молния', color: '#f5e891', description: 'Разряд перескакивает между врагами. Ранг добавляет цели.', cooldown: 2.8, max: 5 },
  { id: 'meteor', icon: '☄', name: 'Метеорит', color: '#ff907a', description: 'Отмечает место под врагом и через 0,8 секунды обрушивает метеор.', cooldown: 4.5, max: 5 },
  { id: 'poison', icon: '♧', name: 'Ядовитый сад', color: '#b8ec7e', description: 'Создаёт под врагами облако, которое наносит урон 5 секунд.', cooldown: 4, max: 5 },
  { id: 'blades', icon: '✳', name: 'Веер клинков', color: '#dfd9ff', description: 'Восемь и более клинков летят во все стороны, пробивая врагов.', cooldown: 3.2, max: 5 },
  { id: 'beam', icon: '╱', name: 'Солнечный луч', color: '#fff0ac', description: 'Пронизывает всех врагов на длинной линии перед ближайшей целью.', cooldown: 2.6, max: 5 },
  { id: 'void', icon: '◉', name: 'Чёрная дыра', color: '#bb9bff', description: 'Стягивает врагов в одну точку и постепенно истощает их.', cooldown: 5, max: 5 },
  { id: 'storm', icon: '☁', name: 'Грозовое облако', color: '#bdd1ff', description: 'Облако три секунды бьёт разрядами по случайным врагам под ним.', cooldown: 4.5, max: 5 },
  { id: 'boomerang', icon: '☽', name: 'Возвратный серп', color: '#e9c0ff', description: 'Пробивает врагов по пути туда и обратно, возвращаясь к магу.', cooldown: 2.4, max: 5 },
  { id: 'runes', icon: '◇', name: 'Рунные ловушки', color: '#ffd6a0', description: 'Оставляет под ногами руну. Враг активирует мощный взрыв.', cooldown: 2.8, max: 5 },
  { id: 'familiar', icon: '✧', name: 'Звёздный спутник', color: '#9ff4ea', description: 'Маленький спутник летает рядом и самостоятельно стреляет по врагам.', cooldown: .85, max: 5 },
];
export const UPGRADES = [
  ...SPELLS.filter(s => s.id !== 'spark').map(s => ({ ...s, spell: true, available: p => p.magic[s.id] < s.max, apply: p => { p.magic[s.id]++; } })),
  { id: 'power', icon: '✦', name: 'Сила магии', description: 'Урон всех заклинаний +25%.', apply: p => { p.damage *= 1.25; } },
  { id: 'haste', icon: 'ϟ', name: 'Быстрая мысль', description: 'Все заклинания перезаряжаются на 15% быстрее.', available: p => p.castRate > .3, apply: p => { p.castRate = Math.max(.3, p.castRate * .85); } },
  { id: 'multishot', icon: '⋔', name: 'Созвездие', description: 'Ещё одна магическая стрела в каждом залпе.', available: p => p.shots < 5, apply: p => { p.shots++; } },
  { id: 'speed', icon: '»', name: 'Лёгкий шаг', description: 'Скорость +12%, восстановление рывка быстрее на 15%.', available: p => p.speed < 350, apply: p => { p.speed *= 1.12; p.dashInterval = Math.max(1.5, p.dashInterval * .85); } },
  { id: 'magnet', icon: '◇', name: 'Притяжение', description: 'Радиус сбора осколков +40%.', available: p => p.magnet < 400, apply: p => { p.magnet *= 1.4; } },
  { id: 'vitality', icon: '♡', name: 'Тёплый свет', description: '+25 к максимуму здоровья, восстановление 45 здоровья.', apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 45); } },
  { id: 'regen', icon: '✳', name: 'Второе дыхание', description: 'Восстанавливай дополнительно 1,5 здоровья в секунду.', apply: p => { p.regen += 1.5; } },
];
export function createGame(starter = 'spark') {
  const magic = Object.fromEntries(SPELLS.map(s => [s.id, s.id === 'spark' ? 1 : 0]));
  if (Object.hasOwn(magic, starter)) magic[starter] = 1;
  return {
    state: 'playing', time: 0, kills: 0, level: 1, xp: 0, nextId: 1, reportedKills: 0, reportedWin: false,
    spawnTimer: .8, fireTimer: .2, spellTimers: {}, enemies: [], bullets: [], gems: [], particles: [], effects: [], zones: [], choices: [],
    player: { x: 0, y: 0, radius: 13, hp: 100, maxHp: 100, speed: 190, damage: 25, fireInterval: .65, castRate: 1, shots: 1, magnet: 110, magic, regen: 0, invincible: 0, dashCooldown: 0, dashTime: 0, dashInterval: 4, facing: { x: 0, y: -1 }, dashDirection: { x: 0, y: -1 } },
  };
}
export function chooseUpgrades(player, random = Math.random) {
  const pool = UPGRADES.filter(u => !u.available || u.available(player));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const fresh = pool.filter(u => u.spell && !player.magic[u.id]);
  const learned = pool.filter(u => u.spell && player.magic[u.id]);
  const passive = pool.filter(u => !u.spell);
  // Offer discovery, improvement and a passive whenever all are available.
  return [...new Set([fresh[0], learned[0] || fresh[1], passive[0], ...pool].filter(Boolean))].slice(0, 3);
}
function checkLevel(game, random) {
  if (game.xp < xpRequired(game.level)) return;
  game.xp -= xpRequired(game.level);
  game.level++;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + 8);
  game.state = 'upgrade';
  game.choices = chooseUpgrades(game.player, random);
}
export function selectUpgrade(game, id, random = Math.random) {
  if (game.state !== 'upgrade') return false;
  const choice = game.choices.find(u => u.id === id);
  if (!choice) return false;
  choice.apply(game.player);
  game.choices = [];
  game.state = 'playing';
  checkLevel(game, random);
  return true;
}
export function dash(game) {
  const p = game.player;
  if (game.state !== 'playing' || p.dashCooldown > 0) return false;
  p.dashCooldown = p.dashInterval;
  p.dashTime = .19;
  p.invincible = Math.max(p.invincible, .3);
  p.dashDirection = { ...p.facing };
  return true;
}
export function spawnEnemy(game, random = Math.random) {
  const p = game.player, side = Math.floor(random() * 4);
  let x = p.x + (random() - .5) * WIDTH, y = p.y + (random() - .5) * HEIGHT;
  if (side === 0) x = p.x - WIDTH / 2 - 40;
  if (side === 1) x = p.x + WIDTH / 2 + 40;
  if (side === 2) y = p.y - HEIGHT / 2 - 40;
  if (side === 3) y = p.y + HEIGHT / 2 + 40;
  const roll = random();
  const type = game.time > 70 && roll < .2 ? 'brute' : game.time > 25 && roll < .4 ? 'wisp' : 'shade';
  const stats = { shade: [30, 55, 13, 10, 2], wisp: [20, 98, 10, 8, 2], brute: [100, 40, 22, 20, 5] }[type];
  const scale = 1 + game.time / 180;
  const enemy = { id: game.nextId++, x, y, type, hp: stats[0] * scale, maxHp: stats[0] * scale, speed: stats[1] * (1 + game.time / 400), radius: stats[2], damage: stats[3], xp: stats[4], hit: 0, orbitCooldown: 0, slow: 0, phase: random() * Math.PI * 2 };
  game.enemies.push(enemy);
  return enemy;
}
function burst(game, x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + game.time;
    game.particles.push({ x, y, vx: Math.cos(angle) * (35 + i * 7), vy: Math.sin(angle) * (35 + i * 7), life: .45, maxLife: .45, color });
  }
}
function hitEnemy(game, enemy, damage) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  enemy.hit = .12;
  if (enemy.hp <= 0) {
    game.kills++;
    game.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp });
    burst(game, enemy.x, enemy.y, '#a8d5c5');
  }
}
function effect(game, kind, at, options = {}) {
  const life = options.life ?? .4;
  game.effects.push({ kind, x: at.x, y: at.y, radius: 80, color: '#d4f793', ...options, life, maxLife: life });
}
function areaHit(game, at, radius, damage, color, slow = 0) {
  for (const e of game.enemies) if (e.hp > 0 && distance(at, e) < radius + e.radius) {
    hitEnemy(game, e, damage);
    e.slow = Math.max(e.slow, slow);
  }
  effect(game, 'ring', at, { radius, color });
}
function projectile(game, at, aim, options = {}) {
  game.bullets.push({ x: at.x, y: at.y, vx: aim.x * 480, vy: aim.y * 480, life: 2.6, age: 0, damage: game.player.damage, radius: 5, kind: 'spark', color: '#d4f793', pierce: 1, hits: new Set(), ...options });
}
export function orbitPositions(game) {
  const count = game.player.magic.orbit;
  return Array.from({ length: count }, (_, i) => {
    const angle = game.time * 2.6 + i * Math.PI * 2 / count;
    return { x: game.player.x + Math.cos(angle) * 69, y: game.player.y + Math.sin(angle) * 69 };
  });
}
export function familiarPosition(game) {
  return { x: game.player.x + Math.cos(game.time * 1.5) * 42, y: game.player.y + Math.sin(game.time * 1.5) * 42 };
}
function castSpell(game, spell, rank, target, random) {
  const p = game.player, scale = p.damage / 25, color = spell.color;
  const aim = target ? direction(target.x - p.x, target.y - p.y) : p.facing;
  const at = target || p;
  switch (spell.id) {
    case 'nova': areaHit(game, p, 115 + rank * 18, 35 * rank * scale, color); break;
    case 'frost': areaHit(game, p, 150 + rank * 20, (12 + rank * 10) * scale, color, 2.5); break;
    case 'fireball': projectile(game, p, aim, { kind: 'fireball', radius: 9, color, damage: (30 + rank * 14) * scale, blast: 65 + rank * 8 }); break;
    case 'lightning': {
      let from = p, next = target;
      const visited = new Set();
      for (let i = 0; i < 2 + rank && next; i++) {
        effect(game, 'bolt', from, { x2: next.x, y2: next.y, color, life: .25 });
        hitEnemy(game, next, (30 + rank * 12) * scale);
        visited.add(next.id); from = next;
        next = game.enemies.filter(e => e.hp > 0 && !visited.has(e.id) && distance(from, e) < 230).sort((a, b) => distance(from, a) - distance(from, b))[0];
      }
      break;
    }
    case 'blades':
      for (let i = 0; i < 6 + rank * 2; i++) {
        const angle = i * Math.PI * 2 / (6 + rank * 2) + game.time;
        projectile(game, p, { x: Math.cos(angle), y: Math.sin(angle) }, { kind: 'blade', color, damage: (18 + rank * 8) * scale, pierce: 3, life: 1.3 });
      }
      break;
    case 'beam': {
      const end = { x: p.x + aim.x * 680, y: p.y + aim.y * 680 };
      for (const e of game.enemies) if (segmentDistance(e, p, end) < e.radius + 10 + rank * 2) hitEnemy(game, e, (40 + rank * 16) * scale);
      effect(game, 'beam', p, { x2: end.x, y2: end.y, color, radius: 10 + rank * 2, life: .35 });
      break;
    }
    case 'boomerang': projectile(game, p, aim, { kind: 'boomerang', color, damage: (24 + rank * 9) * scale, pierce: Infinity, radius: 12, life: 3 }); break;
    case 'familiar': {
      const origin = familiarPosition(game);
      projectile(game, origin, direction(at.x - origin.x, at.y - origin.y), { kind: 'familiar', color, damage: (15 + rank * 8) * scale });
      break;
    }
    default: {
      const config = {
        meteor: { radius: 75 + rank * 12, damage: (80 + rank * 25) * scale, life: .8 },
        poison: { radius: 90 + rank * 10, damage: (6 + rank * 5) * scale, life: 5, interval: .5 },
        void: { radius: 125 + rank * 12, damage: (4 + rank * 3) * scale, life: 3.5, interval: .3 },
        storm: { radius: 125 + rank * 10, damage: (20 + rank * 10) * scale, life: 3, interval: .35 },
        runes: { radius: 85 + rank * 10, damage: (60 + rank * 22) * scale, life: 12 },
      }[spell.id];
      if (config) game.zones.push({ kind: spell.id, x: spell.id === 'runes' ? p.x : at.x, y: spell.id === 'runes' ? p.y : at.y, color, tick: 0, age: 0, ...config });
    }
  }
}
function updateZones(game, dt, random) {
  for (const zone of game.zones) {
    zone.life -= dt; zone.age += dt; zone.tick -= dt;
    const inside = game.enemies.filter(e => e.hp > 0 && distance(zone, e) < zone.radius + e.radius);
    if (zone.kind === 'meteor') {
      if (zone.life <= 0) { areaHit(game, zone, zone.radius, zone.damage, zone.color); effect(game, 'meteor', zone, { color: zone.color, radius: zone.radius, life: .5 }); }
    } else if (zone.kind === 'runes') {
      if (zone.age > .7 && inside.some(e => distance(zone, e) < 45 + e.radius)) {
        areaHit(game, zone, zone.radius, zone.damage, zone.color); zone.life = 0;
      }
    } else {
      if (zone.kind === 'void') for (const e of inside) {
        const d = distance(zone, e), aim = direction(zone.x - e.x, zone.y - e.y);
        e.x += aim.x * Math.min(d, 115 * dt); e.y += aim.y * Math.min(d, 115 * dt);
      }
      if (zone.tick <= 0) {
        if (zone.kind === 'storm' && inside.length) {
          const e = inside[Math.floor(random() * inside.length)];
          hitEnemy(game, e, zone.damage); effect(game, 'bolt', { x: zone.x, y: zone.y - 45 }, { x2: e.x, y2: e.y, color: zone.color, life: .18 });
        } else if (zone.kind !== 'storm') for (const e of inside) hitEnemy(game, e, zone.damage);
        zone.tick = zone.interval;
      }
    }
  }
  game.zones = game.zones.filter(z => z.life > 0);
}
function updateBullets(game, dt) {
  for (const b of game.bullets) {
    const previous = { x: b.x, y: b.y };
    b.age += dt; b.life -= dt;
    if (b.kind === 'boomerang' && b.age > .65) {
      if (!b.returning) { b.returning = true; b.hits.clear(); }
      const aim = direction(game.player.x - b.x, game.player.y - b.y);
      b.vx = aim.x * 570; b.vy = aim.y * 570;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const e of game.enemies) if (e.hp > 0 && !b.hits.has(e.id) && segmentDistance(e, previous, b) < e.radius + b.radius) {
      b.hits.add(e.id);
      if (b.blast) areaHit(game, b, b.blast, b.damage, b.color);
      else hitEnemy(game, e, b.damage);
      b.pierce--;
      if (b.pierce <= 0) { b.life = 0; break; }
    }
    if (b.returning && segmentDistance(game.player, previous, b) < 14) b.life = 0;
  }
  game.bullets = game.bullets.filter(b => b.life > 0);
}
export function update(game, input, dt, random = Math.random) {
  if (game.state !== 'playing') return;
  dt = clamp(dt, 0, .05);
  game.time = Math.min(RUN_DURATION, game.time + dt);
  if (game.time >= RUN_DURATION) { game.state = 'won'; return; }
  const p = game.player;
  p.invincible = Math.max(0, p.invincible - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  const movement = direction(input.x, input.y);
  if (movement.x || movement.y) p.facing = movement;
  const moving = p.dashTime > 0 ? p.dashDirection : movement;
  const speed = p.speed * (p.dashTime > 0 ? 4 : 1);
  // World coordinates have no bounds. The renderer keeps the camera on the mage.
  p.x += moving.x * speed * dt; p.y += moving.y * speed * dt;
  if (p.dashTime > 0) burst(game, p.x, p.y, '#bcecad', 1);
  p.dashTime = Math.max(0, p.dashTime - dt);
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    for (let i = 0; i < 1 + Math.floor(game.time / 45) && game.enemies.length < 180; i++) spawnEnemy(game, random);
    game.spawnTimer = Math.max(.3, 1.05 - game.time * .004);
  }
  const targets = game.enemies.filter(e => e.hp > 0).sort((a, b) => distance(p, a) - distance(p, b));
  game.fireTimer -= dt;
  if (game.fireTimer <= 0 && targets.length) {
    for (let i = 0; i < p.shots; i++) {
      const target = targets[i % targets.length], aim = direction(target.x - p.x, target.y - p.y);
      projectile(game, p, aim);
    }
    game.fireTimer = p.fireInterval * p.castRate;
  }
  for (const spell of SPELLS) if (p.magic[spell.id] && spell.cooldown) {
    game.spellTimers[spell.id] = (game.spellTimers[spell.id] ?? .3) - dt;
    if (game.spellTimers[spell.id] <= 0 && (targets.length || spell.id === 'runes')) {
      castSpell(game, spell, p.magic[spell.id], targets.find(e => e.hp > 0), random);
      game.spellTimers[spell.id] = spell.cooldown * p.castRate;
    }
  }
  updateZones(game, dt, random); updateBullets(game, dt);
  const orbits = orbitPositions(game);
  for (const e of game.enemies) {
    if (e.hp <= 0) continue;
    e.hit = Math.max(0, e.hit - dt); e.orbitCooldown = Math.max(0, e.orbitCooldown - dt); e.slow = Math.max(0, e.slow - dt);
    const aim = direction(p.x - e.x, p.y - e.y), speed = e.speed * (e.slow > 0 ? .35 : 1);
    e.x += aim.x * speed * dt; e.y += aim.y * speed * dt;
    if (e.orbitCooldown <= 0 && orbits.some(o => distance(o, e) < e.radius + 11)) {
      hitEnemy(game, e, (24 + p.magic.orbit * 8) * p.damage / 25); e.orbitCooldown = .45;
    }
    if (e.hp > 0 && p.invincible <= 0 && distance(p, e) < p.radius + e.radius) {
      p.hp = Math.max(0, p.hp - e.damage); p.invincible = .75;
      e.x -= aim.x * 22; e.y -= aim.y * 22; burst(game, p.x, p.y, '#f4a08f', 12);
      if (p.hp <= 0) { game.state = 'lost'; return; }
    }
  }
  // Discard entities left far behind, so travelling never grows memory without bound.
  game.enemies = game.enemies.filter(e => e.hp > 0 && distance(p, e) < Math.max(WIDTH, HEIGHT) * 2.5);
  game.gems = game.gems.filter(gem => {
    const d = distance(p, gem);
    if (d < p.radius + 10) { game.xp += gem.value; return false; }
    if (d > 4000) return false;
    if (d < p.magnet) {
      const aim = direction(p.x - gem.x, p.y - gem.y), step = Math.min(d, (200 + (p.magnet - d) * 3) * dt);
      gem.x += aim.x * step; gem.y += aim.y * step;
    }
    return true;
  }).slice(-2000);
  for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
  game.particles = game.particles.filter(particle => particle.life > 0).slice(-350);
  for (const e of game.effects) e.life -= dt;
  game.effects = game.effects.filter(e => e.life > 0).slice(-150);
  checkLevel(game, random);
}
