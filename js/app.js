/* HydraPet — écrans et navigation. */
(function () {
  const HP = window.HP;
  const S = HP.store;
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  let world = null;
  let hud = null;
  let toastTimer = 0;
  let bubbleTimer = 0;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const $ = (sel, root) => (root || app).querySelector(sel);

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2800);
  }

  function stopWorld() {
    if (world) { world.stop(); world = null; }
    hud = null;
  }

  /* ================= navigation ================= */
  let splashShown = false;
  function route() {
    stopWorld();
    if (location.hash === '#/poses') { splashShown = true; return showGallery(); }
    if (!splashShown) { splashShown = true; return showSplash(route); }
    const st = S.get();
    if (st.onboarded) return showHome();
    if (st.profile) return showPet(false);
    return showWelcome();
  }

  /* ================= démarrage et bienvenue ================= */
  function showSplash(next) {
    const st = S.get();
    app.innerHTML = `<div class="splash" role="img" aria-label="HydraPet">
  <div class="splash-pet" id="sp-pet"></div>
  <div class="splash-logo"><svg viewBox="0 0 64 64" width="42" height="42" aria-hidden="true"><path d="M32 6 C24 22 14 30 14 42 a18 18 0 0 0 36 0 C50 30 40 22 32 6Z" fill="#5ec4ff"/><ellipse cx="25" cy="40" rx="4" ry="7" fill="#fff" opacity=".55" transform="rotate(20 25 40)"/></svg><span>HydraPet</span></div>
</div>`;
    $('#sp-pet').appendChild(HP.pet.renderStatic(st.pet.species, st.pet, 'bounce-happy', 190, 176));
    let done = false;
    const go = () => { if (done) return; done = true; clearTimeout(timer); next(); };
    const timer = setTimeout(go, HP.fx.reducedMotion() ? 500 : 1500);
    app.querySelector('.splash').addEventListener('click', go);
  }

  function showWelcome() {
    const st = S.get();
    app.innerHTML = `<div class="screen welcome">
  <div class="welcome-art"><div id="w-pet"></div>
    <svg class="welcome-glass" viewBox="0 0 60 80" width="64" height="86" aria-hidden="true"><path d="M8 6 H52 L46 70 Q45 76 39 76 H21 Q15 76 14 70 Z" fill="#e8f6ff" stroke="#9bdcff" stroke-width="3"/><path d="M11 30 H49 L46 68 Q45 72 40 72 H20 Q15 72 14 68 Z" fill="#5ec4ff"/><ellipse cx="30" cy="30" rx="19" ry="4" fill="#9bdcff"/></svg></div>
  <h1>Bois un peu,<br />ton compagnon fait le reste.</h1>
  <ul class="welcome-list">
    <li style="--d:.25s"><span aria-hidden="true">💧</span>Note chaque verre en 1 tap</li>
    <li style="--d:.4s"><span aria-hidden="true">🐾</span>Ton animal vit chez toi</li>
    <li style="--d:.55s"><span aria-hidden="true">🔔</span>Un rappel quand il faut boire</li>
  </ul>
  <div class="actions"><button class="btn primary" id="go">C’est parti</button></div>
</div>`;
    $('#w-pet').appendChild(HP.pet.renderStatic(st.pet.species, st.pet, 'sit-happy', 210, 190));
    $('#go').addEventListener('click', () => showProfile(false));
  }

  function stepsBar(n) {
    return `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
  }

  /* ================= 1. profil ================= */
  function showProfile(edit) {
    stopWorld();
    const st = S.get();
    const p = st.profile || { weight: '', height: '', activity: 'normal' };
    let activity = p.activity || 'normal';
    let manualGoal = null;

    app.innerHTML = `
<div class="screen">
  ${edit ? '' : stepsBar(1)}
  <h1>${edit ? 'Mon profil' : 'Bienvenue sur HydraPet 💧'}</h1>
  <p class="lead">${edit ? 'Mets à jour tes infos : ton objectif est recalculé.' : 'Dis-nous qui tu es, on calcule combien tu dois boire chaque jour.'}</p>
  <div class="card">
    <div class="row">
      <label class="field">Poids (kg)<input id="w" type="number" inputmode="decimal" min="20" max="300" placeholder="70" value="${esc(p.weight)}" /></label>
      <label class="field">Taille (cm)<input id="h" type="number" inputmode="numeric" min="80" max="250" placeholder="170" value="${esc(p.height)}" /></label>
    </div>
    <div class="field">Activité
      <div class="seg" role="group" aria-label="Niveau d'activité">
        <button type="button" data-act="low" aria-pressed="${activity === 'low'}">Calme</button>
        <button type="button" data-act="normal" aria-pressed="${activity === 'normal'}">Normale</button>
        <button type="button" data-act="high" aria-pressed="${activity === 'high'}">Sportive</button>
      </div>
    </div>
    <div class="goal-box"><span>Ton besoin par jour</span><b id="goal">—</b></div>
    <label class="field">Ajuster l'objectif (ml)<input id="g" type="number" inputmode="numeric" min="1000" max="6000" step="50" placeholder="2400" /></label>
    <p class="note">Estimation indicative (≈ 33 ml par kg, ajustée selon ta taille et ton activité). Ce n'est pas un avis médical.</p>
  </div>
  <div class="actions">
    <button class="btn primary" id="next" disabled>${edit ? 'Enregistrer' : 'Continuer'}</button>
    ${edit ? '<button class="btn ghost" id="cancel">Annuler</button>' : ''}
  </div>
</div>`;

    const w = $('#w'), h = $('#h'), g = $('#g'), goalEl = $('#goal'), next = $('#next');
    function recompute(fromInputs) {
      const calc = S.calcGoal({ weight: w.value, height: h.value, activity });
      if (fromInputs) manualGoal = null;
      const goal = manualGoal || calc;
      goalEl.textContent = goal ? `${fmt(goal)} ml` : '—';
      if (fromInputs && calc) g.value = calc;
      next.disabled = !goal;
      return goal;
    }
    [w, h].forEach((i) => i.addEventListener('input', () => recompute(true)));
    g.addEventListener('input', () => {
      const v = Math.round(Number(g.value) / 50) * 50;
      manualGoal = v >= 1000 && v <= 6000 ? v : null;
      recompute(false);
    });
    app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      activity = b.dataset.act;
      app.querySelectorAll('[data-act]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      recompute(true);
    }));
    if (p.weight) {
      recompute(true);
      if (st.profile) { g.value = st.profile.goalMl; manualGoal = st.profile.goalMl; recompute(false); }
    }
    next.addEventListener('click', () => {
      const goal = recompute(false);
      if (!goal) return;
      st.profile = { weight: Number(w.value), height: Number(h.value), activity, goalMl: goal };
      S.save();
      if (edit) { showHome(); toast('Profil mis à jour ✅'); } else showPet(false);
    });
    const cancel = $('#cancel');
    if (cancel) cancel.addEventListener('click', showHome);
  }

  /* ================= 2. scan de l'animal ================= */
  function pickPhoto(onImage) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try { onImage(img, url); } catch (e) { toast('Photo illisible, essaie-en une autre.'); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Impossible de lire cette photo.'); };
      img.src = url;
    });
    input.click();
  }

  function showPet(edit) {
    stopWorld();
    const st = S.get();
    let photoUrl = null;
    const colorKeys = [['fur', 'Pelage'], ['fur2', 'Oreilles'], ['muzzle', 'Museau'], ['eye', 'Yeux']];

    app.innerHTML = `
<div class="screen">
  ${edit ? '' : stepsBar(2)}
  <h1>${edit ? 'Mon compagnon' : 'Ton compagnon'} 🐾</h1>
  <p class="lead">Choisis ton animal, puis scanne-le en photo : on en tire un cartoon aux mêmes couleurs.</p>
  <div class="species" role="group" aria-label="Espèce">
    <button type="button" data-sp="dog" aria-pressed="${st.pet.species === 'dog'}">🐶 Chien</button>
    <button type="button" data-sp="cat" aria-pressed="${st.pet.species === 'cat'}">🐱 Chat</button>
  </div>
  <div class="card">
    <label class="field">Son prénom<input id="name" type="text" maxlength="16" value="${esc(st.pet.name)}" /></label>
    <div class="scan-grid">
      <div class="scan-box" id="photo"><span>📷<br />Aucune photo</span></div>
      <div class="preview" id="preview" aria-label="Aperçu cartoon"></div>
    </div>
    <button class="btn primary" id="scan">📷 Scanner mon animal</button>
    <div class="swatches" id="sw"></div>
    <p class="note">Les photos restent sur ton appareil : elles ne sont jamais envoyées.</p>
  </div>
  <div class="actions">
    <button class="btn primary" id="next">${edit ? 'Enregistrer' : 'Continuer'}</button>
    ${edit ? '<button class="btn ghost" id="cancel">Annuler</button>' : ''}
  </div>
</div>`;

    const preview = $('#preview');
    function renderPreview() {
      preview.innerHTML = '';
      preview.appendChild(HP.pet.renderStatic(st.pet.species, st.pet, 'sit-happy', 200, 200));
    }
    function renderSwatches() {
      $('#sw').innerHTML = colorKeys.map(([k, label]) => `<label class="swatch"><input type="color" data-k="${k}" value="${st.pet[k]}" aria-label="Couleur : ${label}" />${label}</label>`).join('');
      app.querySelectorAll('[data-k]').forEach((i) => i.addEventListener('input', () => {
        st.pet[i.dataset.k] = i.value;
        if (i.dataset.k === 'fur') st.pet.nose = HP.colors.shade(i.value, -0.35);
        renderPreview();
      }));
    }
    renderPreview();
    renderSwatches();

    app.querySelectorAll('[data-sp]').forEach((b) => b.addEventListener('click', () => {
      st.pet.species = b.dataset.sp;
      app.querySelectorAll('[data-sp]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderPreview();
    }));
    $('#name').addEventListener('input', (e) => { st.pet.name = e.target.value.trim() || 'Pixel'; });

    $('#scan').addEventListener('click', () => pickPhoto((img, url) => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = url;
      const box = $('#photo');
      box.innerHTML = `<img alt="Photo de ton animal" src="${url}" /><div class="scan-line"></div>`;
      const found = HP.colors.extractPetColors(HP.colors.imageToData(img, 96));
      setTimeout(() => {
        if (!found) { toast('Je n’ai pas réussi à lire les couleurs. Essaie une photo plus lumineuse.'); return; }
        Object.assign(st.pet, found);
        renderPreview();
        renderSwatches();
        toast(`${st.pet.name} est scanné ✨ Ajuste les couleurs si besoin.`);
      }, 1100);
    }));

    $('#next').addEventListener('click', () => {
      S.save();
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (edit) { showHome(); toast('Compagnon mis à jour 🐾'); } else showRoom(false);
    });
    const cancel = $('#cancel');
    if (cancel) cancel.addEventListener('click', () => { S.load(); showHome(); });
  }

  /* ================= 3. scan de la pièce ================= */
  function roomPreviewSvg(room, pet) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 360 640');
    svg.innerHTML = HP.room.build(Object.assign({}, S.DEFAULT_ROOM, room));
    const rig = HP.pet.create(pet.species, pet);
    rig.apply(HP.poses.get('sit-happy'));
    rig.root.setAttribute('transform', 'translate(150 560) scale(0.95)');
    svg.appendChild(rig.root);
    return svg;
  }

  function showRoom(edit) {
    stopWorld();
    const st = S.get();
    let photoUrl = null;
    const keys = [['wall', 'Murs'], ['floor', 'Sol'], ['accent', 'Canapé'], ['rug', 'Tapis']];

    app.innerHTML = `
<div class="screen">
  ${edit ? '' : stepsBar(3)}
  <h1>${edit ? 'Ma pièce' : 'Sa pièce'} 🛋️</h1>
  <p class="lead">Scanne la pièce où ${esc(st.pet.name)} doit vivre : on en fait un décor cartoon aux mêmes couleurs.</p>
  <div class="card">
    <div class="scan-grid">
      <div class="scan-box" id="photo"><span>📷<br />Aucune photo</span></div>
      <div class="preview room-preview" id="preview" aria-label="Aperçu de la pièce"></div>
    </div>
    <button class="btn primary" id="scan">📷 Scanner ma pièce</button>
    <div class="swatches" id="sw"></div>
    <p class="note">Astuce : photographie la pièce en entier, de face, avec le mur du fond et le sol.</p>
  </div>
  <div class="actions">
    <button class="btn primary" id="next">${edit ? 'Enregistrer' : 'C’est parti !'}</button>
    ${edit ? '<button class="btn ghost" id="cancel">Annuler</button>' : ''}
  </div>
</div>`;

    const preview = $('#preview');
    function renderPreview() {
      preview.innerHTML = '';
      preview.appendChild(roomPreviewSvg(st.room, st.pet));
    }
    function renderSwatches() {
      $('#sw').innerHTML = keys.map(([k, label]) => `<label class="swatch"><input type="color" data-k="${k}" value="${st.room[k]}" aria-label="Couleur : ${label}" />${label}</label>`).join('');
      app.querySelectorAll('[data-k]').forEach((i) => i.addEventListener('input', () => {
        const k = i.dataset.k;
        st.room[k] = i.value;
        if (k === 'wall') st.room.wall2 = HP.colors.shade(i.value, -0.06);
        if (k === 'floor') st.room.floor2 = HP.colors.shade(i.value, -0.07);
        renderPreview();
      }));
    }
    renderPreview();
    renderSwatches();

    $('#scan').addEventListener('click', () => pickPhoto((img, url) => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = url;
      $('#photo').innerHTML = `<img alt="Photo de la pièce" src="${url}" /><div class="scan-line"></div>`;
      const found = HP.colors.extractRoomPalette(HP.colors.imageToData(img, 96));
      setTimeout(() => {
        if (!found) { toast('Je n’ai pas réussi à lire cette pièce. Essaie une autre photo.'); return; }
        Object.assign(st.room, found);
        renderPreview();
        renderSwatches();
        toast('Pièce scannée ✨ Ajuste les couleurs si besoin.');
      }, 1100);
    }));

    $('#next').addEventListener('click', () => {
      st.onboarded = true;
      S.save();
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      showHome();
    });
    const cancel = $('#cancel');
    if (cancel) cancel.addEventListener('click', () => { S.load(); showHome(); });
  }

  /* ================= 4. écran principal ================= */
  const BUBBLES = {
    thirsty: ['J’ai soif… 🥺 Un petit verre ?', 'Ma gamelle est vide… 💧', 'Glou… j’ai la gorge sèche !'],
    ok: ['Tout va bien 😊', 'Je veille sur ton hydratation 💙', 'Joue avec moi ? Touche le sol !'],
    happy: ['Merci, c’est délicieux ! 💙', 'Tu gères trop bien ! ✨', 'Quelle belle journée 🐾'],
    done: ['Objectif atteint, bravo ! 🎉', 'Champion de l’hydratation ! 🏆'],
  };

  function showHome() {
    stopWorld();
    const st = S.get();
    app.innerHTML = `
<div class="home">
  <header class="top">
    <div class="hello">Salut ! <span id="who"></span><small id="date"></small></div>
    <div class="top-actions">
      <button class="icon" id="b-hist" aria-label="Historique">📊</button>
      <button class="icon" id="b-set" aria-label="Réglages">⚙️</button>
    </div>
  </header>
  <div class="world-wrap"><svg id="world" role="img" aria-label="La pièce de ton compagnon"></svg><div class="bubble" id="bubble"></div></div>
  <section class="hud" aria-label="Hydratation">
    <div class="hud-main">
      <div class="ring-wrap" id="ring-wrap"><svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34"/><circle class="ring-fg" id="ring" cx="40" cy="40" r="34" stroke-dasharray="213.6" stroke-dashoffset="213.6"/><text id="pct" x="40" y="46" text-anchor="middle">0%</text></svg></div>
      <div class="hud-text"><div class="big"><span id="ml">0</span> <small>ml</small></div><div class="sub" id="sub"></div></div>
      <button class="icon" id="undo" aria-label="Annuler le dernier verre" title="Annuler">↩️</button>
    </div>
    <div class="hud-btns">
      <button data-add="150">+150</button>
      <button data-add="250" class="primary">💧 +250 ml</button>
      <button data-add="500">+500</button>
      <button id="custom">Autre</button>
    </div>
    <div class="toys" role="group" aria-label="Jouet">
      <span>Jouet</span>
      <button data-toy="ball" aria-label="Balle" aria-pressed="true">⚽</button>
      <button data-toy="bone" aria-label="Os" aria-pressed="false">🦴</button>
      <button data-toy="mouse" aria-label="Souris" aria-pressed="false">🐭</button>
      <span class="hint">Touche l’animal : caresse<br />Touche le sol : lance le jouet</span>
    </div>
  </section>
</div>`;

    $('#who').textContent = st.pet.name + ' t’attend 💧';
    $('#date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    hud = {
      ring: $('#ring'), pct: $('#pct'), ml: $('#ml'), sub: $('#sub'), bubble: $('#bubble'), mood: null,
      prevTotal: S.todayTotal(),
    };
    world = HP.world.create($('#world'), { species: st.pet.species, colors: st.pet, room: st.room, mood: S.moodFor(hud.prevTotal, S.goal()) });
    world.start();
    updateHud(true);

    app.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addWater(Number(b.dataset.add))));
    $('#custom').addEventListener('click', customSheet);
    $('#undo').addEventListener('click', () => {
      const r = S.undoLast();
      if (r) { updateHud(); toast(`−${r.ml} ml annulés`); } else toast('Rien à annuler aujourd’hui.');
    });
    $('#b-hist').addEventListener('click', historySheet);
    $('#b-set').addEventListener('click', settingsSheet);
    app.querySelectorAll('[data-toy]').forEach((b) => b.addEventListener('click', () => {
      world.setToy(b.dataset.toy);
      app.querySelectorAll('[data-toy]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));

    if (!st.settings.hintSeen) {
      st.settings.hintSeen = true;
      S.save();
      toast(`Dis bonjour à ${st.pet.name} : touche-le, ou touche le sol pour lancer un jouet !`, 4200);
    }
  }

  function setBubble(text, mood, ms) {
    if (!hud) return;
    hud.bubble.textContent = text;
    hud.bubble.className = 'bubble ' + (mood || '');
    void hud.bubble.offsetWidth; // relance l'animation
    hud.bubble.classList.add('pop');
    if (ms) {
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => updateHud(), ms);
    }
  }

  function updateHud(first) {
    if (!hud) return;
    const total = S.todayTotal();
    const goal = S.goal();
    const pct = Math.min(1, total / goal);
    const C = 213.6;
    hud.ring.setAttribute('stroke-dashoffset', String(C * (1 - pct)));
    hud.pct.textContent = Math.round(pct * 100) + '%';
    countTo(hud.ml, first ? total : hud.shownMl || 0, total);
    hud.shownMl = total;
    hud.sub.textContent = total >= goal ? `Objectif de ${fmt(goal)} ml atteint 🎉` : `sur ${fmt(goal)} ml · encore ${fmt(goal - total)} ml`;
    const mood = S.moodFor(total, goal);
    if (mood !== hud.mood || first) {
      hud.mood = mood;
      const list = BUBBLES[mood];
      setBubble(list[Math.floor(Math.random() * list.length)], mood);
    }
    const main = app.querySelector('[data-add="250"]');
    if (main) main.classList.toggle('nudge', mood === 'thirsty');
    if (world) world.setMood(mood);
  }

  /** Fait défiler un nombre vers sa nouvelle valeur (immédiat si l'utilisateur réduit les animations). */
  function countTo(node, from, to) {
    cancelAnimationFrame(node._raf || 0);
    if (from === to || HP.fx.reducedMotion()) { node.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 480;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - u, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (u < 1) node._raf = requestAnimationFrame(step);
    };
    node._raf = requestAnimationFrame(step);
  }

  function addWater(ml) {
    const goal = S.goal();
    const before = S.todayTotal();
    if (!S.addWater(ml)) { toast('Quantité invalide.'); return; }
    if (navigator.vibrate) navigator.vibrate(25);
    updateHud();
    const after = S.todayTotal();
    if (world) world.onDrink(ml);
    HP.fx.play('water', $('#ring-wrap'), { className: 'fx-ring', maxMs: 2500 });
    if (before < goal && after >= goal) {
      const lottie = HP.fx.play('confetti', $('.world-wrap'), { className: 'fx-full', fit: 'xMidYMid slice', maxMs: 4500 });
      if (world) world.celebrate({ confetti: !lottie });
      setBubble('Objectif atteint, bravo ! 🎉', 'done', 6000);
      toast('🎉 Objectif du jour atteint !');
    } else {
      setBubble(`Glou glou ! +${ml} ml 💦`, 'happy', 3200);
    }
  }

  /* ================= feuilles ================= */
  function sheet(title, html, onMount) {
    const back = document.createElement('div');
    back.className = 'backdrop';
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon" data-close aria-label="Fermer">✕</button></div>${html}</div>`;
    const close = () => back.remove();
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.querySelector('[data-close]').addEventListener('click', close);
    app.appendChild(back);
    if (onMount) onMount(back, close);
    const first = back.querySelector('input,button[data-close]');
    if (first) first.focus();
  }

  function customSheet() {
    sheet('Autre quantité', `
      <label class="field">Millilitres<input id="c-ml" type="number" inputmode="numeric" min="10" max="2000" step="10" placeholder="330" /></label>
      <button class="btn primary" id="c-go">Ajouter</button>`, (b, close) => {
      const go = () => {
        const v = Number(b.querySelector('#c-ml').value);
        if (!(v >= 10 && v <= 2000)) { toast('Entre une quantité entre 10 et 2000 ml.'); return; }
        close();
        addWater(v);
      };
      b.querySelector('#c-go').addEventListener('click', go);
      b.querySelector('#c-ml').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  function chartSvg(days, goal) {
    const W = 320, H = 150, pad = 22, bw = 28, gap = (W - pad * 2 - bw * days.length) / (days.length - 1);
    const max = Math.max(goal * 1.15, ...days.map((d) => d.ml));
    const y = (v) => H - 24 - (v / max) * (H - 44);
    const bars = days.map((d, i) => {
      const x = pad + i * (bw + gap);
      const reached = d.ml >= goal;
      const label = d.date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
      return `<rect x="${x}" y="${y(d.ml)}" width="${bw}" height="${Math.max(2, H - 24 - y(d.ml))}" rx="7" fill="${reached ? '#1f9d6b' : '#5ec4ff'}"><title>${fmt(d.ml)} ml</title></rect>
<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${label}</text>
<text x="${x + bw / 2}" y="${Math.max(10, y(d.ml) - 4)}" text-anchor="middle">${d.ml ? (d.ml / 1000).toFixed(1) : ''}</text>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Eau bue ces 7 derniers jours"><line x1="${pad - 8}" x2="${W - pad + 8}" y1="${y(goal)}" y2="${y(goal)}" stroke="#1b2a41" stroke-dasharray="4 4" opacity=".4"/><text x="${pad - 8}" y="${y(goal) - 4}" text-anchor="start">objectif ${(goal / 1000).toFixed(1)} L</text>${bars}</svg>`;
  }

  function historySheet() {
    const logs = S.todayLogs();
    const items = logs.length
      ? logs.slice().reverse().map((l) => `<li><span>${new Date(l.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span><span>+${fmt(l.ml)} ml</span></li>`).join('')
      : '<li><span>Rien encore aujourd’hui</span><span>💧</span></li>';
    sheet('Historique', `${chartSvg(S.history(7), S.goal())}<h2 style="font-size:1rem;margin:4px 0 0">Aujourd’hui</h2><ul class="logs">${items}</ul>`);
  }

  function settingsSheet() {
    const st = S.get();
    sheet('Réglages', `
      <div class="menu">
        <button class="btn" id="s-prof">👤 Mon profil et mon objectif (${fmt(S.goal())} ml)</button>
        <button class="btn" id="s-pet">🐾 Scanner / modifier mon compagnon</button>
        <button class="btn" id="s-room">🛋️ Scanner / modifier ma pièce</button>
        <label class="switch card" style="flex-direction:row"><span>🔔 Rappels pour boire<br /><small class="note">Toutes les ${st.settings.everyMin} min tant que l’appli est ouverte</small></span><input id="s-rem" type="checkbox" ${st.settings.reminders ? 'checked' : ''} style="width:24px;height:24px" /></label>
        <a class="btn" href="#/poses" style="text-decoration:none">🎞️ Voir les 180 poses</a>
        <button class="btn danger" id="s-reset">🗑️ Tout effacer</button>
      </div>`, (b, close) => {
      b.querySelector('#s-prof').addEventListener('click', () => { close(); showProfile(true); });
      b.querySelector('#s-pet').addEventListener('click', () => { close(); showPet(true); });
      b.querySelector('#s-room').addEventListener('click', () => { close(); showRoom(true); });
      b.querySelector('#s-rem').addEventListener('change', (e) => {
        st.settings.reminders = e.target.checked;
        S.save();
        if (e.target.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        toast(e.target.checked ? 'Rappels activés 🔔' : 'Rappels désactivés');
      });
      b.querySelector('#s-reset').addEventListener('click', () => {
        if (confirm('Effacer toutes tes données HydraPet (profil, historique, compagnon) ?')) {
          S.reset();
          close();
          route();
        }
      });
    });
  }

  /* ================= rappels ================= */
  function reminderTick() {
    const st = S.get();
    if (!st.onboarded || !st.settings.reminders || !hud) return;
    const now = Date.now();
    const h = new Date().getHours();
    if (h < 7 || h >= 22 || S.todayTotal() >= S.goal()) return;
    const lastLog = st.logs.length ? st.logs[st.logs.length - 1].t : 0;
    const since = now - Math.max(lastLog, st.settings.lastReminder);
    if (since < st.settings.everyMin * 60000) return;
    st.settings.lastReminder = now;
    S.save();
    const msg = `${st.pet.name} a soif ! 💧 C’est l’heure de boire un verre.`;
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('HydraPet', { body: msg }); } catch (e) { toast(msg, 5000); }
    } else toast(msg, 5000);
  }

  /* ================= galerie des poses ================= */
  function showGallery() {
    stopWorld();
    const st = S.get();
    let species = st.pet.species;
    let variant = 'all';
    app.innerHTML = `
<div class="gallery">
  <header>
    <div style="display:flex;justify-content:space-between;align-items:center"><h1 style="margin:0;font-size:1.3rem">Galerie des poses</h1><a class="btn" href="#/" style="text-decoration:none;padding:8px 14px">← Retour</a></div>
    <p class="lead" id="count"></p>
    <div class="chips" id="sp"></div>
    <div class="chips" id="vr"></div>
  </header>
  <div class="grid" id="grid"></div>
</div>`;
    const grid = $('#grid');
    function chips(id, items, current, onPick) {
      const box = $(id);
      box.innerHTML = items.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === current}">${l}</button>`).join('');
      box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.v)));
    }
    function draw() {
      chips('#sp', [['dog', '🐶 Chien'], ['cat', '🐱 Chat']], species, (v) => { species = v; draw(); });
      chips('#vr', [['all', 'Toutes'], ...HP.poses.VARIANTS.map((v) => [v, v])], variant, (v) => { variant = v; draw(); });
      const names = HP.poses.names.filter((n) => variant === 'all' || n.endsWith('-' + variant));
      $('#count').textContent = `${names.length} poses affichées sur ${HP.poses.count()} (36 poses de base × 5 humeurs). L’animal les enchaîne en direct dans sa pièce.`;
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      names.forEach((n) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.appendChild(HP.pet.renderStatic(species, st.pet, n, 104, 96));
        const label = document.createElement('div');
        label.textContent = n;
        cell.appendChild(label);
        frag.appendChild(cell);
      });
      grid.appendChild(frag);
    }
    draw();
  }

  /* ================= démarrage ================= */
  S.load();
  window.addEventListener('hashchange', route);
  setInterval(reminderTick, 60000);
  route();

  // petits points d'entrée pour les tests / la démo
  window.HydraPet = { route, addWater, get world() { return world; } };
})();
