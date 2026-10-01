/* Regroupe tous les fichiers assets/lottie/*.json dans assets/lottie/lottie-data.js.
   (Un fichier .js se charge même quand l'app est ouverte par double-clic, ce que fetch() ne permet pas.)
   Usage : node scripts/build-lottie-assets.js */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'lottie');
const names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const data = {};
names.forEach((f) => {
  const json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!json.layers || !json.w || !json.h || !json.fr) throw new Error(f + ' n’est pas une animation Lottie valide');
  data[path.basename(f, '.json')] = json;
});
const out = '/* Généré par scripts/build-lottie-assets.js : ne pas modifier à la main. */\n'
  + '(function (root) { var HP = (root.HP = root.HP || {}); HP.lottieData = ' + JSON.stringify(data) + '; })(typeof window !== \'undefined\' ? window : globalThis);\n';
fs.writeFileSync(path.join(dir, 'lottie-data.js'), out);
console.log('lottie-data.js :', Object.keys(data).join(', '), '(' + (out.length / 1024).toFixed(1) + ' Ko)');
