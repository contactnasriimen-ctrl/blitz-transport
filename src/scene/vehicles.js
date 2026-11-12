import * as THREE from 'three';
import { P, C, R, YARD, HIGHWAY, rng } from './layout.js';
import { part, merge, writeMatrix, sampleLUT, makeLUT, glowLambert } from './parts.js';
import { trailMaterial } from './shaders.js';
import { BRAND } from './world.js';

const ORANGE = BRAND.orange, NAVY = '#173a6b', WHITE = BRAND.white, TYRE = '#0b0d12', GLASS = '#0c1830', DARK = '#1c222c';
const HEAD = '#ffffff', TAIL = '#ff1414', AMBER = '#ffa424', LED = '#bfe0ff';

/* ------------------------------------------------------------- models */
// Forward is +z. Each model: body (lit), lights (emissive), trail spec.
function truckModel() {
  const body = [
    part(2.3, 0.5, 15.8, 0, 0.95, 0, DARK),
    part(2.5, 2.7, 2.5, 0, 2.55, 6.6, NAVY),
    part(2.5, 0.9, 1.6, 0, 4.35, 6.2, NAVY),
    part(2.32, 1.0, 0.06, 0, 3.05, 7.86, GLASS),
    part(2.5, 0.5, 0.2, 0, 1.0, 7.9, DARK),
    part(2.55, 3.0, 12.2, 0, 2.75, -1.6, WHITE),
    part(2.57, 0.55, 12.2, 0, 1.75, -1.6, ORANGE),
    part(2.57, 0.22, 12.2, 0, 4.1, -1.6, BRAND.navy),
  ];
  for (const z of [5.8, 3.4, -5.0, -6.2, -7.3]) body.push(part(2.6, 1.0, 1.0, 0, 0.5, z, TYRE));
  const lights = [
    part(0.5, 0.3, 0.1, -0.85, 1.35, 7.98, HEAD),
    part(0.5, 0.3, 0.1, 0.85, 1.35, 7.98, HEAD),
    part(0.4, 0.25, 0.06, -1.0, 1.4, -7.74, TAIL),
    part(0.4, 0.25, 0.06, 1.0, 1.4, -7.74, TAIL),
  ];
  for (let k = 0; k < 5; k++) lights.push(part(0.22, 0.14, 0.14, -0.7 + k * 0.35, 4.85, 6.95, LED));
  for (let z = -7; z <= 4; z += 2.2) for (const x of [-1.29, 1.29]) lights.push(part(0.05, 0.14, 0.3, x, 1.3, z, AMBER));
  return { body: merge(body), lights: merge(lights), trail: { rear: -7.8, y: 1.5, len: 26, w: 1.7, h: 1.1 } };
}

function vanModel() {
  const body = [
    part(2.0, 2.3, 4.6, 0, 1.65, -0.5, WHITE),
    part(2.0, 1.3, 1.1, 0, 1.15, 2.35, WHITE),
    part(1.92, 0.85, 0.9, 0, 2.2, 2.05, GLASS),
    part(2.03, 0.36, 4.6, 0, 1.3, -0.5, ORANGE),
    part(2.03, 0.12, 4.6, 0, 1.56, -0.5, BRAND.navy),
    part(2.1, 0.7, 0.7, 0, 0.35, 1.9, TYRE),
    part(2.1, 0.7, 0.7, 0, 0.35, -2.0, TYRE),
  ];
  const lights = [
    part(0.42, 0.24, 0.08, -0.7, 1.15, 2.92, HEAD),
    part(0.42, 0.24, 0.08, 0.7, 1.15, 2.92, HEAD),
    part(0.24, 0.4, 0.06, -0.86, 1.3, -2.82, TAIL),
    part(0.24, 0.4, 0.06, 0.86, 1.3, -2.82, TAIL),
  ];
  return { body: merge(body), lights: merge(lights), trail: { rear: -2.9, y: 1.2, len: 16, w: 1.3, h: 0.8 } };
}

function carModel() {
  const body = [
    part(1.8, 0.7, 4.4, 0, 0.65, 0, '#ffffff'),
    part(1.6, 0.56, 2.2, 0, 1.27, -0.25, '#151b24'),
    part(1.9, 0.6, 0.62, 0, 0.3, 1.35, TYRE),
    part(1.9, 0.6, 0.62, 0, 0.3, -1.35, TYRE),
  ];
  const lights = [
    part(0.36, 0.16, 0.06, -0.62, 0.78, 2.22, HEAD),
    part(0.36, 0.16, 0.06, 0.62, 0.78, 2.22, HEAD),
    part(0.4, 0.14, 0.05, -0.62, 0.84, -2.22, TAIL),
    part(0.4, 0.14, 0.05, 0.62, 0.84, -2.22, TAIL),
  ];
  return { body: merge(body), lights: merge(lights), trail: { rear: -2.3, y: 0.8, len: 11, w: 0.9, h: 0.55 } };
}

function boxTruckModel() {
  const body = [
    part(2.2, 0.5, 7.8, 0, 0.8, 0, DARK),
    part(2.3, 2.3, 2.0, 0, 2.0, 2.9, WHITE),
    part(2.22, 0.9, 0.05, 0, 2.5, 3.91, GLASS),
    part(2.45, 3.0, 5.6, 0, 2.6, -0.9, ORANGE),
    part(2.47, 0.3, 5.6, 0, 1.25, -0.9, BRAND.navy),
    part(2.47, 0.25, 5.6, 0, 3.95, -0.9, WHITE),
    part(2.4, 0.9, 0.9, 0, 0.45, 2.8, TYRE),
    part(2.4, 0.9, 0.9, 0, 0.45, -2.6, TYRE),
  ];
  const lights = [
    part(0.45, 0.26, 0.08, -0.85, 1.2, 3.96, HEAD),
    part(0.45, 0.26, 0.08, 0.85, 1.2, 3.96, HEAD),
    part(0.3, 0.3, 0.05, -1.0, 1.35, -3.73, TAIL),
    part(0.3, 0.3, 0.05, 1.0, 1.35, -3.73, TAIL),
    part(0.05, 0.12, 0.3, -1.24, 1.5, -2.5, AMBER),
    part(0.05, 0.12, 0.3, 1.24, 1.5, -2.5, AMBER),
    part(0.05, 0.12, 0.3, -1.24, 1.5, 0.6, AMBER),
    part(0.05, 0.12, 0.3, 1.24, 1.5, 0.6, AMBER),
  ];
  return { body: merge(body), lights: merge(lights), trail: { rear: -3.8, y: 1.4, len: 16, w: 1.4, h: 0.9 } };
}

function trailGeometry({ rear, y, len, w, h }) {
  const hz = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2);
  const vt = new THREE.PlaneGeometry(h, len).rotateX(-Math.PI / 2).rotateZ(Math.PI / 2);
  const g = merge([hz, vt]);
  g.translate(0, y, rear - len / 2);
  return g;
}

/* ------------------------------------------------------------- fleets */
class Fleet {
  constructor(scene, model, max, bodyMat, lightMat, trailMat) {
    this.body = new THREE.InstancedMesh(model.body, bodyMat, max);
    this.lights = new THREE.InstancedMesh(model.lights, lightMat, max);
    this.trail = new THREE.InstancedMesh(trailGeometry(model.trail), trailMat, max);
    this.lights.instanceMatrix = this.body.instanceMatrix;
    this.trail.instanceMatrix = this.body.instanceMatrix;
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const m of [this.body, this.lights, this.trail]) {
      m.frustumCulled = false;
      m.count = 0;
    }
    this.trail.renderOrder = 3;
    this.n = 0;
    this.max = max;
    scene.add(this.body, this.lights, this.trail);
  }
  add(bodyColor, trailColor) {
    const i = this.n++;
    this.body.setColorAt(i, bodyColor);
    this.trail.setColorAt(i, trailColor);
    for (const m of [this.body, this.lights, this.trail]) m.count = this.n;
    return i;
  }
  commit() {
    this.body.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------- traffic */
export function buildTraffic(scene, world, { low = false } = {}) {
  const rand = rng(77);
  const bodyMat = glowLambert({}, 0.2);
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.6) });
  const trailMat = trailMaterial();

  const density = low ? 0.35 : 0.6; // lighter traffic = smoother on every device
  const fleets = {
    truck: new Fleet(scene, truckModel(), 140, bodyMat, lightMat, trailMat),
    van: new Fleet(scene, vanModel(), 90, bodyMat, lightMat, trailMat),
    car: new Fleet(scene, carModel(), 260, bodyMat, lightMat, trailMat),
    box: new Fleet(scene, boxTruckModel(), 70, bodyMat, lightMat, trailMat),
  };

  const c = new THREE.Color();
  const tc = new THREE.Color();
  const carColors = ['#c9ced6', '#2a3342', '#5d1a1a', '#1b3d6b', '#d8dde4', '#3d4450', '#0f1218', '#6b6f75'];
  const trailFor = (kind, dirSign) => {
    if (kind === 'car') return dirSign ? tc.setRGB(1, 0.92, 0.78).multiplyScalar(0.55) : tc.setRGB(1, 0.06, 0.04).multiplyScalar(0.7);
    return tc.setRGB(1, 0.42, 0.05).multiplyScalar(kind === 'truck' ? 0.75 : 0.6);
  };
  const spawn = (kind, trail = true, alt = rand() < 0.5) => {
    const f = fleets[kind];
    if (f.n >= f.max) return null;
    const bodyC = kind === 'car' ? c.set(carColors[Math.floor(rand() * carColors.length)]) : c.setRGB(1, 1, 1);
    const i = f.add(bodyC, trail ? trailFor(kind, alt) : tc.setRGB(0, 0, 0));
    return { f, i };
  };
  const pickKind = (wCar, wVan, wBox, wTruck) => {
    const r = rand() * (wCar + wVan + wBox + wTruck);
    if (r < wCar) return 'car';
    if (r < wCar + wVan) return 'van';
    if (r < wCar + wVan + wBox) return 'box';
    return 'truck';
  };

  const agents = [];

  /* 0. parked vehicles first, so they always get a slot (no trails) */
  const parked = [];
  const park = (kind, x, z, yaw) => {
    const v = spawn(kind, false);
    if (v) parked.push({ ...v, x, z, yaw });
  };
  park('box', world.anchors.moveTruck.x, world.anchors.moveTruck.z, Math.PI); // the moving job
  for (let k = 0; k < 6; k++) park('truck', 116 + k * 17, -189 + 7.85, 0); // docked at hall 1
  for (let k = 0; k < 4; k++) park('truck', 129 + 7.85, -140 + k * 15, Math.PI / 2); // hall 2
  for (let k = 0; k < 7; k++) if (k !== 3) park(k % 3 === 2 ? 'van' : 'truck', 110.2 + k * 13.2, -60, Math.PI);
  for (let k = 0; k < 4; k++) park('van', 104 + k * 4.5, -10.2, 0); // HQ forecourt

  /* 1. street lanes (right-hand traffic) */
  const lanes = [];
  for (let k = -7; k <= 7; k++) {
    const c0 = k * P;
    const inYardZ = c0 > YARD.z0 && c0 < YARD.z1;
    const inYardX = c0 > YARD.x0 && c0 < YARD.x1;
    for (const dir of [1, -1]) {
      // road along x at z = c0, lane offset +z for +x travel
      lanes.push({ axis: 'x', c: c0 + dir * 2.2, a: -C, b: inYardZ ? YARD.x0 - R : C, dir, main: k === 0 });
      // road along z at x = c0, lane offset -x for +z travel
      const skip = k === -3 && dir === 1; // parked moving truck on this lane
      if (!skip) lanes.push({ axis: 'z', c: c0 - dir * 2.2, a: inYardX ? YARD.z1 + R : -C, b: C, dir, main: false });
    }
  }
  for (const L of lanes) {
    const len = L.b - L.a;
    const homes = L.axis === 'z' && L.c < -90;
    let n = Math.round((len / 150) * (L.main ? 3.2 : 1 + rand() * 1.4) * density);
    if (L.main) n = Math.max(n, 7);
    const laneSpeed = L.main ? 17 : 11 + rand() * 6; // one speed per lane, so nobody drives through anybody
    for (let q = 0; q < n; q++) {
      const kind = L.main ? pickKind(3, 4, 1, 0.4) : homes ? pickKind(4, 1, 2, 0) : pickKind(6, 1.6, 0.5, 0.5);
      const v = spawn(kind, true, L.dir === 1);
      if (!v) continue;
      agents.push({ type: 'lane', ...v, L, len, s: (q + rand() * 0.6) * (len / n), v: laneSpeed });
    }
  }

  /* 2. ring road: four lanes, constant speed per lane (no overtaking through each other) */
  const ring = world.ring;
  const laneDefs = [
    { dir: 1, off: 3, v: 26, n: 10 },
    { dir: 1, off: 7, v: 19, n: 12 },
    { dir: -1, off: 3, v: 26, n: 10 },
    { dir: -1, off: 7, v: 19, n: 12 },
  ];
  let hero = null;
  laneDefs.forEach((d, li) => {
    const n = Math.round(d.n * density);
    for (let q = 0; q < n; q++) {
      const kind = li === 0 && q === 0 ? 'truck' : pickKind(2, 1.2, 0.5, 3);
      const v = spawn(kind, true, d.dir === 1);
      if (!v) continue;
      const a = { type: 'ring', ...v, u: q / n + rand() * 0.02, d, isHero: li === 0 && q === 0 };
      agents.push(a);
      if (a.isHero) hero = a;
    }
  });

  /* 3. Autobahns */
  for (const lut of world.autobahns) {
    const n = Math.round(14 * density);
    for (let q = 0; q < n; q++) {
      const dir = q % 2 ? 1 : -1;
      const kind = pickKind(1.5, 1, 0.3, 3);
      const v = spawn(kind, true, dir === 1);
      if (!v) continue;
      const fast = rand() < 0.5;
      agents.push({ type: 'line', ...v, lut, u: rand(), dir, off: fast ? 3 : 7, v: fast ? 28 : 21 });
    }
  }

  /* 4. yard loop */
  const yardCurve = new THREE.CatmullRomCurve3(
    [[146, -172], [212, -172], [214, -100], [210, -76], [150, -74], [143, -120]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  const yardLUT = makeLUT(yardCurve, 900);
  for (let q = 0; q < 4; q++) {
    const v = spawn(q === 3 ? 'van' : 'truck', true, true);
    if (v) agents.push({ type: 'path', ...v, lut: yardLUT, u: q / 4, v: 7 });
  }

  // write parked once (they never move)
  for (const p of parked) writeMatrix(p.f.body.instanceMatrix.array, p.i, p.x, 0, p.z, p.yaw, 1);

  for (const f of Object.values(fleets)) {
    if (f.body.instanceColor) f.body.instanceColor.needsUpdate = true;
    if (f.trail.instanceColor) f.trail.instanceColor.needsUpdate = true;
  }

  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const heroPos = new THREE.Vector3();
  const heroDir = new THREE.Vector3(1, 0, 0);

  function update(dt) {
    for (const a of agents) {
      const arr = a.f.body.instanceMatrix.array;
      if (a.type === 'lane') {
        a.s = (a.s + a.v * dt) % a.len;
        const along = a.L.dir > 0 ? a.L.a + a.s : a.L.b - a.s;
        const fade = Math.min(1, a.s / 6, (a.len - a.s) / 6);
        if (a.L.axis === 'x') writeMatrix(arr, a.i, along, 0, a.L.c, a.L.dir > 0 ? Math.PI / 2 : -Math.PI / 2, fade);
        else writeMatrix(arr, a.i, a.L.c, 0, along, a.L.dir > 0 ? 0 : Math.PI, fade);
      } else if (a.type === 'ring') {
        a.u = (a.u + (a.d.dir * a.d.v * dt) / ring.length + 1) % 1;
        sampleLUT(ring, a.u, p, t);
        const side = a.d.dir * a.d.off;
        const x = p.x - t.z * side, z = p.z + t.x * side;
        const yaw = Math.atan2(t.x * a.d.dir, t.z * a.d.dir);
        writeMatrix(arr, a.i, x, p.y, z, yaw, 1);
        if (a.isHero) {
          heroPos.set(x, p.y, z);
          heroDir.set(t.x * a.d.dir, 0, t.z * a.d.dir);
        }
      } else if (a.type === 'line') {
        a.u = (a.u + (a.dir * a.v * dt) / a.lut.length + 1) % 1;
        sampleLUT(a.lut, a.u, p, t);
        const side = a.dir * a.off;
        const fade = Math.min(1, a.u * 60, (1 - a.u) * 30);
        writeMatrix(arr, a.i, p.x - t.z * side, p.y, p.z + t.x * side, Math.atan2(t.x * a.dir, t.z * a.dir), fade);
      } else if (a.type === 'path') {
        a.u = (a.u + (a.v * dt) / a.lut.length) % 1;
        sampleLUT(a.lut, a.u, p, t);
        writeMatrix(arr, a.i, p.x, 0, p.z, Math.atan2(t.x, t.z), 1);
      }
    }
    for (const f of Object.values(fleets)) f.commit();
  }

  update(0.0001);

  return { update, heroPos, heroDir, hero };
}
