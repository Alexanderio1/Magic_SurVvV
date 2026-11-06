import { mkdir, cp, rm } from 'node:fs/promises';
const destination = new URL('../dist/', import.meta.url);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of ['index.html', 'style.css', 'favicon.svg', 'src']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, destination), { recursive: true });
}
console.log('Built static game in dist/');
