import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENARIOS, runScenario } from './helpers/slipScenarios';

// Glissement des quatre pattes en appui (monde), chaîne complète comportement → locomotion → animation, IK active.
for (const sc of SCENARIOS) {
  test(`appuis : ${sc.name}`, async () => {
    const r = await runScenario(sc, true);
    const s = [...r.slips].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)] ?? 0, max = s[s.length - 1] ?? 0;
    assert.ok(s.length >= 10, `${s.length} appuis mesurés`);
    assert.ok(med < 0.02, `glissement médian ${(med * 100).toFixed(1)} cm`);
    assert.ok(max < 0.09, `glissement maximal ${(max * 100).toFixed(1)} cm`);
  });
}

test('appuis : l\'IK réduit le glissement médian par rapport à la seule synchronisation (demi-tour)', async () => {
  const sc = SCENARIOS[3];
  const a = await runScenario(sc, false), b = await runScenario(sc, true);
  const med = (x: number[]) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];
  assert.ok(med(b.slips) < med(a.slips), `${(med(a.slips) * 100).toFixed(1)} → ${(med(b.slips) * 100).toFixed(1)} cm`);
});
