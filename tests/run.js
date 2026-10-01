/* Tests de la logique pure de HydraPet : node tests/run.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { console };
ctx.globalThis = ctx;
ctx.localStorage = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
};
vm.createContext(ctx);
['store', 'colors', 'poses'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
});
const HP = ctx.HP;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); } catch (e) {
    console.error('FAIL  ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

/* ---------- besoin en eau ---------- */
test('calcGoal : 70 kg / 170 cm / normal → 2300 ml', () => {
  assert.strictEqual(HP.store.calcGoal({ weight: 70, height: 170, activity: 'normal' }), 2300);
});
test('calcGoal : l’activité fait varier le besoin', () => {
  const base = { weight: 70, height: 170 };
  const low = HP.store.calcGoal({ ...base, activity: 'low' });
  const high = HP.store.calcGoal({ ...base, activity: 'high' });
  assert.ok(low < 2300 && high > 2300, `${low} < 2300 < ${high}`);
});
test('calcGoal : la taille compte un peu', () => {
  const small = HP.store.calcGoal({ weight: 70, height: 150, activity: 'normal' });
  const tall = HP.store.calcGoal({ weight: 70, height: 195, activity: 'normal' });
  assert.ok(small < tall);
});
test('calcGoal : arrondi à 50 ml et borné [1200, 5000]', () => {
  assert.strictEqual(HP.store.calcGoal({ weight: 20, height: 100, activity: 'low' }), 1200);
  assert.strictEqual(HP.store.calcGoal({ weight: 300, height: 250, activity: 'high' }), 5000);
  assert.strictEqual(HP.store.calcGoal({ weight: 63.7, height: 168, activity: 'normal' }) % 50, 0);
});
test('calcGoal : entrées invalides → null', () => {
  assert.strictEqual(HP.store.calcGoal({ weight: '', height: 170 }), null);
  assert.strictEqual(HP.store.calcGoal({ weight: 5, height: 170 }), null);
  assert.strictEqual(HP.store.calcGoal({ weight: 70, height: 20 }), null);
  assert.strictEqual(HP.store.calcGoal({ weight: 'abc', height: 'x' }), null);
});

/* ---------- journal d'hydratation ---------- */
test('addWater / todayTotal / undoLast', () => {
  HP.store.reset();
  assert.strictEqual(HP.store.addWater(0), null);
  assert.strictEqual(HP.store.addWater(5000), null);
  assert.ok(HP.store.addWater(250));
  assert.ok(HP.store.addWater(500));
  assert.strictEqual(HP.store.todayTotal(), 750);
  assert.strictEqual(HP.store.undoLast().ml, 500);
  assert.strictEqual(HP.store.todayTotal(), 250);
  HP.store.undoLast();
  assert.strictEqual(HP.store.undoLast(), null);
});
test('history : 7 jours, le plus ancien d’abord, répartition par jour', () => {
  HP.store.reset();
  const now = new Date(2026, 9, 1, 15, 0).getTime();
  HP.store.addWater(300, now);
  HP.store.addWater(200, now - 86400000);
  HP.store.addWater(400, now - 3 * 86400000);
  const h = HP.store.history(7, now);
  assert.strictEqual(h.length, 7);
  assert.strictEqual(h[6].ml, 300);
  assert.strictEqual(h[5].ml, 200);
  assert.strictEqual(h[3].ml, 400);
  assert.strictEqual(h[0].ml, 0);
});
test('moodFor : soif / ok / content / objectif', () => {
  const at = (h) => new Date(2026, 9, 1, h, 0).getTime();
  assert.strictEqual(HP.store.moodFor(0, 2000, at(15)), 'thirsty');
  assert.strictEqual(HP.store.moodFor(0, 2000, at(7)), 'ok');
  assert.strictEqual(HP.store.moodFor(1500, 2000, at(12)), 'happy');
  assert.strictEqual(HP.store.moodFor(2000, 2000, at(9)), 'done');
});
test('persistance : save puis load', () => {
  HP.store.reset();
  const st = HP.store.get();
  st.profile = { weight: 60, height: 165, activity: 'normal', goalMl: 2000 };
  st.pet.name = 'Mochi';
  HP.store.addWater(250);
  const back = HP.store.load();
  assert.strictEqual(back.pet.name, 'Mochi');
  assert.strictEqual(back.logs.length, 1);
  ctx.localStorage.setItem('hydrapet.v1', '{pas du json');
  assert.doesNotThrow(() => HP.store.load());
});

/* ---------- poses ---------- */
test('au moins 100 poses (objectif du cahier des charges) : 180', () => {
  assert.ok(HP.poses.count() >= 100);
  assert.strictEqual(HP.poses.count(), 180);
  assert.strictEqual(HP.poses.BASES.length * HP.poses.VARIANTS.length, 180);
});
test('toutes les poses sont réellement distinctes', () => {
  const seen = new Set(HP.poses.names.map((n) => JSON.stringify(HP.poses.get(n))));
  assert.strictEqual(seen.size, HP.poses.count());
});
test('poses : paramètres numériques valides et pose inconnue → erreur', () => {
  HP.poses.names.forEach((n) => {
    const p = HP.poses.get(n);
    HP.poses.NUMERIC.forEach((k) => assert.ok(Number.isFinite(p[k]), `${n}.${k}`));
    assert.ok(['open', 'wide', 'closed', 'happy', 'sleepy', 'sad', 'wink'].includes(p.eyes), `${n} eyes`);
    assert.ok(['smile', 'closed', 'open', 'tongue', 'sad', 'yawn'].includes(p.mouth), `${n} mouth`);
  });
  assert.throws(() => HP.poses.get('nimporte-quoi'));
});
test('cycles de marche et de course disponibles dans toutes les humeurs', () => {
  [...HP.poses.WALK, ...HP.poses.RUN].forEach((b) => HP.poses.VARIANTS.forEach((v) => HP.poses.get(b + '-' + v)));
});

/* ---------- couleurs ---------- */
function image(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h);
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}
test('extractPetColors : animal brun sur fond blanc → pelage brun', () => {
  const img = image(64, 64, (nx, ny) => {
    const d = Math.hypot(nx - 0.5, ny - 0.5);
    return d < 0.32 ? [150, 100, 55] : [250, 250, 250];
  });
  const c = HP.colors.extractPetColors(img);
  const [h, s] = HP.colors.rgbToHsl(...HP.colors.fromHex(c.fur));
  assert.ok(h > 15 && h < 45 && s > 0.3, `pelage ${c.fur} h=${h.toFixed(0)} s=${s.toFixed(2)}`);
  ['fur', 'fur2', 'muzzle', 'eye', 'nose'].forEach((k) => assert.match(c[k], /^#[0-9a-f]{6}$/));
});
test('extractPetColors : animal noir → pelage sombre', () => {
  const img = image(64, 64, (nx, ny) => (Math.hypot(nx - 0.5, ny - 0.5) < 0.3 ? [25, 25, 28] : [235, 235, 235]));
  const c = HP.colors.extractPetColors(img);
  const l = HP.colors.rgbToHsl(...HP.colors.fromHex(c.fur))[2];
  assert.ok(l < 0.3, `luminosité ${l.toFixed(2)}`);
});
test('extractRoomPalette : mur clair en haut, sol brun en bas', () => {
  const img = image(64, 96, (nx, ny) => (ny < 0.62 ? [225, 215, 190] : [140, 95, 60]));
  const p = HP.colors.extractRoomPalette(img);
  const wl = HP.colors.rgbToHsl(...HP.colors.fromHex(p.wall))[2];
  const fl = HP.colors.rgbToHsl(...HP.colors.fromHex(p.floor))[2];
  assert.ok(wl > 0.7, `mur ${p.wall} l=${wl.toFixed(2)}`);
  assert.ok(wl > fl, 'le mur est plus clair que le sol');
  ['wall', 'wall2', 'floor', 'floor2', 'accent', 'rug'].forEach((k) => assert.match(p[k], /^#[0-9a-f]{6}$/));
});
test('extractRoomPalette : mur et sol identiques → le sol est tout de même distinct', () => {
  const img = image(32, 32, () => [200, 190, 180]);
  const p = HP.colors.extractRoomPalette(img);
  assert.notStrictEqual(p.wall, p.floor);
});
test('images vides ou transparentes → null, sans exception', () => {
  const empty = { data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 };
  assert.strictEqual(HP.colors.extractPetColors(empty), null);
  assert.strictEqual(HP.colors.extractRoomPalette(empty), null);
});
test('shade / hex : aller-retour stable', () => {
  assert.strictEqual(HP.colors.toHex(HP.colors.fromHex('#12ab9f')), '#12ab9f');
  assert.ok(HP.colors.rgbToHsl(...HP.colors.fromHex(HP.colors.shade('#808080', 0.2)))[2] > 0.5);
});

/* ---------- animations Lottie ---------- */
const lottieDir = path.join(__dirname, '..', 'assets', 'lottie');
const lottieFiles = fs.readdirSync(lottieDir).filter((f) => f.endsWith('.json'));
test('Lottie : au moins confetti et water, et lottie-data.js à jour', () => {
  assert.ok(lottieFiles.includes('confetti.json') && lottieFiles.includes('water.json'));
  const bundle = fs.readFileSync(path.join(lottieDir, 'lottie-data.js'), 'utf8');
  lottieFiles.forEach((f) => assert.ok(bundle.includes('"' + path.basename(f, '.json') + '":'), f + ' absent de lottie-data.js (lancer node scripts/build-lottie-assets.js)'));
});
lottieFiles.forEach((f) => {
  test('Lottie ' + f + ' : structure valide et poids raisonnable', () => {
    const file = path.join(lottieDir, f);
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(j.fr > 0 && j.op > j.ip && j.w > 0 && j.h > 0, 'dimensions / durée');
    assert.ok(Array.isArray(j.layers) && j.layers.length > 0, 'calques');
    j.layers.forEach((l) => {
      assert.ok(l.ks && l.ks.p && l.ks.o, 'transformations du calque ' + l.nm);
      assert.ok(l.ip >= j.ip && l.op <= j.op + 1, 'durée du calque ' + l.nm);
      Object.values(l.ks).forEach((prop) => {
        if (prop.a === 1) {
          let last = -1;
          prop.k.forEach((kf) => { assert.ok(kf.t >= last, 'images clés ordonnées (' + l.nm + ')'); last = kf.t; });
        }
      });
    });
    assert.ok(fs.statSync(file).size < 100 * 1024, 'budget : moins de 100 Ko par animation');
    assert.ok(j.op / j.fr <= 6, 'durée de 6 s maximum');
  });
});

console.log(`\n${passed} tests réussis` + (process.exitCode ? ' — des échecs ci-dessus' : ''));
