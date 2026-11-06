export const WIDTH = typeof window !== 'undefined' && window.matchMedia('(max-width: 540px)').matches ? 544 : 1120;
export const HEIGHT = 680;
export const RUN_DURATION = 180;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const xpRequired = level => 6 + level * 4;
export const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export function direction(x, y) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
export const UPGRADES = [
  { id: 'power', icon: '✦', name: 'Острая искра', description: 'Урон магических стрел увеличивается на 35%.', apply: p => { p.damage *= 1.35; } },
  { id: 'haste', icon: 'ϟ', name: 'Быстрая мысль', description: 'Магические стрелы вылетают на 20% чаще.', apply: p => { p.fireInterval = Math.max(.12, p.fireInterval * .8); } },
  { id: 'multishot', icon: '⋔', name: 'Созвездие', description: 'Ещё одна стрела в каждом залпе. Больше света!', available: p => p.shots < 5, apply: p => { p.shots += 1; } },
  { id: 'nova', icon: '◎', name: 'Лунная волна', description: 'Круговой взрыв вокруг тебя. Повторный выбор усиливает его.', apply: p => { p.nova += 1; } },
  { id: 'orbit', icon: '◈', name: 'Маленькая луна', description: 'Вокруг тебя вращается защитный огонёк. До четырёх лун.', available: p => p.orbits < 4, apply: p => { p.orbits += 1; } },
  { id: 'speed', icon: '»', name: 'Лёгкий шаг', description: 'Скорость движения +15%. Рывок восстанавливается быстрее.', apply: p => { p.speed *= 1.15; p.dashInterval = Math.max(1.5, p.dashInterval * .85); } },
  { id: 'magnet', icon: '◇', name: 'Притяжение', description: 'Собирай осколки с большего расстояния: радиус +45%.', apply: p => { p.magnet *= 1.45; } },
  { id: 'vitality', icon: '♡', name: 'Тёплый свет', description: '+25 к максимальному здоровью и восстановление 45 здоровья.', apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 45); } },
  { id: 'regen', icon: '✳', name: 'Второе дыхание', description: 'Восстанавливай 1,5 здоровья каждую секунду.', apply: p => { p.regen += 1.5; } },
];

export function createGame() {
  return {
    state: 'playing', time: 0, kills: 0, level: 1, xp: 0, nextId: 1,
    spawnTimer: .8, fireTimer: .2, novaTimer: 3, enemies: [], bullets: [], gems: [], particles: [], rings: [], choices: [],
    player: { x: WIDTH / 2, y: HEIGHT / 2, radius: 13, hp: 100, maxHp: 100, speed: 190, damage: 25, fireInterval: .65, shots: 1, magnet: 90, nova: 0, orbits: 0, regen: 0, invincible: 0, dashCooldown: 0, dashTime: 0, dashInterval: 4, facing: { x: 0, y: -1 }, dashDirection: { x: 0, y: -1 } },
  };
}

export function chooseUpgrades(player, random = Math.random) {
  const pool = UPGRADES.filter(u => !u.available || u.available(player));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function checkLevel(game, random) {
  if (game.xp < xpRequired(game.level)) return;
  game.xp -= xpRequired(game.level);
  game.level += 1;
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
  const side = Math.floor(random() * 4);
  let x = random() * WIDTH, y = random() * HEIGHT;
  if (side === 0) x = -25;
  if (side === 1) x = WIDTH + 25;
  if (side === 2) y = -25;
  if (side === 3) y = HEIGHT + 25;
  const roll = random();
  const type = game.time > 70 && roll < .2 ? 'brute' : game.time > 25 && roll < .4 ? 'wisp' : 'shade';
  const stats = { shade: [30, 47, 13, 10, 2], wisp: [20, 87, 10, 8, 2], brute: [100, 33, 22, 20, 5] }[type];
  const scale = 1 + game.time / 160;
  const enemy = { id: game.nextId++, x, y, type, hp: stats[0] * scale, maxHp: stats[0] * scale, speed: stats[1] * (1 + game.time / 450), radius: stats[2], damage: stats[3], xp: stats[4], hit: 0, orbitCooldown: 0, phase: random() * Math.PI * 2 };
  game.enemies.push(enemy);
  return enemy;
}

function burst(game, x, y, color, count = 8) {
  // Deterministic cosmetic particles keep gameplay randomness independent.
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
    game.kills += 1;
    game.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp });
    burst(game, enemy.x, enemy.y, enemy.type === 'brute' ? '#e5a58f' : '#a8d5c5');
  }
}
export function orbitPositions(game) {
  return Array.from({ length: game.player.orbits }, (_, i) => {
    const angle = game.time * 2.6 + i * Math.PI * 2 / game.player.orbits;
    return { x: game.player.x + Math.cos(angle) * 69, y: game.player.y + Math.sin(angle) * 69 };
  });
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
  p.x = clamp(p.x + moving.x * speed * dt, 20, WIDTH - 20);
  p.y = clamp(p.y + moving.y * speed * dt, 65, HEIGHT - 38);
  if (p.dashTime > 0) burst(game, p.x, p.y, '#bcecad', 1);
  p.dashTime = Math.max(0, p.dashTime - dt);
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    const count = 1 + Math.floor(game.time / 45);
    for (let i = 0; i < count && game.enemies.length < 180; i++) spawnEnemy(game, random);
    game.spawnTimer = Math.max(.3, 1.15 - game.time * .004);
  }
  game.fireTimer -= dt;
  if (game.fireTimer <= 0 && game.enemies.length) {
    const targets = [...game.enemies].sort((a, b) => distance(p, a) - distance(p, b));
    for (let i = 0; i < p.shots; i++) {
      const target = targets[i % targets.length];
      const aim = direction(target.x - p.x, target.y - p.y);
      const angle = Math.atan2(aim.y, aim.x) + (i >= targets.length ? (i % 2 ? .09 : -.09) : 0);
      game.bullets.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 480, vy: Math.sin(angle) * 480, life: 2.6, damage: p.damage });
    }
    game.fireTimer = p.fireInterval;
  }
  game.novaTimer -= dt;
  if (p.nova > 0 && game.novaTimer <= 0) {
    const radius = 115 + p.nova * 14;
    game.rings.push({ x: p.x, y: p.y, radius, life: .5 });
    for (const enemy of game.enemies) if (distance(p, enemy) < radius + enemy.radius) hitEnemy(game, enemy, 35 * p.nova);
    game.novaTimer = 3.5;
  }
  const orbits = orbitPositions(game);
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.orbitCooldown = Math.max(0, enemy.orbitCooldown - dt);
    const aim = direction(p.x - enemy.x, p.y - enemy.y);
    enemy.x += aim.x * enemy.speed * dt;
    enemy.y += aim.y * enemy.speed * dt;
    if (enemy.orbitCooldown <= 0 && orbits.some(o => distance(o, enemy) < enemy.radius + 11)) {
      hitEnemy(game, enemy, 24 + p.damage * .4);
      enemy.orbitCooldown = .45;
    }
    if (enemy.hp > 0 && p.invincible <= 0 && distance(p, enemy) < p.radius + enemy.radius) {
      p.hp = Math.max(0, p.hp - enemy.damage);
      p.invincible = .75;
      enemy.x -= aim.x * 22;
      enemy.y -= aim.y * 22;
      burst(game, p.x, p.y, '#f4a08f', 12);
      if (p.hp <= 0) { game.state = 'lost'; return; }
    }
  }
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    for (const enemy of game.enemies) {
      if (enemy.hp > 0 && distance(bullet, enemy) < enemy.radius + 6) {
        hitEnemy(game, enemy, bullet.damage);
        bullet.life = 0;
        break;
      }
    }
  }
  game.enemies = game.enemies.filter(e => e.hp > 0);
  game.bullets = game.bullets.filter(b => b.life > 0 && b.x > -40 && b.x < WIDTH + 40 && b.y > -40 && b.y < HEIGHT + 40);
  game.gems = game.gems.filter(gem => {
    const d = distance(p, gem);
    if (d < p.radius + 10) { game.xp += gem.value; return false; }
    if (d < p.magnet) {
      const aim = direction(p.x - gem.x, p.y - gem.y);
      const step = Math.min(d, (200 + (p.magnet - d) * 3) * dt);
      gem.x += aim.x * step;
      gem.y += aim.y * step;
    }
    return true;
  });
  for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
  game.particles = game.particles.filter(particle => particle.life > 0).slice(-350);
  for (const ring of game.rings) ring.life -= dt;
  game.rings = game.rings.filter(ring => ring.life > 0);
  checkLevel(game, random);
}
