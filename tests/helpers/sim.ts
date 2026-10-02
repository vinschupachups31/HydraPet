import { DEFAULT_BEHAVIOR, BehaviorConfig } from '../../src/config/behavior';
import { ACTIVE_PROFILE } from '../../src/config/modelProfile';
const CLIP_DATA = ACTIVE_PROFILE.clipData;
import { ACTIVE_PET } from '../../src/config/pet';
import { DEFAULT_TURN } from '../../src/config/turning';
import { BehaviorController, BehaviorState } from '../../src/pet/behavior';
import { computeFraming } from '../../src/pet/framing';
import { FrameGuard } from '../../src/pet/frameGuard';
import { OBSTACLES, WalkArea } from '../../src/pet/layout';
import { LocomotionController } from '../../src/pet/locomotor';
import { PostureController } from '../../src/pet/posture';
import { mulberry32 } from '../../src/pet/rng';

export function makeSim(opts: { seed?: number; aspect?: number; cfg?: BehaviorConfig; x?: number; z?: number; guard?: boolean } = {}) {
  const cfg = opts.cfg ?? DEFAULT_BEHAVIOR;
  const framing = computeFraming(opts.aspect ?? 0.56, cfg.approach.z);
  const area = new WalkArea(OBSTACLES);
  area.view = framing;
  if (opts.guard !== false) area.guard = new FrameGuard(() => framing);
  const nominalWalk = CLIP_DATA.Walk.nominalSpeed * ACTIVE_PET.scale, nominalRun = CLIP_DATA.Run.nominalSpeed * ACTIVE_PET.scale;
  const turn = { ...DEFAULT_TURN, vWalk: nominalWalk, vRun: nominalRun, arriveRadius: cfg.arrive.radius };
  const loco = new LocomotionController(turn, area, cfg.bodyRadius, cfg.stall, opts.x ?? 0, opts.z ?? 0.3, 0, cfg.arrive.hysteresis, 0.06);
  const rng = mulberry32(opts.seed ?? 1);
  const posture = new PostureController(rng);
  const behavior = new BehaviorController({
    loco, area, cfg, rng, posture,
    approachPoint: () => framing.approach,
    cameraXZ: () => ({ x: framing.position[0], z: framing.position[2] }),
  });
  return { cfg, framing, guard: area.guard, area, loco, behavior, posture, step(dt: number) { behavior.update(dt); loco.update(dt); posture.update(dt); } };
}

export interface Frame { t: number; state: BehaviorState; phase: string | null; poi: string | null; x: number; z: number; speed: number; dur: number; zone: string; status: string }
export interface Segment { state: BehaviorState; phase: string | null; start: number; end: number; poi: string | null; from: { x: number; z: number }; to: { x: number; z: number }; dur0: number }

export function run(sim: ReturnType<typeof makeSim>, seconds: number, fps: number, hook?: (f: Frame) => void) {
  const dt = 1 / fps, frames: Frame[] = [];
  for (let t = 0; t < seconds; t += dt) {
    sim.step(dt);
    const b = sim.behavior, l = sim.loco;
    const f: Frame = { t, state: b.state, phase: b.approachPhase, poi: b.poi?.id ?? null, x: l.s.x, z: l.s.z, speed: l.realSpeedRaw, dur: b.stateDuration, zone: b.zone, status: l.status };
    frames.push(f); hook?.(f);
  }
  return frames;
}

export function segments(frames: Frame[]): Segment[] {
  const out: Segment[] = [];
  let cur: Segment | null = null;
  for (const f of frames) {
    const key = f.state + (f.state === 'approach' ? ':' + f.phase : '');
    if (!cur || (cur.state + (cur.state === 'approach' ? ':' + cur.phase : '')) !== key) {
      if (cur) cur.to = { x: f.x, z: f.z };
      cur = { state: f.state, phase: f.phase, start: f.t, end: f.t, poi: f.poi, from: { x: f.x, z: f.z }, to: { x: f.x, z: f.z }, dur0: f.dur };
      out.push(cur);
    }
    cur.end = f.t; cur.to = { x: f.x, z: f.z };
  }
  return out;
}
