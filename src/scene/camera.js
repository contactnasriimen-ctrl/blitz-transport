import * as THREE from 'three';
import { DESTINATIONS } from './atmosphere.js';
import { geo } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * One camera "station" per chapter of the page.
 * night: 0 evening → 1 deep night, glowX: -1 sunset in the west → +1 dawn in the east.
 */
export function makeStations(world, traffic) {
  const S = {
    hero: { pos: V(236, 80, 134), tgt: V(34, 34, -22), fov: 42, night: 0, fog: 0.0024, glow: 1, glowX: -1, orbit: 0.04 },
    kurier: { pos: V(84, 7.5, 0), tgt: V(-70, 10, 0), fov: 56, night: 0.15, fog: 0.004, glow: 0.8, glowX: -1, orbit: 0 },
    express: { pos: V(), tgt: V(), fov: 56, night: 0.3, fog: 0.0029, glow: 0.65, glowX: -1, dynamic: 'chase' },
    moebel: { pos: V(-88.5, 6.8, 37.5), tgt: V(-106, 1.6, 27), fov: 46, night: 0.45, fog: 0.0038, glow: 0.45, glowX: -1, orbit: 0.012 },
    umzug: { pos: V(-24, 74, 118), tgt: V(-138, 0, 14), fov: 44, night: 0.5, fog: 0.0031, glow: 0.35, glowX: -1, orbit: 0.02 },
    waren: { pos: V(262, 58, -36), tgt: V(166, 0, -136), fov: 44, night: 0.6, fog: 0.003, glow: 0.25, glowX: -1, orbit: 0.02 },
    nacht: { pos: V(-200, 118, 268), tgt: V(40, 84, -60), fov: 50, night: 1, fog: 0.0024, glow: 0.08, glowX: 0, orbit: 0.03 },
    europa: { pos: V(), tgt: V(), fov: 45, night: 0.85, fog: 0.00003, glow: 0.15, glowX: 0.4, map: 1, dynamic: 'europe' },
    warum: { pos: V(330, 70, 60), tgt: V(160, 8, -110), fov: 44, night: 0.5, fog: 0.0027, glow: 0.55, glowX: 1, orbit: 0.02 },
    ablauf: { pos: V(300, 26, 128), tgt: V(196, 12, -70), fov: 48, night: 0.35, fog: 0.003, glow: 0.75, glowX: 1, orbit: 0.015 },
    kontakt: { pos: V(166, 31, 40), tgt: V(112, 29, -19), fov: 42, night: 0.2, fog: 0.0032, glow: 0.95, glowX: 1, orbit: 0.01 },
  };
  // which side the text panel sits on (-1 left, +1 right) – the projection is shifted away from it
  const SIDE = { kurier: -1, express: 1, moebel: -1, umzug: 1, waren: -1, nacht: 1, europa: -1 };
  S.moebel.tgt.set(-102, 1.6, 25);
  for (const [k, s] of Object.entries(S)) {
    s.name = k;
    s.map = s.map || 0;
    s.side = SIDE[k] || 0;
    s.panel = k in SIDE ? 1 : 0;
  }

  // Europe framing: fit all destinations for the current aspect ratio
  const pts = DESTINATIONS.map(([, , lat, lon]) => geo(lat, lon));
  const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
  const minZ = Math.min(...pts.map((p) => p.z)), maxZ = Math.max(...pts.map((p) => p.z));
  const center = V((minX + maxX) / 2, 0, (minZ + maxZ) / 2 + 60);
  const spanX = maxX - minX + 700, spanZ = maxZ - minZ + 900;

  const tmp = V();
  const out = { pos: V(), tgt: V(), fov: 45, night: 0, fog: 0.002, glow: 0, glowX: 0, map: 0, side: 0, panel: 0 };
  const KEYS = ['fov', 'night', 'fog', 'glow', 'glowX', 'map', 'side', 'panel'];

  /** Resolves a station to concrete values at time t. */
  function resolve(name, t, aspect, target) {
    const s = S[name];
    for (const k of KEYS) target[k] = s[k];
    if (s.dynamic === 'chase') {
      const p = traffic.heroPos, d = traffic.heroDir;
      const rx = -d.z, rz = d.x;
      target.pos.set(p.x - d.x * 30 + rx * 3, p.y + 12, p.z - d.z * 30 + rz * 3);
      target.tgt.set(p.x + d.x * 38, p.y, p.z + d.z * 38);
      return target;
    }
    if (s.dynamic === 'europe') {
      // the projection offset moves the map beside (desktop) or above (phone) the text panel
      const vfov = THREE.MathUtils.degToRad(s.fov);
      const wide = aspect > 1.15;
      const need = wide ? Math.max(spanZ, spanX / (aspect * 0.56)) : Math.max(spanZ / 0.5, spanX / Math.max(aspect, 0.4));
      const dist = need / (2 * Math.tan(vfov / 2));
      target.tgt.copy(center);
      target.pos.set(center.x, dist * 0.95, center.z + dist * 0.3);
      return target;
    }
    // gentle orbit around the target keeps every station alive
    const a = Math.sin(t * 0.07) * s.orbit;
    tmp.subVectors(s.pos, s.tgt);
    const c = Math.cos(a), n = Math.sin(a);
    target.pos.set(s.tgt.x + tmp.x * c - tmp.z * n, s.pos.y + Math.sin(t * 0.11) * s.orbit * 20, s.tgt.z + tmp.x * n + tmp.z * c);
    target.tgt.copy(s.tgt);
    return target;
  }

  const A = { pos: V(), tgt: V() }, Bk = { pos: V(), tgt: V() };
  const smooth = (e0, e1, x) => {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /** Blend between two stations; lifts the camera over the rooftops when one end is at street level. */
  function blend(a, b, t, time, aspect) {
    resolve(a, time, aspect, A);
    if (t <= 0.0001 || a === b) {
      for (const k of KEYS) out[k] = A[k];
      out.pos.copy(A.pos);
      out.tgt.copy(A.tgt);
      out.eased = 0;
      return out;
    }
    resolve(b, time, aspect, Bk);
    const e = smooth(0, 1, t);
    const dist = A.pos.distanceTo(Bk.pos);
    const low = Math.min(A.pos.y, Bk.pos.y) < 22 && a !== 'europa' && b !== 'europa';
    if (low) {
      const txz = smooth(0.2, 0.8, t);
      out.pos.x = THREE.MathUtils.lerp(A.pos.x, Bk.pos.x, txz);
      out.pos.z = THREE.MathUtils.lerp(A.pos.z, Bk.pos.z, txz);
      out.pos.y = THREE.MathUtils.lerp(A.pos.y, Bk.pos.y, e) + Math.min(135, dist * 0.55) * Math.pow(Math.sin(Math.PI * t), 0.6);
      out.tgt.lerpVectors(A.tgt, Bk.tgt, smooth(0.1, 0.9, t));
    } else {
      out.pos.lerpVectors(A.pos, Bk.pos, e);
      out.pos.y += Math.min(70, dist * 0.15) * Math.sin(Math.PI * t);
      out.tgt.lerpVectors(A.tgt, Bk.tgt, e);
    }
    for (const k of KEYS) out[k] = A[k] + (Bk[k] - A[k]) * e;
    if (a === 'europa' || b === 'europa') {
      // fog must vanish quickly on the way up (log-like blend)
      const fa = Math.log(A.fog), fb = Math.log(Bk.fog);
      out.fog = Math.exp(fa + (fb - fa) * e);
    }
    out.eased = e;
    return out;
  }

  return { stations: S, blend, smooth };
}
