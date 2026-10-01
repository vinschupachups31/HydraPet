/* HydraPet — le monde : la pièce, l'animal qui vit sa vie, le jouet, les caresses. */
(function (root) {
  const HP = (root.HP = root.HP || {});
  const NS = 'http://www.w3.org/2000/svg';
  const L = HP.room.LAYOUT;
  const PET_SCALE = 0.92;
  const HEART = 'M0 -6 C-6 -14 -16 -6 -8 2 L0 10 L8 2 C16 -6 6 -14 0 -6Z';
  const CONFETTI = ['#ff6b8a', '#ffd54a', '#5ec4ff', '#7ed6a5', '#b79cff', '#ff9e80'];

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }

  function create(svg, opts) {
    const state = {
      mood: 'ok',
      toyType: 'ball',
      petting: false,
      pettingUntil: 0,
      pointerDown: false,
      lastBehavior: '',
      time: 0,
      queue: [],
      particles: [],
      used: new Set(), // noms de poses affichées (pour les tests / la démo)
      bowlLevel: 1,
    };

    svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    svg.innerHTML = '';
    const roomG = el('g', { class: 'room' }, svg);
    const petLayer = el('g', { class: 'pet-layer' }, svg);
    const toyLayer = el('g', { class: 'toy-layer' }, svg);
    const fxLayer = el('g', { class: 'fx-layer', 'pointer-events': 'none' }, svg);

    const pet = {
      x: 150, y: 520, z: 0, facing: 1, carrying: false, onSofa: false,
      cur: Object.assign({}, HP.poses.get('stand-neutral')),
      target: HP.poses.get('stand-neutral'),
      rig: null, root: null,
    };
    const toy = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, state: 'none', landed: true, g: null, flight: null };

    /* ---------- construction ---------- */
    function buildRoom(palette) {
      roomG.innerHTML = HP.room.build(Object.assign({}, HP.store.DEFAULT_ROOM, palette));
      state.waterEl = roomG.querySelector('#bowl-water');
      setBowl(state.bowlLevel);
    }

    function buildPet(species, colors) {
      petLayer.innerHTML = '';
      pet.rig = HP.pet.create(species, colors);
      petLayer.appendChild(pet.rig.root);
      pet.rig.setCarry(state.toyType);
    }

    function buildToy() {
      toyLayer.innerHTML = '';
      toy.g = el('g', { display: 'none' }, toyLayer);
      toy.shadow = el('ellipse', { rx: 8, ry: 2.6, fill: 'rgba(40,50,80,.2)' }, toyLayer);
      toy.shadow.setAttribute('display', 'none');
      toy.body = el('g', {}, toy.g);
      toy.body.innerHTML = HP.pet.toySvg(state.toyType);
    }

    function setBowl(level) {
      state.bowlLevel = level;
      if (!state.waterEl) return;
      const l = clamp(level, 0.12, 1);
      state.waterEl.setAttribute('rx', (20 * (0.55 + 0.45 * l)).toFixed(1));
      state.waterEl.setAttribute('ry', (5.5 * l).toFixed(1));
      state.waterEl.setAttribute('opacity', level < 0.2 ? '0.35' : '1');
    }

    /* ---------- poses ---------- */
    function poseName(spec) {
      const [base, variant] = spec.split(':');
      return base + '-' + (variant || HP.poses.variantForMood(state.mood));
    }
    function setPose(spec) {
      const name = poseName(spec);
      pet.target = HP.poses.get(name);
      state.used.add(name);
    }

    function updatePose(dt) {
      const k = 1 - Math.exp(-dt * 14);
      const c = pet.cur, t = pet.target;
      HP.poses.NUMERIC.forEach((key) => { c[key] += (t[key] - c[key]) * k; });
      c.eyes = t.eyes;
      c.mouth = t.mouth;
      c.fx = pet.carrying && (t.fx === 'none' || t.fx === 'zzz') ? 'carry' : t.fx;
      pet.rig.apply(c);
      const s = HP.room.scaleAt(pet.y) * PET_SCALE;
      pet.rig.root.setAttribute('transform', `translate(${pet.x.toFixed(1)} ${(pet.y - pet.z).toFixed(1)}) scale(${(s * pet.facing).toFixed(3)} ${s.toFixed(3)})`);
    }

    /* ---------- actions ---------- */
    const A = {
      walk: (x, y, gait) => ({ t: 'walk', x, y, gait: gait || 'walk', dist: 0 }),
      hold: (poses, dur, every) => ({ t: 'hold', poses: [].concat(poses), dur, every: every || 0.5, el: 0, i: 0, started: false }),
      jump: (x, y) => ({ t: 'jump', x, y, u: 0, from: null }),
      call: (fn) => ({ t: 'call', fn }),
      wait: (cond, max) => ({ t: 'wait', cond, max: max || 6, el: 0 }),
      face: (dir) => ({ t: 'call', fn: () => { pet.facing = dir; } }),
      fall: () => ({ t: 'fall', v: 0 }),
    };

    function floorPoint() {
      return { x: rand(36, L.width - 36), y: rand(L.floorMin + 4, L.floorMax) };
    }

    function stepWalk(a, dt) {
      const speed = a.gait === 'run' ? 175 : 62;
      const stride = a.gait === 'run' ? 46 : 26;
      const dx = a.x - pet.x, dy = a.y - pet.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) { pet.x = a.x; pet.y = a.y; return true; }
      const step = Math.min(d, speed * dt);
      pet.x += (dx / d) * step;
      pet.y += (dy / d) * step;
      if (Math.abs(dx) > 2) pet.facing = dx > 0 ? 1 : -1;
      a.dist += step;
      const phase = Math.floor(a.dist / stride) % 4;
      setPose((a.gait === 'run' ? HP.poses.RUN : HP.poses.WALK)[phase]);
      return false;
    }

    function stepHold(a, dt) {
      a.el += dt;
      const idx = Math.floor(a.el / a.every) % a.poses.length;
      if (!a.started || idx !== a.i) { a.started = true; a.i = idx; setPose(a.poses[idx]); }
      return a.el >= a.dur;
    }

    function stepJump(a, dt) {
      if (!a.from) {
        a.from = { x: pet.x, y: pet.y };
        a.D = 0.7 + Math.hypot(a.x - pet.x, a.y - pet.y) / 700;
        a.h = a.y < a.from.y - 8 ? 72 : a.y > a.from.y + 8 ? 40 : 56;
        if (Math.abs(a.x - pet.x) > 2) pet.facing = a.x > pet.x ? 1 : -1;
      }
      a.u = Math.min(1, a.u + dt / a.D);
      const u = a.u;
      pet.x = a.from.x + (a.x - a.from.x) * u;
      pet.y = a.from.y + (a.y - a.from.y) * u;
      pet.z = 4 * a.h * u * (1 - u);
      setPose(u < 0.28 ? 'jumpUp' : u < 0.78 ? 'jumpPeak' : 'land');
      if (u >= 1) {
        pet.z = 0;
        pet.onSofa = a.y < L.floorMin - 6;
        return true;
      }
      return false;
    }

    function stepFall(a, dt) {
      a.v += 1700 * dt;
      pet.z = Math.max(0, pet.z - a.v * dt);
      setPose('jumpPeak');
      if (pet.z > 0) return false;
      burst('dust', pet.x, pet.y - 4, 10);
      return true;
    }

    function runQueue(dt) {
      const a = state.queue[0];
      if (!a) return false;
      let done = false;
      if (a.t === 'walk') done = stepWalk(a, dt);
      else if (a.t === 'hold') done = stepHold(a, dt);
      else if (a.t === 'jump') done = stepJump(a, dt);
      else if (a.t === 'fall') done = stepFall(a, dt);
      else if (a.t === 'call') { a.fn(); done = true; }
      else if (a.t === 'wait') { a.el += dt; setPose('alert'); done = a.cond() || a.el > a.max; }
      if (done) state.queue.shift();
      return true;
    }

    function enqueue(list) { state.queue.push(...list); }
    function interrupt(list) {
      state.queue = [];
      if (pet.onSofa) state.queue.push(A.jump(clamp(pet.x, 36, L.width - 36), L.floorMin + 18));
      if (pet.z > 0) pet.z = 0;
      enqueue(list || []);
    }

    /* ---------- comportements (≥ 12) ---------- */
    const B = {
      wander() {
        const p = floorPoint();
        return [A.walk(p.x, p.y), A.hold(pick([['alert'], ['sniff'], ['lookup', 'alert'], ['stand', 'stand:wag']]), rand(1, 2.4), 0.6)];
      },
      run() {
        const p = floorPoint();
        return [A.walk(p.x, p.y, 'run'), A.hold(['playbow', 'playbow:wag'], 1.6, 0.4)];
      },
      sit() { return [A.hold(['sit', 'sit:wag', 'sit:tilt', 'sit'], rand(2.2, 4.2), 1.1)]; },
      nap() {
        return [
          A.hold(['lie'], 1.1), A.hold(['loaf'], 1), A.hold(['sleep', 'sleep:wag'], rand(4, 7), 2.2),
          A.hold(['stretch'], 1.5), A.hold(['yawn'], 1.1),
        ];
      },
      stretch() { return [A.hold(['stretch'], 1.7), A.hold(['yawn'], 1.2), A.hold(['shake'], 0.9, 0.18)]; },
      scratch() { return [A.hold(['scratch', 'scratch:tilt'], 2.4, 0.22), A.hold(['shake'], 0.8, 0.16)]; },
      sniff() {
        const p = floorPoint();
        return [A.walk(p.x, p.y), A.hold(['sniff', 'sniff:tilt', 'pounce'], 2.6, 0.9)];
      },
      play() {
        const p = floorPoint();
        return [A.hold(['playbow', 'playbow:wag'], 1.2, 0.3), A.walk(p.x, p.y, 'run'), A.hold(['bounce', 'prance'], 1.6, 0.4)];
      },
      sofa() {
        const sx = L.sofa.x + L.sofa.w * 0.5 + rand(-26, 26);
        return [
          A.walk(sx, L.floorMin + 14), A.jump(sx, L.sofa.seatY),
          A.hold(pick([['sit', 'sit:wag'], ['lie', 'loaf'], ['sleep']]), rand(4, 8), 1.4),
          A.jump(sx + rand(-20, 20), L.floorMin + 20),
        ];
      },
      bowl() {
        return [
          A.walk(L.bowl.x + 46, L.bowl.y + 8), A.face(-1),
          A.hold(['drink', 'drink:tilt'], rand(3, 4.4), 0.55), A.hold(['yawn'], 0.5),
        ];
      },
      zoomies() {
        const p = floorPoint(), q = floorPoint();
        return [A.walk(p.x, p.y, 'run'), A.walk(q.x, q.y, 'run'), A.hold(['excited', 'prance'], 1.4, 0.35)];
      },
    };

    const WEIGHTS = {
      thirsty: { wander: 5, sit: 2, bowl: 3, nap: 0.5, sofa: 0.5, run: 0.3, scratch: 0.4, stretch: 0.6, play: 0.2, sniff: 2, zoomies: 0 },
      ok: { wander: 6, sit: 1.6, nap: 1, sofa: 1.8, run: 1.2, scratch: 0.9, stretch: 0.9, play: 1.2, bowl: 0.7, sniff: 2, zoomies: 0.4 },
      happy: { wander: 4, sit: 1, nap: 0.6, sofa: 2.2, run: 2.6, scratch: 0.5, stretch: 0.7, play: 3, bowl: 0.5, sniff: 1.2, zoomies: 1.6 },
    };

    function pickBehavior() {
      const table = WEIGHTS[state.mood === 'done' ? 'happy' : state.mood] || WEIGHTS.ok;
      const keys = Object.keys(table).filter((k) => table[k] > 0 && k !== state.lastBehavior);
      let total = keys.reduce((s, k) => s + table[k], 0), r = Math.random() * total, chosen = keys[0];
      for (const k of keys) { r -= table[k]; if (r <= 0) { chosen = k; break; } }
      state.lastBehavior = chosen;
      state.behaviorCount = (state.behaviorCount || 0) + 1;
      enqueue(B[chosen]());
      return chosen;
    }

    /* ---------- jouet ---------- */
    const toyScale = () => HP.room.scaleAt(toy.y) * 1.1;

    function drawToy() {
      if (toy.state === 'none' || toy.state === 'carried') {
        toy.g.setAttribute('display', 'none');
        toy.shadow.setAttribute('display', 'none');
        return;
      }
      const s = toyScale();
      toy.g.setAttribute('display', 'inline');
      toy.g.setAttribute('transform', `translate(${toy.x.toFixed(1)} ${(toy.y - 5 - toy.z).toFixed(1)}) scale(${s.toFixed(2)})`);
      toy.shadow.setAttribute('display', 'inline');
      toy.shadow.setAttribute('transform', `translate(${toy.x.toFixed(1)} ${toy.y.toFixed(1)}) scale(${(s * clamp(1 - toy.z / 160, 0.4, 1)).toFixed(2)})`);
    }

    function updateToy(dt) {
      if (toy.state === 'fly') {
        const f = toy.flight;
        f.t = Math.min(f.T, f.t + dt);
        const u = f.t / f.T;
        toy.x = f.sx + (f.tx - f.sx) * u;
        toy.y = f.sy + (f.ty - f.sy) * u;
        toy.z = f.z0 + f.vz * f.t - 0.5 * f.g * f.t * f.t;
        if (f.t >= f.T) {
          toy.state = 'bounce';
          toy.z = 0;
          toy.vz = 150;
          toy.vx = ((f.tx - f.sx) / f.T) * 0.22;
          toy.vy = ((f.ty - f.sy) / f.T) * 0.22;
        }
      } else if (toy.state === 'bounce') {
        toy.x = clamp(toy.x + toy.vx * dt, 14, L.width - 14);
        toy.y = clamp(toy.y + toy.vy * dt, L.floorMin - 6, L.floorMax);
        toy.vz -= 720 * dt;
        toy.z += toy.vz * dt;
        if (toy.z <= 0) {
          toy.z = 0;
          toy.vz *= -0.45;
          toy.vx *= 0.6;
          toy.vy *= 0.6;
          if (Math.abs(toy.vz) < 28) { toy.state = 'rest'; toy.landed = true; toy.vz = 0; }
        }
      }
      drawToy();
    }

    function throwToy(tx, ty) {
      const target = { x: clamp(tx, 24, L.width - 24), y: clamp(ty, L.floorMin + 2, L.floorMax) };
      const T = 0.85, g = 900, z0 = 46;
      toy.state = 'fly';
      toy.landed = false;
      toy.x = L.user.x; toy.y = L.user.y; toy.z = z0;
      toy.flight = { sx: toy.x, sy: toy.y, tx: target.x, ty: target.y, T, g, z0, vz: (0.5 * g * T * T - z0) / T, t: 0 };
      toy.target = target;
      state.fetching = true;
      pet.carrying = false;
      pet.rig.setCarry(state.toyType);
      const pickupWalk = A.walk(toy.x, toy.y, 'walk');
      interrupt([
        A.hold(['alert:happy'], 0.25),
        Object.assign(A.walk(toy.x, toy.y, 'run'), { chase: true }),
        A.wait(() => toy.landed, 3),
        A.call(() => { pickupWalk.x = toy.x; pickupWalk.y = toy.y; }),
        pickupWalk,
        A.hold(['pickup'], 0.55),
        A.call(() => { toy.state = 'carried'; pet.carrying = true; }),
        A.walk(L.user.x + rand(-26, 26), L.user.y - 12, 'walk'),
        A.call(() => {
          pet.carrying = false;
          toy.state = 'rest'; toy.landed = true;
          toy.x = pet.x + pet.facing * 34; toy.y = pet.y; toy.z = 0;
          state.fetching = false;
          burst('heart', pet.x, pet.y - 70, 4);
        }),
        A.hold(['excited', 'bounce:happy', 'excited:wag'], 1.8, 0.45),
      ]);
    }

    /* ---------- particules ---------- */
    function burst(type, x, y, n) {
      for (let i = 0; i < n; i++) {
        let node;
        if (type === 'heart') {
          node = el('path', { d: HEART, fill: pick(['#ff6b8a', '#ff8fab', '#ff5c7a']) }, fxLayer);
        } else if (type === 'dust') {
          node = el('circle', { r: rand(4, 8), fill: 'rgba(255,255,255,0.85)' }, fxLayer);
        } else if (type === 'drop') {
          node = el('circle', { r: rand(2, 4), fill: '#5ec4ff' }, fxLayer);
        } else {
          node = el('rect', { width: 6, height: 9, rx: 1.5, fill: pick(CONFETTI) }, fxLayer);
        }
        state.particles.push({
          node, type, x: x + rand(-14, 14), y: y + rand(-8, 8),
          vx: type === 'dust' ? rand(-90, 90) : rand(-40, 40) * (type === 'confetti' ? 2 : 1),
          vy: type === 'heart' ? rand(-70, -40) : type === 'drop' ? rand(-120, -60) : type === 'dust' ? rand(-30, -8) : rand(-220, -90),
          life: 0, max: type === 'heart' ? rand(0.9, 1.4) : type === 'dust' ? rand(0.55, 0.9) : rand(1.1, 2),
          rot: rand(0, 360), vr: rand(-360, 360),
        });
      }
    }

    function updateParticles(dt) {
      state.particles = state.particles.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) { p.node.remove(); return false; }
        p.vy += (p.type === 'heart' || p.type === 'dust' ? 0 : 520) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const a = 1 - p.life / p.max;
        p.node.setAttribute('opacity', a.toFixed(2));
        p.node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${p.type === 'heart' ? 0.9 + (1 - a) * 0.4 : p.type === 'dust' ? 1 + (1 - a) * 1.4 : 1})`);
        return true;
      });
    }

    /* ---------- boucle ---------- */
    let raf = 0, last = 0, heartTimer = 0;

    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      state.time += dt;

      if (state.petting && state.time > state.pettingUntil) {
        state.petting = false;
        interrupt([A.hold(['bounce:happy', 'stand:wag'], 1.2, 0.5)]);
      }
      if (state.petting) {
        heartTimer -= dt;
        if (heartTimer <= 0) { heartTimer = 0.45; burst('heart', pet.x, pet.y - 82 * HP.room.scaleAt(pet.y), 1); }
      } else if (!runQueue(dt) && !state.fetching) {
        pickBehavior();
      }

      // le chasseur de jouet suit la position du jouet en vol
      const a = state.queue[0];
      if (a && a.chase) { a.x = toy.x; a.y = clamp(toy.y, L.floorMin, L.floorMax); }

      updateToy(dt);
      updatePose(dt);
      updateParticles(dt);
    }

    /* ---------- pointeur ---------- */
    function toSvg(ev) {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      const m = svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    function overPet(p) {
      const s = HP.room.scaleAt(pet.y) * PET_SCALE;
      const cx = pet.x, cy = pet.y - pet.z - 50 * s;
      const dx = (p.x - cx) / (66 * s), dy = (p.y - cy) / (62 * s);
      return dx * dx + dy * dy <= 1;
    }
    function startPetting(p) {
      if (!state.petting) {
        state.petting = true;
        pet.carrying = false;
        state.queue = [];
        state.fetching = false;
        if (toy.state === 'carried') { toy.state = 'rest'; toy.landed = true; toy.x = pet.x; toy.y = pet.y; }
        setPose(pick(['nuzzle', 'nuzzle:wag', 'bounce:happy']));
      }
      state.pettingUntil = state.time + 0.9;
      if (Math.abs(p.x - pet.x) > 10) pet.facing = p.x > pet.x ? 1 : -1;
    }
    svg.addEventListener('pointerdown', (ev) => {
      const p = toSvg(ev);
      state.pointerDown = true;
      if (overPet(p)) { startPetting(p); state.pettingTouch = true; }
      else { state.pettingTouch = false; throwToy(p.x, p.y); }
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!state.pointerDown || !state.pettingTouch) return;
      const p = toSvg(ev);
      if (overPet(p)) startPetting(p);
    });
    const release = () => { state.pointerDown = false; };
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('pointerleave', release);

    /* ---------- API ---------- */
    state.mood = opts.mood || 'ok';
    state.bowlLevel = state.mood === 'thirsty' ? 0.12 : 1;
    buildRoom(opts.room);
    buildPet(opts.species, opts.colors);
    buildToy();

    return {
      state, pet, toy,
      start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
      stop() { cancelAnimationFrame(raf); raf = 0; },
      setPet(species, colors) { buildPet(species, colors); },
      setRoom(palette) { buildRoom(palette); },
      setMood(m) {
        if (m === state.mood) return;
        state.mood = m;
        setBowl(m === 'thirsty' ? 0.12 : 1);
      },
      setToy(type) {
        state.toyType = type;
        toy.body.innerHTML = HP.pet.toySvg(type);
        pet.rig.setCarry(type);
      },
      throwToy,
      pet_(p) { startPetting(p || { x: pet.x, y: pet.y }); },
      onDrink() {
        setBowl(1);
        burst('drop', L.bowl.x, L.bowl.y - 6, 7);
        if (state.petting || state.fetching) return;
        interrupt([A.hold(['bounce:happy', 'excited'], 1.1, 0.4), ...B.bowl(), A.hold(['excited:wag'], 1.2, 0.4)]);
      },
      celebrate(opts) {
        if (!opts || opts.confetti !== false) for (let i = 0; i < 4; i++) burst('confetti', rand(60, 300), 120, 14);
        state.fetching = false;
        interrupt([
          A.hold(['excited', 'excited:wag'], 1.4, 0.35),
          A.jump(pet.x, pet.y), A.jump(pet.x, pet.y),
          ...B.zoomies(), A.hold(['bounce:happy', 'prance'], 2, 0.4),
        ]);
      },
      /** Arrivée de l'animal dans la pièce : il tombe du haut, atterrit en écrasement, puis fait la fête. */
      arrive() {
        pet.x = L.user.x - 20; pet.y = 520; pet.facing = 1;
        interrupt([A.fall(), A.hold(['land'], 0.3), A.hold(['excited', 'excited:wag', 'bounce:happy'], 2, 0.5)]);
        pet.z = 480;
      },
      poseCount: () => state.used.size,
    };
  }

  HP.world = { create };
})(typeof window !== 'undefined' ? window : globalThis);
