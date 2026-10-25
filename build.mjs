// Production build: one minified, content-hashed JS bundle and CSS file in dist/.
// Usage: npm install && npm run build  →  upload the dist/ folder to any static hosting.
import { transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script defer src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('No <script defer src="js/..."> tags found in index.html');

const js = await transform(scripts.map(f => readFileSync(f, 'utf8')).join(';\n'), { minify: true, target: 'es2020', charset: 'utf8' });
const css = await transform(readFileSync('css/app.css', 'utf8'), { loader: 'css', minify: true, charset: 'utf8' });
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);
const jsName = `app.${hash(js.code)}.js`;
const cssName = `app.${hash(css.code)}.css`;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
writeFileSync(`dist/assets/${jsName}`, js.code);
writeFileSync(`dist/assets/${cssName}`, css.code);

let out = html
  .replace(/(<script defer src="js\/[^"]+"><\/script>\n?)+/, `<script defer src="assets/${jsName}"></script>\n`)
  .replace('<link rel="stylesheet" href="css/app.css">', `<link rel="stylesheet" href="assets/${cssName}">`);
writeFileSync('dist/index.html', out);
writeFileSync('dist/robots.txt', 'User-agent: *\nAllow: /\n');
writeFileSync('dist/.nojekyll', '');
writeFileSync('dist/favicon.svg', readFileSync('favicon.svg'));

const kb = n => (n / 1024).toFixed(1) + ' KB';
const src = scripts.reduce((s, f) => s + readFileSync(f).length, 0) + readFileSync('css/app.css').length;
console.log(`dist/assets/${jsName}  ${kb(js.code.length)}`);
console.log(`dist/assets/${cssName}  ${kb(css.code.length)}`);
console.log(`source ${kb(src)} → ${kb(js.code.length + css.code.length)}`);
