/* Génère les effets Lottie d'origine de HydraPet (aucune licence tierce) dans assets/lottie/.
   Usage : node scripts/make-lottie.js
   Pour remplacer un effet par une animation de designer (Jitter, LottieFiles…) : déposez
   le fichier .json avec le même nom dans assets/lottie/, puis lancez node scripts/build-lottie-assets.js */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'lottie');
fs.mkdirSync(OUT, { recursive: true });

let seed = 20261001;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const between = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rgba = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const round = (v) => Math.round(v * 100) / 100;

const still = (k) => ({ a: 0, k });
const EASE = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const EASE_OUT = { i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0.2] } };
const EASE_IN = { i: { x: [0.7], y: [0.8] }, o: { x: [0.8], y: [0] } };
/** frames : [[t, valeur, easing?], …] ; le dernier n'a pas d'easing. */
const anim = (frames) => ({
  a: 1,
  k: frames.map(([t, s, e], idx) => (idx === frames.length - 1 ? { t, s } : Object.assign({ t, s }, e || EASE))),
});

function layer(ind, name, ip, op, ks, shapes) {
  return { ddd: 0, ind, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip, op, st: 0, bm: 0 };
}
const fill = (hex) => ({ ty: 'fl', c: still(rgba(hex)), o: still(100), r: 1, nm: 'Fill' });
const stroke = (hex, w) => ({ ty: 'st', c: still(rgba(hex)), o: still(100), w: still(w), lc: 2, lj: 2, nm: 'Stroke' });
const tr = () => ({ ty: 'tr', p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) });
const group = (items) => ({ ty: 'gr', it: [...items, tr()], nm: 'Group' });
const rect = (w, h, r) => ({ ty: 'rc', d: 1, s: still([w, h]), p: still([0, 0]), r: still(r || 0), nm: 'Rect' });
const ellipse = (w, h) => ({ ty: 'el', d: 1, s: still([w, h]), p: still([0, 0]), nm: 'Ellipse' });
const comp = (name, w, h, fr, op, layers) => ({ v: '5.7.0', fr, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers, markers: [] });

/* ---------- confettis : deux canons de chaque côté, retombée avec gravité ---------- */
function confetti() {
  const W = 360, H = 640, FR = 30, OP = 96;
  const colors = ['#ff6b8a', '#ffd54a', '#5ec4ff', '#7ed6a5', '#b79cff', '#ff9e80'];
  const layers = [];
  for (let i = 0; i < 44; i++) {
    const left = i % 2 === 0;
    const x0 = left ? 36 : W - 36, y0 = 470;
    const dx = (left ? 1 : -1) * between(40, 210);
    const peak = between(190, 400);
    const start = Math.floor(between(0, 10));
    const t1 = start + Math.floor(between(18, 26));
    const t2 = Math.min(OP - 1, t1 + Math.floor(between(34, 52)));
    const x1 = x0 + dx * 0.6, x2 = x0 + dx + between(-20, 20);
    const shape = rnd() < 0.7 ? rect(between(6, 9), between(9, 14), 1.5) : ellipse(between(6, 8), between(6, 8));
    const ks = {
      o: anim([[start, [0]], [start + 1, [100], EASE], [t2 - 8, [100], EASE], [t2, [0]]]),
      r: anim([[start, [0]], [t2, [between(-540, 540)]]]),
      p: anim([[start, [x0, y0, 0], EASE_OUT], [t1, [round(x1), round(y0 - peak), 0], EASE_IN], [t2, [round(x2), round(y0 + between(60, 160)), 0]]]),
      a: still([0, 0, 0]),
      s: anim([[start, [100, 100, 100]], [t1, [100, 100, 100]], [t2, [100, between(20, 100), 100]]]),
    };
    layers.push(layer(i + 1, 'confetti ' + (i + 1), 0, OP, ks, [group([shape, fill(pick(colors))])]));
  }
  return comp('HydraPet confettis', W, H, FR, OP, layers);
}

/* ---------- éclaboussure : une goutte tombe, deux ondes, des gouttelettes ---------- */
function water() {
  const W = 200, H = 200, FR = 30, OP = 54;
  const layers = [];
  let ind = 1;
  layers.push(layer(ind++, 'goutte', 0, 16, {
    o: anim([[0, [100]], [13, [100]], [14, [0]]]),
    r: still(0),
    p: anim([[0, [100, 10, 0], EASE_IN], [13, [100, 112, 0]]]),
    a: still([0, 0, 0]),
    s: anim([[0, [70, 70, 100]], [9, [100, 120, 100]], [13, [100, 100, 100]]]),
  }, [group([ellipse(16, 22), fill('#5ec4ff')])]));
  [[13, '#5ec4ff', 4.5], [19, '#9bdcff', 3]].forEach(([t0, hex, w], k) => {
    layers.push(layer(ind++, 'onde ' + (k + 1), t0, OP, {
      o: anim([[t0, [0]], [t0 + 1, [90], EASE], [OP - 1, [0]]]),
      r: still(0),
      p: still([100, 116, 0]),
      a: still([0, 0, 0]),
      s: anim([[t0, [10, 10, 100]], [OP - 1, [170, 170, 100]]]),
    }, [group([ellipse(60, 22), stroke(hex, w)])]));
  });
  for (let i = 0; i < 7; i++) {
    const dir = (i - 3) / 3;
    const t0 = 13, t1 = 24, t2 = 38 + Math.floor(between(0, 6));
    layers.push(layer(ind++, 'gouttelette ' + (i + 1), t0, OP, {
      o: anim([[t0, [0]], [t0 + 1, [100], EASE], [t2 - 4, [100], EASE], [t2, [0]]]),
      r: still(0),
      p: anim([[t0, [100, 114, 0], EASE_OUT], [t1, [round(100 + dir * between(36, 64)), round(between(46, 78)), 0], EASE_IN], [t2, [round(100 + dir * between(60, 92)), 124, 0]]]),
      a: still([0, 0, 0]),
      s: anim([[t0, [100, 100, 100]], [t2, [50, 50, 100]]]),
    }, [group([ellipse(between(5, 8), between(5, 8)), fill(pick(['#5ec4ff', '#9bdcff', '#ffffff']))])]));
  }
  return comp('HydraPet éclaboussure', W, H, FR, OP, layers);
}

const files = { confetti: confetti(), water: water() };
Object.keys(files).forEach((name) => {
  const file = path.join(OUT, name + '.json');
  fs.writeFileSync(file, JSON.stringify(files[name]));
  console.log(name + '.json', (fs.statSync(file).size / 1024).toFixed(1) + ' Ko');
});
require('./build-lottie-assets.js');
