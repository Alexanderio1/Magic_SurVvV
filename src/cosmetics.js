export const THEMES = [
  { id: 'grove', name: 'Сумеречная роща', requirement: 'Доступна сразу', unlocked: () => true, ground: '#14282b', grid: '#779f7912', detail: '#35514b', light: '#bedc8f', accent: '#d4f793' },
  { id: 'frost', name: 'Ледяные пустоши', requirement: 'Выживи 60 секунд', unlocked: p => p.bestTime >= 60, ground: '#182939', grid: '#abdfff16', detail: '#50748b', light: '#b3eeff', accent: '#a5dfff' },
  { id: 'embers', name: 'Пепельные земли', requirement: 'Победи 100 врагов всего', unlocked: p => p.totalKills >= 100, ground: '#2c1b22', grid: '#ff9a6514', detail: '#67423a', light: '#ffa66b', accent: '#ffc28f' },
  { id: 'astral', name: 'Астральный сад', requirement: 'Встреть рассвет: 1 победа', unlocked: p => p.wins >= 1, ground: '#201b35', grid: '#bc9cff18', detail: '#594a7e', light: '#d4b6ff', accent: '#dfc5ff' },
];
export const SKINS = [
  { id: 'shades', name: 'Тени', requirement: 'Доступны сразу', unlocked: () => true, body: '#546d69', heavy: '#836d66', face: '#20373b', eye: '#b7e7d0' },
  { id: 'crystals', name: 'Кристаллы', requirement: 'Достигни 5-го уровня', unlocked: p => p.bestLevel >= 5, body: '#7cacd1', heavy: '#898ac7', face: '#354567', eye: '#e3f9ff' },
  { id: 'cinders', name: 'Угольки', requirement: 'Победи 250 врагов всего', unlocked: p => p.totalKills >= 250, body: '#b77554', heavy: '#ad504d', face: '#422632', eye: '#ffe1a3' },
  { id: 'masks', name: 'Древние маски', requirement: 'Изучи 6 видов магии за забег', unlocked: p => p.mostMagic >= 6, body: '#b9b497', heavy: '#a39771', face: '#393f38', eye: '#e7ffb5' },
];
export function createProgress(saved = {}) {
  const p = { totalKills: 0, bestTime: 0, bestLevel: 1, wins: 0, mostMagic: 1, theme: 'grove', skin: 'shades' };
  if (!saved || typeof saved !== 'object') return p;
  for (const key of ['totalKills', 'bestTime', 'bestLevel', 'wins', 'mostMagic']) if (Number.isFinite(saved[key]) && saved[key] >= 0) p[key] = saved[key];
  for (const [key, catalog] of [['theme', THEMES], ['skin', SKINS]]) if (catalog.some(item => item.id === saved[key] && item.unlocked(p))) p[key] = saved[key];
  return p;
}
export function recordProgress(progress, game) {
  const catalog = [...THEMES, ...SKINS], before = new Set(catalog.filter(item => item.unlocked(progress)));
  progress.totalKills += Math.max(0, game.kills - game.reportedKills);
  game.reportedKills = game.kills;
  progress.bestTime = Math.max(progress.bestTime, game.time);
  progress.bestLevel = Math.max(progress.bestLevel, game.level);
  progress.mostMagic = Math.max(progress.mostMagic, Object.values(game.player.magic).filter(rank => rank > 0).length);
  if (game.state === 'won' && !game.reportedWin) { progress.wins++; game.reportedWin = true; }
  return catalog.filter(item => item.unlocked(progress) && !before.has(item)).map(item => item.name);
}
