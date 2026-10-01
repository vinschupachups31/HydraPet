/* HydraPet — bibliothèque de poses.
   Une pose = quelques paramètres de « squelette » (inclinaison du corps, angle de la tête,
   des oreilles, de la queue, des 4 pattes, état des yeux et de la bouche, effet).
   36 poses de base × 5 humeurs = 180 poses distinctes, interpolées en douceur à l'écran.

   Convention des angles de pattes : 0 = vers le bas ; négatif = le pied part vers l'avant,
   positif = vers l'arrière (l'animal regarde vers la droite). */
(function (root) {
  const HP = (root.HP = root.HP || {});

  const DEF = {
    dy: 0, lean: 0, sx: 1, sy: 1,
    head: 0, hdx: 0, hdy: 0,
    ear: 0, ear2: 0, tail: 0,
    fl: 0, fr: 0, bl: 0, br: 0,
    eyes: 'open', mouth: 'smile', fx: 'none',
  };
  const NUMERIC = ['dy', 'lean', 'sx', 'sy', 'head', 'hdx', 'hdy', 'ear', 'ear2', 'tail', 'fl', 'fr', 'bl', 'br'];

  const BASES = {
    // — debout —
    stand: {},
    alert: { head: -8, hdy: -4, ear: -10, ear2: -10, tail: -10, eyes: 'wide', mouth: 'closed' },
    sniff: { head: 28, hdy: 6, hdx: 6, ear: 10, ear2: 10, tail: 8, lean: 4, mouth: 'closed' },
    lookup: { head: -26, hdy: -2, ear: -14, ear2: -14, tail: 10, eyes: 'wide' },
    // — marche (4 phases) —
    walkA: { fl: -22, fr: 18, bl: 20, br: -18, dy: -1, head: 2, tail: 6 },
    walkB: { fl: -8, fr: 6, bl: 8, br: -6, dy: -3, head: 4, tail: 10 },
    walkC: { fl: 18, fr: -22, bl: -18, br: 20, dy: -1, head: 2, tail: 6 },
    walkD: { fl: 6, fr: -8, bl: -6, br: 8, dy: -3, head: 4, tail: 10 },
    // — course (4 phases) —
    runA: { fl: -50, fr: -44, bl: 52, br: 46, dy: -6, lean: -6, sx: 1.08, sy: 0.95, head: 8, ear: -30, ear2: -30, tail: -20, mouth: 'tongue' },
    runB: { fl: -14, fr: -10, bl: -26, br: -20, dy: -12, lean: 4, sx: 0.94, sy: 1.04, head: 2, ear: -34, ear2: -34, tail: -26, mouth: 'tongue' },
    runC: { fl: -44, fr: -50, bl: 46, br: 52, dy: -4, lean: 6, sx: 1.08, sy: 0.95, head: -4, ear: -30, ear2: -30, tail: -20, mouth: 'tongue' },
    runD: { fl: 18, fr: 24, bl: -6, br: 0, dy: -8, lean: -4, sx: 0.95, sy: 1.04, head: 6, ear: -34, ear2: -34, tail: -26, mouth: 'tongue' },
    // — assis / couché —
    sit: { dy: 14, lean: -24, bl: -85, br: -75, fl: 2, fr: -2, head: 20, tail: 25 },
    beg: { dy: 20, lean: -48, bl: -85, br: -75, fl: -70, fr: -60, head: 42, tail: 30, mouth: 'tongue', eyes: 'wide' },
    lie: { dy: 26, sy: 0.92, fl: -72, fr: -66, bl: -60, br: -55, head: -4, tail: 14 },
    flop: { dy: 30, lean: -8, sx: 1.06, sy: 0.78, fl: -60, fr: -40, bl: -50, br: -30, head: 2, tail: 12, eyes: 'happy', mouth: 'tongue' },
    sleep: { dy: 30, sx: 1.04, sy: 0.82, fl: -76, fr: -70, bl: -62, br: -58, head: 34, hdx: -6, hdy: 12, ear: 14, ear2: 14, tail: 30, eyes: 'closed', mouth: 'closed', fx: 'zzz' },
    loaf: { dy: 28, sy: 0.88, fl: -80, fr: -76, bl: -66, br: -62, head: -2, tail: 20, eyes: 'sleepy', mouth: 'closed' },
    // — étirements, gestes —
    playbow: { lean: 14, dy: 2, fl: -35, fr: -30, bl: 6, br: 0, head: -14, tail: -35, mouth: 'open', eyes: 'happy' },
    stretch: { lean: 10, dy: 2, sx: 1.12, sy: 0.95, fl: -40, fr: -34, bl: 10, br: 6, head: 14, hdy: 8, tail: -30, eyes: 'closed', mouth: 'yawn' },
    yawn: { head: -20, hdy: -2, eyes: 'closed', mouth: 'yawn', tail: 8 },
    scratch: { dy: 14, lean: -24, bl: -125, br: -75, fl: 2, fr: -2, head: 24, tail: 30, eyes: 'closed' },
    shake: { sx: 1.12, sy: 0.9, lean: 6, head: 20, ear: 50, ear2: -40, eyes: 'closed', mouth: 'open' },
    // — sauts —
    jumpUp: { dy: -18, lean: -16, fl: -60, fr: -50, bl: 30, br: 36, head: 10, tail: 20, eyes: 'wide', mouth: 'open' },
    jumpPeak: { dy: -30, lean: -4, fl: -70, fr: -62, bl: 60, br: 70, tail: 12, mouth: 'open', eyes: 'happy', head: -10 },
    land: { dy: 6, sx: 1.14, sy: 0.86, fl: -14, fr: -8, bl: 12, br: 16, ear: -30, ear2: -30 },
    pounce: { dy: 8, lean: 10, sy: 0.92, fl: -50, fr: -44, bl: 30, br: 36, head: -10, eyes: 'wide', mouth: 'closed', tail: -20 },
    prance: { dy: -6, fl: -48, fr: 10, bl: 18, br: -8, head: -8, tail: -24, eyes: 'happy', mouth: 'tongue' },
    // — humeurs —
    drink: { lean: 10, head: 50, hdy: 14, hdx: 8, fl: -18, fr: -12, bl: 6, br: 2, mouth: 'open', eyes: 'closed' },
    sitSad: { dy: 14, lean: -24, bl: -85, br: -75, fl: 2, fr: -2, head: 40, hdy: 6, ear: 22, ear2: 22, tail: 40, eyes: 'sad', mouth: 'sad', fx: 'drop' },
    standSad: { head: 26, hdy: 8, hdx: 2, ear: 26, ear2: 26, tail: 40, sy: 0.97, eyes: 'sad', mouth: 'sad', fx: 'drop' },
    bounce: { dy: -10, sx: 0.94, sy: 1.08, head: -4, tail: -40, eyes: 'happy', mouth: 'tongue' },
    nuzzle: { head: 22, hdy: 6, hdx: 3, lean: 4, eyes: 'closed', mouth: 'smile', tail: -24, fx: 'heart', ear: 12, ear2: 12 },
    // — jouet —
    carry: { head: -6, fx: 'carry', mouth: 'closed', tail: -12 },
    pickup: { head: 48, hdy: 12, hdx: 10, lean: 8, fl: -14, fr: -8, mouth: 'open', eyes: 'wide' },
    excited: { dy: -4, sx: 0.98, sy: 1.04, head: -6, tail: -44, ear: -20, ear2: -20, eyes: 'wide', mouth: 'tongue', fx: 'sparkle', bl: 8, br: -8 },
  };

  const VARIANTS = {
    neutral: (p) => p,
    wag: (p) => Object.assign(p, { tail: p.tail + 24 }),
    tilt: (p) => Object.assign(p, { head: p.head - 14, ear2: p.ear2 + 10 }),
    happy: (p) => Object.assign(p, { eyes: 'happy', mouth: 'tongue', tail: p.tail + 10 }),
    sad: (p) => Object.assign(p, { eyes: 'sad', mouth: 'sad', ear: p.ear + 16, ear2: p.ear2 + 16, tail: p.tail + 30 }),
  };

  const table = {};
  const names = [];
  Object.keys(BASES).forEach((b) => {
    Object.keys(VARIANTS).forEach((v) => {
      const name = b + '-' + v;
      table[name] = VARIANTS[v](Object.assign({}, DEF, BASES[b]));
      names.push(name);
    });
  });

  function get(name) {
    const p = table[name];
    if (!p) throw new Error('pose inconnue : ' + name);
    return p;
  }

  /** Humeur du moment → variante à utiliser par défaut. */
  function variantForMood(mood) {
    if (mood === 'thirsty') return 'sad';
    if (mood === 'happy' || mood === 'done') return 'happy';
    return 'neutral';
  }

  HP.poses = {
    DEF,
    NUMERIC,
    BASES: Object.keys(BASES),
    VARIANTS: Object.keys(VARIANTS),
    names,
    get,
    variantForMood,
    count: () => names.length,
    WALK: ['walkA', 'walkB', 'walkC', 'walkD'],
    RUN: ['runA', 'runB', 'runC', 'runD'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
