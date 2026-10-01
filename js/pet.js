/* HydraPet — rendu SVG de l'animal cartoon (chien ou chat) à partir d'une pose. */
(function (root) {
  const HP = (root.HP = root.HP || {});
  const NS = 'http://www.w3.org/2000/svg';
  const BODY_C = [0, -58];

  function rot(pt, deg, c) {
    const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    const dx = pt[0] - c[0], dy = pt[1] - c[1];
    return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs];
  }

  const LEGS = {
    br: { pivot: [-14, -42], far: true },
    fr: { pivot: [32, -42], far: true },
    bl: { pivot: [-27, -42], far: false },
    fl: { pivot: [21, -42], far: false },
  };

  function eyeSvg(state, c) {
    const st = `stroke="${c.eye}" stroke-width="2.2" stroke-linecap="round" fill="none"`;
    switch (state) {
      case 'wide':
        return `<ellipse rx="4.8" ry="6.4" fill="${c.eye}"/><circle cx="1.6" cy="-2.4" r="2.1" fill="#fff"/><circle cx="-1.4" cy="2" r="1" fill="#fff"/>`;
      case 'closed':
        return `<path d="M-4.5 0 Q0 3.6 4.5 0" ${st}/>`;
      case 'happy':
        return `<path d="M-4.6 2 Q0 -4.4 4.6 2" ${st}/>`;
      case 'sleepy':
        return `<path d="M-4.5 0.5 H4.5" ${st}/><path d="M-4 2.5 Q0 4.6 4 2.5" ${st} stroke-width="1.2" opacity=".5"/>`;
      case 'sad':
        return `<ellipse rx="4" ry="5.2" fill="${c.eye}"/><circle cx="1.3" cy="-1.8" r="1.7" fill="#fff"/><path d="M-6.5 -7 L4.5 -4" ${st} stroke-width="1.8"/>`;
      default:
        return `<ellipse rx="4" ry="5.2" fill="${c.eye}"/><circle cx="1.3" cy="-1.8" r="1.6" fill="#fff"/>`;
    }
  }

  function mouthSvg(state, c) {
    const st = `stroke="${c.eye}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    const tongue = `<ellipse cx="19" cy="17.5" rx="4" ry="5.2" fill="#ff8aa1"/>`;
    switch (state) {
      case 'closed':
        return `<path d="M12 12 Q18 14 24 12" ${st}/>`;
      case 'open':
        return `<ellipse cx="19" cy="14" rx="7" ry="5" fill="#7a2f3a"/><ellipse cx="19" cy="16.5" rx="4" ry="2.4" fill="#ff8aa1"/>`;
      case 'tongue':
        return `${tongue}<path d="M10 11 Q18 18 26 11" ${st}/>`;
      case 'sad':
        return `<path d="M11 16 Q18 9.5 26 16" ${st}/>`;
      case 'yawn':
        return `<ellipse cx="19" cy="15" rx="8" ry="9" fill="#7a2f3a"/><ellipse cx="19" cy="20" rx="5" ry="3.2" fill="#ff8aa1"/>`;
      default:
        return `<path d="M10 11 Q18 18 26 11" ${st}/>`;
    }
  }

  function toySvg(type) {
    if (type === 'bone') {
      return `<g transform="rotate(-20)"><rect x="-8" y="-2.5" width="16" height="5" rx="2.5" fill="#fff3d6" stroke="#d9bd8a"/><circle cx="-9" cy="-3" r="3.4" fill="#fff3d6" stroke="#d9bd8a"/><circle cx="-9" cy="3" r="3.4" fill="#fff3d6" stroke="#d9bd8a"/><circle cx="9" cy="-3" r="3.4" fill="#fff3d6" stroke="#d9bd8a"/><circle cx="9" cy="3" r="3.4" fill="#fff3d6" stroke="#d9bd8a"/></g>`;
    }
    if (type === 'mouse') {
      return `<ellipse rx="8" ry="5.5" fill="#bfc4cf"/><circle cx="5" cy="-5" r="3" fill="#f6a5b8"/><circle cx="1" cy="-5.5" r="3" fill="#f6a5b8"/><circle cx="7.5" cy="-0.5" r="1.1" fill="#2b2b33"/><path d="M-8 1 Q-16 -2 -18 4" stroke="#f6a5b8" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    }
    return `<circle r="7" fill="#ff6b6b"/><path d="M-6 -2 Q0 -6 6 -2" stroke="#fff" stroke-width="1.8" fill="none" opacity=".8"/><circle cx="-2.5" cy="-3" r="1.6" fill="#fff" opacity=".7"/>`;
  }

  function build(species, c) {
    const cat = species === 'cat';
    const far = HP.colors.shade(c.fur, -0.12);
    const leg = (name, fill) => `<g data-leg="${name}"><rect x="-5" y="0" width="10" height="38" rx="5" fill="${fill}"/><ellipse cx="1.5" cy="38" rx="8" ry="5.5" fill="${c.muzzle}"/></g>`;
    const tail = cat
      ? `<path d="M0 0 Q-26 4 -34 -22 Q-38 -38 -24 -46" stroke="${c.fur}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M-34 -22 Q-38 -38 -24 -46" stroke="${c.fur2}" stroke-width="9" stroke-linecap="round" fill="none"/>`
      : `<path d="M0 0 Q-18 -4 -26 -26" stroke="${c.fur}" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M-22 -18 L-26 -26" stroke="${c.fur2}" stroke-width="10" stroke-linecap="round"/>`;

    const dogEar = (n, x, y, fill) => `<g data-part="${n}" transform="translate(${x} ${y})"><ellipse cx="0" cy="12" rx="8.5" ry="15" fill="${fill}"/></g>`;
    const catEar = (n, x, y) => `<g data-part="${n}" transform="translate(${x} ${y})"><path d="M-10 4 L-2 -20 L11 0 Z" fill="${c.fur}"/><path d="M-5 0 L-2 -13 L6 -1 Z" fill="#ffb3c4"/></g>`;

    const snout = cat
      ? `<ellipse cx="19" cy="8" rx="9.5" ry="7.2" fill="${c.muzzle}"/>`
      : `<ellipse cx="18" cy="7" rx="14.5" ry="10" fill="${c.muzzle}"/>`;
    const nose = cat
      ? `<path d="M21 3 L28 3 L24.5 7.5 Z" fill="#ff8aa1"/>`
      : `<ellipse cx="29.5" cy="2.2" rx="5.2" ry="3.7" fill="${c.nose}"/><ellipse cx="30.7" cy="1" rx="1.6" ry="1" fill="#fff" opacity=".6"/>`;
    const whiskers = cat
      ? `<g stroke="${c.eye}" stroke-width="1.1" stroke-linecap="round" opacity=".55"><path d="M24 8 L36 4"/><path d="M24 10 L37 11"/><path d="M12 8 L2 5"/><path d="M12 10 L1 12"/></g>`
      : '';
    const mouthWrap = cat ? 'translate(19 12) scale(.8) translate(-19 -12)' : '';

    const html = `
<ellipse data-part="shadow" cx="2" cy="0" rx="46" ry="6.5" fill="rgba(40,50,80,.16)"/>
${leg('br', far)}${leg('fr', far)}
<g data-part="body">
  <g data-part="tail" transform="translate(-44 -62)">${tail}</g>
  <ellipse cx="0" cy="-58" rx="${cat ? 43 : 46}" ry="${cat ? 25 : 27}" fill="${c.fur}"/>
  <ellipse cx="5" cy="-47" rx="${cat ? 24 : 26}" ry="9.5" fill="${c.muzzle}" opacity=".85"/>
  <g data-part="head">
    ${cat ? catEar('ear2', -14, -16) : dogEar('ear2', -15, -14, HP.colors.shade(c.fur2, -0.08))}
    <circle cx="0" cy="0" r="24.5" fill="${c.fur}"/>
    ${snout}
    ${cat ? catEar('ear', 7, -18) : dogEar('ear', 9, -19, c.fur2)}
    <circle cx="-3" cy="9" r="4.2" fill="#ff8aa1" opacity=".35"/>
    <g data-part="eyeA" transform="translate(3 -6)"></g>
    <g data-part="eyeB" transform="translate(17 -6)"></g>
    ${whiskers}
    ${nose}
    <g data-part="mouth" ${mouthWrap ? `transform="${mouthWrap}"` : ''}></g>
    <g data-fx="zzz" display="none" class="fx-float"><text x="22" y="-30" font-size="14" font-weight="800" fill="#6aa7ff">z</text><text x="32" y="-44" font-size="18" font-weight="800" fill="#6aa7ff">Z</text><text x="44" y="-60" font-size="22" font-weight="800" fill="#6aa7ff">Z</text></g>
    <g data-fx="heart" display="none" class="fx-float"><path d="M0 -40 C-9 -52 -22 -42 -10 -32 L0 -24 L10 -32 C22 -42 9 -52 0 -40Z" fill="#ff6b8a"/></g>
    <g data-fx="sparkle" display="none" class="fx-float"><path d="M-22 -34 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#ffd54a"/><path d="M24 -40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffd54a"/></g>
    <g data-fx="drop" display="none" class="fx-float"><path d="M-24 -26 C-30 -16 -34 -12 -24 -6 C-14 -12 -18 -16 -24 -26Z" fill="#5ec4ff"/></g>
    <g data-fx="carry" display="none" transform="translate(30 16)"></g>
  </g>
</g>
${leg('bl', c.fur)}${leg('fl', c.fur)}`;

    return html;
  }

  /** Crée un animal. `root` est un <g> SVG dont l'origine est le point au sol, sous le ventre. */
  function create(species, colors) {
    const c = Object.assign({}, HP.store.DEFAULT_PET, colors);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'pet');
    g.innerHTML = build(species, c);
    const q = (sel) => g.querySelector(sel);
    const parts = {
      body: q('[data-part="body"]'),
      head: q('[data-part="head"]'),
      tail: q('[data-part="tail"]'),
      ear: q('[data-part="ear"]'),
      ear2: q('[data-part="ear2"]'),
      eyeA: q('[data-part="eyeA"]'),
      eyeB: q('[data-part="eyeB"]'),
      mouth: q('[data-part="mouth"]'),
      shadow: q('[data-part="shadow"]'),
    };
    const legs = {};
    Object.keys(LEGS).forEach((k) => { legs[k] = q(`[data-leg="${k}"]`); });
    const fx = {};
    g.querySelectorAll('[data-fx]').forEach((n) => { fx[n.getAttribute('data-fx')] = n; });
    const cat = species === 'cat';
    const earBase = cat ? { ear: [7, -18], ear2: [-14, -16] } : { ear: [9, -19], ear2: [-15, -14] };
    const last = { eyes: null, mouth: null, fx: null };

    function apply(p) {
      const sq = `translate(0 -4) scale(${p.sx} ${p.sy}) translate(0 4)`;
      parts.body.setAttribute('transform', `translate(0 ${p.dy}) rotate(${p.lean} ${BODY_C[0]} ${BODY_C[1]}) ${sq}`);
      Object.keys(LEGS).forEach((k) => {
        const piv = LEGS[k].pivot;
        const s = [piv[0] * p.sx, -4 + (piv[1] + 4) * p.sy];
        const r = rot(s, p.lean, BODY_C);
        legs[k].setAttribute('transform', `translate(${r[0].toFixed(2)} ${(r[1] + p.dy).toFixed(2)}) rotate(${p[k]})`);
      });
      parts.head.setAttribute('transform', `translate(${36 + p.hdx} ${-72 + p.hdy}) rotate(${p.head}) translate(10 -14)`);
      parts.tail.setAttribute('transform', `translate(-44 -62) rotate(${p.tail})`);
      parts.ear.setAttribute('transform', `translate(${earBase.ear[0]} ${earBase.ear[1]}) rotate(${cat ? p.ear * 0.5 : p.ear})`);
      parts.ear2.setAttribute('transform', `translate(${earBase.ear2[0]} ${earBase.ear2[1]}) rotate(${cat ? p.ear2 * 0.5 : p.ear2})`);
      parts.shadow.setAttribute('opacity', String(Math.max(0.35, Math.min(1, 1 + p.dy / 70))));

      if (p.eyes !== last.eyes) {
        last.eyes = p.eyes;
        const a = p.eyes === 'wink' ? 'open' : p.eyes;
        const b = p.eyes === 'wink' ? 'closed' : p.eyes;
        parts.eyeA.innerHTML = eyeSvg(a, c);
        parts.eyeB.innerHTML = eyeSvg(b, c);
      }
      if (p.mouth !== last.mouth) {
        last.mouth = p.mouth;
        parts.mouth.innerHTML = mouthSvg(p.mouth, c);
      }
      if (p.fx !== last.fx) {
        last.fx = p.fx;
        Object.keys(fx).forEach((k) => fx[k].setAttribute('display', k === p.fx ? 'inline' : 'none'));
      }
    }

    function setCarry(type) {
      fx.carry.innerHTML = toySvg(type || 'ball');
    }
    setCarry('ball');

    apply(HP.poses.get('stand-neutral'));
    return { root: g, apply, setCarry, species, colors: c };
  }

  /** Image statique d'une pose (galerie, aperçu). */
  function renderStatic(species, colors, poseName, w, h) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-84 -142 172 156');
    svg.setAttribute('width', w || 120);
    svg.setAttribute('height', h || 120);
    const pet = create(species, colors);
    pet.apply(HP.poses.get(poseName));
    svg.appendChild(pet.root);
    return svg;
  }

  HP.pet = { create, renderStatic, toySvg };
})(typeof window !== 'undefined' ? window : globalThis);
