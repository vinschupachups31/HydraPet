/* HydraPet — pièce cartoon 2D générée à partir de la palette extraite de la photo. */
(function (root) {
  const HP = (root.HP = root.HP || {});

  // Repère de la scène : 360 × 640.
  const LAYOUT = {
    width: 360,
    height: 640,
    floorTop: 410,
    floorMin: 450, // pieds de l'animal, côté fond
    floorMax: 612, // pieds de l'animal, côté spectateur
    sofa: { x: 196, y: 330, w: 150, seatY: 424 },
    bowl: { x: 62, y: 560 },
    user: { x: 180, y: 606 }, // « où est l'humain » : le jouet est lancé / rapporté ici
  };

  /** Échelle de l'animal selon sa profondeur (loin = petit). */
  function scaleAt(y) {
    const t = (y - LAYOUT.floorMin) / (LAYOUT.floorMax - LAYOUT.floorMin);
    return 0.62 + Math.max(0, Math.min(1, t)) * 0.36;
  }

  function planks(c) {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const y = LAYOUT.floorTop + 22 + i * 34;
      s += `<line x1="0" x2="360" y1="${y}" y2="${y}" stroke="${c.floor2}" stroke-width="2" opacity=".55"/>`;
    }
    for (let r = 0; r < 7; r++) {
      const y0 = LAYOUT.floorTop + r * 34;
      for (let x = (r % 2) * 40; x < 360; x += 80) {
        s += `<line x1="${x}" x2="${x}" y1="${y0}" y2="${y0 + 34}" stroke="${c.floor2}" stroke-width="2" opacity=".4"/>`;
      }
    }
    return s;
  }

  function build(c) {
    const L = LAYOUT;
    const sofaDark = HP.colors.shade(c.accent, -0.12);
    const sofaLight = HP.colors.shade(c.accent, 0.08);
    return `
<defs>
  <linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.wall}"/><stop offset="1" stop-color="${c.wall2}"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient>
</defs>
<rect width="360" height="${L.floorTop}" fill="url(#wallg)"/>
<rect y="${L.floorTop - 14}" width="360" height="14" fill="${HP.colors.shade(c.wall, 0.07)}"/>
<rect y="${L.floorTop}" width="360" height="${L.height - L.floorTop}" fill="${c.floor}"/>
${planks(c)}
<!-- fenêtre -->
<g transform="translate(34 78)">
  <rect width="120" height="150" rx="10" fill="#fff"/>
  <rect x="8" y="8" width="104" height="134" rx="6" fill="url(#sky)"/>
  <circle cx="84" cy="40" r="14" fill="#fff6c2"/>
  <ellipse cx="42" cy="62" rx="24" ry="9" fill="#fff" opacity=".9"/><ellipse cx="58" cy="56" rx="16" ry="8" fill="#fff" opacity=".9"/>
  <rect x="58" y="8" width="4" height="134" fill="#fff"/><rect x="8" y="72" width="104" height="4" fill="#fff"/>
  <path d="M-8 -4 Q14 70 -8 160 L16 160 Q30 70 16 -4Z" fill="${c.accent}" opacity=".85"/>
  <path d="M128 -4 Q106 70 128 160 L104 160 Q90 70 104 -4Z" fill="${c.accent}" opacity=".85"/>
</g>
<!-- cadre -->
<g transform="translate(206 96)"><rect width="84" height="64" rx="6" fill="#fff"/><rect x="6" y="6" width="72" height="52" rx="3" fill="${c.rug}"/><circle cx="26" cy="26" r="9" fill="#fff" opacity=".8"/><path d="M6 58 L30 34 L46 48 L60 30 L78 58Z" fill="${HP.colors.shade(c.rug, -0.14)}"/></g>
<!-- lampadaire -->
<g transform="translate(168 150)"><rect x="-2" y="40" width="4" height="220" fill="${HP.colors.shade(c.wall, -0.2)}"/><path d="M-26 40 L-14 0 L14 0 L26 40Z" fill="#fff3b0"/><ellipse cx="0" cy="262" rx="18" ry="5" fill="${HP.colors.shade(c.wall, -0.2)}"/></g>
<!-- plante -->
<g transform="translate(322 360)"><path d="M-16 40 L-12 0 L12 0 L16 40Z" fill="#e8a27c"/><path d="M0 0 C-30 -20 -28 -48 -10 -56 C-4 -36 -2 -20 0 0Z" fill="#6dc29a"/><path d="M0 0 C30 -26 26 -56 8 -64 C4 -40 2 -20 0 0Z" fill="#58b088"/><path d="M0 0 C-4 -30 4 -50 0 -72 C10 -50 8 -26 0 0Z" fill="#7fd4ab"/></g>
<!-- tapis -->
<ellipse cx="170" cy="548" rx="128" ry="34" fill="${c.rug}"/>
<ellipse cx="170" cy="548" rx="104" ry="26" fill="none" stroke="#fff" stroke-width="3" opacity=".5" stroke-dasharray="6 8"/>
<!-- canapé -->
<g transform="translate(${L.sofa.x} ${L.sofa.y})">
  <rect x="-8" y="26" width="${L.sofa.w + 16}" height="86" rx="22" fill="${sofaDark}"/>
  <rect x="6" y="${L.sofa.seatY - L.sofa.y - 12}" width="${L.sofa.w - 12}" height="28" rx="12" fill="${sofaLight}"/>
  <rect x="-14" y="${L.sofa.seatY - L.sofa.y - 30}" width="26" height="62" rx="13" fill="${sofaDark}"/>
  <rect x="${L.sofa.w - 12}" y="${L.sofa.seatY - L.sofa.y - 30}" width="26" height="62" rx="13" fill="${sofaDark}"/>
  <circle cx="26" cy="46" r="13" fill="#fff" opacity=".85"/>
  <rect x="8" y="${L.sofa.seatY - L.sofa.y + 14}" width="8" height="12" rx="3" fill="${HP.colors.shade(c.accent, -0.3)}"/>
  <rect x="${L.sofa.w - 16}" y="${L.sofa.seatY - L.sofa.y + 14}" width="8" height="12" rx="3" fill="${HP.colors.shade(c.accent, -0.3)}"/>
</g>
<!-- gamelle -->
<g transform="translate(${L.bowl.x} ${L.bowl.y})">
  <ellipse cx="0" cy="8" rx="30" ry="9" fill="rgba(40,50,80,.14)"/>
  <path d="M-26 -4 L-20 12 Q0 20 20 12 L26 -4Z" fill="#ff7a8a"/>
  <ellipse cx="0" cy="-4" rx="26" ry="8" fill="#ff98a5"/>
  <ellipse id="bowl-water" cx="0" cy="-4" rx="20" ry="5.5" fill="#5ec4ff"/>
</g>`;
  }

  HP.room = { LAYOUT, scaleAt, build };
})(typeof window !== 'undefined' ? window : globalThis);
