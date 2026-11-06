import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';

// Keep editable modules for development and ship a single file for players.
const [html, css, icon, core, game] = await Promise.all(
  ['index.html', 'style.css', 'favicon.svg', 'src/core.js', 'src/game.js']
    .map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')),
);
const coreScript = core.replace(/^export (?=(?:const|function)\b)/gm, '');
const gameScript = game.replace(/^import \{[^\n]+\} from '\.\/core\.js';\r?\n/, '');
if (/^\s*(?:import|export)\s/m.test(`${coreScript}\n${gameScript}`)) {
  throw new Error('Standalone build needs updating for new module imports or exports.');
}
const script = `(() => {\n'use strict';\n${coreScript}\n${gameScript}\n})();`
  .replace(/<\/script/gi, '<\\/script');
const standalone = html
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">',
    () => `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="./style.css">', () => `<style>\n${css}\n</style>`)
  .replace('class="brand" href="./"', 'class="brand" href=""')
  .replace('<script type="module" src="./src/game.js"></script>', () => `<script>\n${script}\n</script>`);
if (standalone.includes('src="./src/game.js"') || standalone.includes('href="./style.css"')) {
  throw new Error('Standalone build could not inline all game assets.');
}
await writeFile(new URL('../LUMEN.html', import.meta.url), standalone);

const destination = new URL('../dist/', import.meta.url);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of ['index.html', 'style.css', 'favicon.svg', 'src', 'LUMEN.html']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, destination), { recursive: true });
}
console.log('Built standalone LUMEN.html and static game in dist/');
