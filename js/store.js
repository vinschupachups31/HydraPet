/* HydraPet — état de l'application, calcul du besoin en eau, historique. */
(function (root) {
  const HP = (root.HP = root.HP || {});
  const KEY = 'hydrapet.v1';

  const DEFAULT_PET = {
    species: 'dog',
    name: 'Pixel',
    fur: '#c98f56',
    fur2: '#8a5a32',
    muzzle: '#f3dfc2',
    eye: '#2b1b12',
    nose: '#2b1b12',
  };
  const DEFAULT_ROOM = {
    wall: '#cfe8f6',
    wall2: '#b7dcf0',
    floor: '#e9c99b',
    floor2: '#d9b783',
    accent: '#ff9e80',
    rug: '#8fd3c8',
  };

  const ACTIVITY = { low: 0.9, normal: 1, high: 1.15 };

  /** Besoin quotidien en ml : ~33 ml/kg, léger ajustement taille, facteur d'activité. */
  function calcGoal(p) {
    const w = Number(p.weight);
    const h = Number(p.height);
    if (!(w >= 20 && w <= 300) || !(h >= 80 && h <= 250)) return null;
    const factor = ACTIVITY[p.activity] || 1;
    const raw = (w * 33 + (h - 170) * 4) * factor;
    const rounded = Math.round(raw / 50) * 50;
    return Math.min(5000, Math.max(1200, rounded));
  }

  function dayKey(d) {
    const dt = new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + m + '-' + day;
  }

  function fresh() {
    return {
      onboarded: false,
      profile: null, // { weight, height, activity, goalMl }
      pet: Object.assign({}, DEFAULT_PET),
      room: Object.assign({}, DEFAULT_ROOM),
      logs: [], // { t, ml }
      settings: { reminders: false, everyMin: 90, lastReminder: 0 },
    };
  }

  let state = fresh();

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const base = fresh();
        state = Object.assign(base, saved, {
          pet: Object.assign(base.pet, saved.pet),
          room: Object.assign(base.room, saved.room),
          settings: Object.assign(base.settings, saved.settings),
        });
      }
    } catch (e) {
      state = fresh();
    }
    return state;
  }

  function save() {
    try {
      root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* stockage indisponible : on continue sans sauvegarde */
    }
  }

  function reset() {
    state = fresh();
    save();
    return state;
  }

  function get() {
    return state;
  }

  function goal() {
    return state.profile ? state.profile.goalMl : 2000;
  }

  function addWater(ml, t) {
    const v = Math.round(Number(ml));
    if (!(v > 0 && v <= 2000)) return null;
    const entry = { t: t || Date.now(), ml: v };
    state.logs.push(entry);
    save();
    return entry;
  }

  function undoLast(now) {
    const key = dayKey(now || Date.now());
    for (let i = state.logs.length - 1; i >= 0; i--) {
      if (dayKey(state.logs[i].t) === key) {
        const [removed] = state.logs.splice(i, 1);
        save();
        return removed;
      }
    }
    return null;
  }

  function todayLogs(now) {
    const key = dayKey(now || Date.now());
    return state.logs.filter((l) => dayKey(l.t) === key);
  }

  function todayTotal(now) {
    return todayLogs(now).reduce((s, l) => s + l.ml, 0);
  }

  /** n derniers jours (le plus ancien en premier), jour courant inclus. */
  function history(n, now) {
    const out = [];
    const base = new Date(now || Date.now());
    base.setHours(12, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base.getTime() - i * 86400000);
      const key = dayKey(d);
      const ml = state.logs.filter((l) => dayKey(l.t) === key).reduce((s, l) => s + l.ml, 0);
      out.push({ key, ml, date: d });
    }
    return out;
  }

  /** Part de l'objectif qu'on devrait avoir bue à cette heure (réveil 7h → coucher 22h). */
  function expectedFraction(now) {
    const d = new Date(now || Date.now());
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.min(1, Math.max(0, (h - 7) / 15));
  }

  /** 'done' | 'happy' | 'ok' | 'thirsty' */
  function moodFor(total, goalMl, now) {
    if (total >= goalMl) return 'done';
    const ratio = total / goalMl;
    const exp = expectedFraction(now);
    if (ratio >= exp + 0.05) return 'happy';
    if (ratio >= exp - 0.12) return 'ok';
    return 'thirsty';
  }

  HP.store = {
    DEFAULT_PET,
    DEFAULT_ROOM,
    calcGoal,
    dayKey,
    load,
    save,
    reset,
    get,
    goal,
    addWater,
    undoLast,
    todayLogs,
    todayTotal,
    history,
    expectedFraction,
    moodFor,
  };
})(typeof window !== 'undefined' ? window : globalThis);
