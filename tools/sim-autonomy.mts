/* Observe le comportement autonome sur 10 minutes simulées.  Usage : node --import tsx tools/sim-autonomy.mts */
import { makeSim, run, segments } from '../tests/helpers/sim';

for (const [name, aspect, fps, seed] of [['portrait', 0.56, 60, 1], ['portrait', 0.56, 30, 1], ['paysage', 1.78, 60, 2], ['portrait', 0.56, 60, 7]] as const) {
  const sim = makeSim({ seed, aspect });
  const frames = run(sim, 600, fps);
  const seg = segments(frames);
  const trips = seg.filter((s) => s.state === 'walk');
  const obs = seg.filter((s) => s.state === 'observe');
  const rest = seg.filter((s) => s.state === 'rest');
  const appr = seg.filter((s) => s.state === 'approach' && s.phase === 'stay');
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
  const walking = frames.filter((f) => f.speed > 0.08).length / frames.length;
  const still = frames.filter((f) => f.speed < 0.03).length / frames.length;
  const zone = (z: string) => (frames.filter((f) => f.zone === z).length / frames.length * 100).toFixed(0);
  const pois = new Set(trips.map((t) => t.poi).filter(Boolean));
  const seq = trips.map((t) => t.poi);
  let chain = 0, maxChain = 0; for (let i = 1; i < seg.length; i++) { if (seg[i].state === 'walk' && seg[i - 1].state === 'walk') chain++; else chain = 0; maxChain = Math.max(maxChain, chain + 1); }
  const afterTrip = trips.map((t) => seg[seg.indexOf(t) + 1]).filter((s) => s && s.state === 'observe').map((s) => s.end - s.start);
  console.log(`\n== ${name} ${fps} fps graine ${seed} ==`);
  console.log(`trajets ${trips.length} (distance médiane ${trips.map((t) => dist(t.from, t.to)).sort((a, b) => a - b)[Math.floor(trips.length / 2)]?.toFixed(2)} m, min ${Math.min(...trips.map((t) => dist(t.from, t.to))).toFixed(2)} m) · observations ${obs.length} · pauses longues ${rest.length} (${rest.map((r) => (r.end - r.start).toFixed(0)).join(',')} s) · approches ${appr.length}`);
  console.log(`marche ${(walking * 100).toFixed(0)} % du temps, à l'arrêt ${(still * 100).toFixed(0)} % · fond ${zone('back')} % centre ${zone('mid')} % avant ${zone('front')} %`);
  console.log(`destinations distinctes ${pois.size} : ${[...pois].join(', ')} · trajets d'affilée max ${maxChain} · observation après trajet ${afterTrip.length ? `${Math.min(...afterTrip).toFixed(1)}–${Math.max(...afterTrip).toFixed(1)} s` : '-'} (${afterTrip.length}/${trips.length} trajets)`);
  const dwell: Record<string, number> = {}; for (let i = 1; i < seg.length; i++) { const prev = seg[i - 1]; if (seg[i].state !== 'walk' && prev.state === 'walk' && prev.poi) { /* temps passé à l'arrêt après ce trajet */ } }
  const byPoi: Record<string, number> = {}; let curPoi = '-'; for (const f of frames) { if (f.state === 'walk') curPoi = f.poi ?? '-'; if (f.speed < 0.03) byPoi[curPoi] = (byPoi[curPoi] ?? 0) + 1 / fps; }
  console.log('temps à l\'arrêt par destination (s) :', Object.entries(byPoi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', '));
  console.log('séquence :', seq.join(' → '));
  console.log('séjours à l\'approche :', appr.map((a) => (a.end - a.start).toFixed(1)).join(', '), 's ; blocages :', sim.behavior.events.filter((e) => e.detail.includes('bloqué')).length);
}
