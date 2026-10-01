/* Assemble l'app en un seul fichier autonome (CSS et JS intégrés).
   Usage : node scripts/build-single.js [sortie.html] [--fragment]
   --fragment : sans <!doctype>/<head>/<body> (pour une page publiée par un hébergeur qui ajoute le sien). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || path.join(root, 'dist', 'hydrapet.html');

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('aucun <script src> trouvé dans index.html');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
const css = read('style.css');
const body = `<main id="app" aria-live="polite"></main>\n<div id="toast" role="status" aria-live="polite"></div>`;
const js = scripts.map((f) => `<script>\n${safe(read(f))}\n</script>`).join('\n');
const title = '<title>HydraPet</title>';

const page = fragment
  ? `${title}\n<style>\n${css}\n</style>\n${body}\n${js}\n`
  : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n${title}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n${js}\n</body>\n</html>\n`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(out, (Buffer.byteLength(page) / 1024).toFixed(0) + ' Ko', fragment ? '(fragment)' : '');
