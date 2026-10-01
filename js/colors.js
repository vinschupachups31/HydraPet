/* HydraPet — extraction de couleurs à partir d'une photo (animal ou pièce).
   Tout se passe sur l'appareil : aucune image n'est envoyée nulle part. */
(function (root) {
  const HP = (root.HP = root.HP || {});

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function toHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function fromHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [128, 128, 128];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Éclaircit / assombrit une couleur hex (amount de -1 à 1 sur la luminosité). */
  function shade(hex, amount) {
    const [h, s, l] = rgbToHsl(...fromHex(hex));
    return toHex(hslToRgb(h, s, Math.max(0.04, Math.min(0.96, l + amount))));
  }

  function dist(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /** k-means pondéré, initialisation déterministe par quantiles de luminance. */
  function kmeans(points, k, iterations) {
    if (!points.length) return [];
    const sorted = points.slice().sort((p, q) => p.lum - q.lum);
    let centers = [];
    for (let i = 0; i < k; i++) {
      const p = sorted[Math.min(sorted.length - 1, Math.floor(((i + 0.5) / k) * sorted.length))];
      centers.push([p.r, p.g, p.b]);
    }
    let assign = new Array(points.length).fill(0);
    for (let it = 0; it < (iterations || 8); it++) {
      const sums = centers.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let best = 0, bd = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const d = dist([p.r, p.g, p.b], centers[c]);
          if (d < bd) { bd = d; best = c; }
        }
        assign[i] = best;
        const s = sums[best];
        s[0] += p.r * p.w; s[1] += p.g * p.w; s[2] += p.b * p.w; s[3] += p.w;
      }
      centers = centers.map((c, i) => (sums[i][3] > 0
        ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]]
        : c));
    }
    const weights = centers.map(() => 0);
    points.forEach((p, i) => { weights[assign[i]] += p.w; });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    return centers
      .map((c, i) => ({ rgb: c, weight: weights[i] / total }))
      .filter((c) => c.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }

  function collect(img, region, weightFn) {
    const pts = [];
    const { data, width, height } = img;
    const x0 = Math.floor(width * region[0]), x1 = Math.ceil(width * region[2]);
    const y0 = Math.floor(height * region[1]), y1 = Math.ceil(height * region[3]);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const w = weightFn ? weightFn(x / width, y / height) : 1;
        pts.push({ r, g, b, w, lum: 0.3 * r + 0.59 * g + 0.11 * b });
      }
    }
    return pts;
  }

  /** Couleurs du « cartoon » de l'animal : on regarde surtout le centre de la photo. */
  function extractPetColors(img) {
    const center = (nx, ny) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      return Math.exp(-(dx * dx + dy * dy) * 6);
    };
    const clusters = kmeans(collect(img, [0.15, 0.1, 0.85, 0.9], center), 4, 10);
    if (!clusters.length) return null;
    const hsl = clusters.map((c) => rgbToHsl(...c.rgb));

    const fur = clusters[0].rgb;
    const [fh, fs, fl] = hsl[0];
    // un poil plus vif et lisible, façon dessin animé
    const furHex = toHex(hslToRgb(fh, Math.min(1, fs * 1.1), Math.max(0.12, Math.min(0.88, fl))));

    let fur2 = shade(furHex, -0.18);
    for (let i = 1; i < clusters.length; i++) {
      if (clusters[i].weight > 0.12 && dist(clusters[i].rgb, fur) > 45 && hsl[i][2] < fl) {
        fur2 = toHex(clusters[i].rgb);
        break;
      }
    }

    // museau / ventre : la zone claire de la photo, rapprochée du pelage pour ne pas reprendre le blanc du fond
    let muzzle = shade(furHex, 0.3);
    let bestL = fl + 0.12;
    for (let i = 1; i < clusters.length; i++) {
      if (clusters[i].weight > 0.05 && hsl[i][2] > bestL) {
        bestL = hsl[i][2];
        const mix = clusters[i].rgb.map((v, k) => v * 0.55 + fur[k] * 0.45);
        muzzle = toHex(mix);
      }
    }
    const [mh, ms, ml] = rgbToHsl(...fromHex(muzzle));
    muzzle = toHex(hslToRgb(mh, Math.min(0.6, ms), Math.max(0.6, Math.min(0.86, ml))));

    return { fur: furHex, fur2, muzzle, eye: '#2b1b12', nose: '#2b1b12' };
  }

  /** Palette de la pièce : mur (haut de l'image), sol (bas), accent (couleur la plus vive). */
  function extractRoomPalette(img) {
    const top = kmeans(collect(img, [0, 0, 1, 0.55]), 3, 8);
    const bottom = kmeans(collect(img, [0, 0.65, 1, 1]), 3, 8);
    const all = kmeans(collect(img, [0, 0, 1, 1]), 5, 8);
    if (!top.length || !bottom.length) return null;

    const pastel = (rgb, sMax, lMin, lMax) => {
      const [h, s, l] = rgbToHsl(...rgb);
      return toHex(hslToRgb(h, Math.min(s, sMax), Math.max(lMin, Math.min(lMax, l))));
    };

    let wallRgb = top[0].rgb;
    let floorRgb = bottom[0].rgb;
    if (dist(wallRgb, floorRgb) < 40) {
      const [h, s, l] = rgbToHsl(...floorRgb);
      floorRgb = hslToRgb(h + 12, Math.min(1, s + 0.1), Math.max(0.2, l - 0.2));
    }
    const wall = pastel(wallRgb, 0.5, 0.72, 0.9);
    const floor = pastel(floorRgb, 0.55, 0.58, 0.76);

    let accent = null, best = 0.2;
    all.forEach((c) => {
      const [, s, l] = rgbToHsl(...c.rgb);
      const score = s * (1 - Math.abs(l - 0.55));
      if (c.weight > 0.03 && score > best) { best = score; accent = c.rgb; }
    });
    const accentHex = accent ? pastel(accent, 0.8, 0.6, 0.75) : HP.store ? HP.store.DEFAULT_ROOM.accent : '#ff9e80';
    const [ah, as] = rgbToHsl(...fromHex(accentHex));
    const rug = toHex(hslToRgb(ah + 150, Math.min(0.55, as), 0.74));

    return {
      wall,
      wall2: shade(wall, -0.06),
      floor,
      floor2: shade(floor, -0.07),
      accent: accentHex,
      rug,
    };
  }

  /** Navigateur : réduit l'image à `size` px max et renvoie un ImageData. */
  function imageToData(img, size) {
    const scale = Math.min(1, (size || 96) / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(8, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(8, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  HP.colors = { rgbToHsl, hslToRgb, toHex, fromHex, shade, kmeans, extractPetColors, extractRoomPalette, imageToData };
})(typeof window !== 'undefined' ? window : globalThis);
