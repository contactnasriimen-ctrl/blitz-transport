import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmp = new THREE.Color();

/** Box with a baked vertex colour, positioned in model space. */
export function part(w, h, l, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, l);
  g.translate(x, y, z);
  return paint(g, color);
}

export function paint(g, color) {
  tmp.set(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = tmp.r;
    arr[i * 3 + 1] = tmp.g;
    arr[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(list) {
  const clean = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(clean, false);
  list.forEach((g) => g.dispose());
  return out;
}

/** Lambert material whose vertex/instance colours also glow a little, so brand colours stay vivid at night. */
export function glowLambert(params, k = 0.22) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...params });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * ${k.toFixed(3)};`,
    );
  };
  m.customProgramCacheKey = () => `glow${k}`;
  return m;
}

/** Writes a yaw-rotated, uniformly scaled transform into an instance matrix array. */
export function writeMatrix(arr, i, x, y, z, yaw, s = 1) {
  const c = Math.cos(yaw) * s;
  const n = Math.sin(yaw) * s;
  const o = i * 16;
  arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -n; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = n; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}

/** Non-uniform box transform (used for static buildings and props). */
export function writeBox(arr, i, x, y, z, sx, sy, sz, yaw = 0) {
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  const o = i * 16;
  arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -n * sx; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = n * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}

/** Arc-length lookup table for a curve: even spacing, fast sampling. */
export function makeLUT(curve, n = 2048) {
  const pts = curve.getSpacedPoints(n);
  const pos = new Float32Array(n * 3);
  const tan = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    let dx = q.x - p.x, dz = q.z - p.z;
    const l = Math.hypot(dx, dz) || 1;
    tan[i * 3] = dx / l; tan[i * 3 + 1] = 0; tan[i * 3 + 2] = dz / l;
  }
  return { n, pos, tan, length: curve.getLength(), closed: !!curve.closed };
}

/** Sample LUT at u ∈ [0,1): returns position (out) and tangent (outT). */
export function sampleLUT(lut, u, out, outT) {
  const f = (((u % 1) + 1) % 1) * lut.n;
  const i = Math.floor(f);
  const j = (i + 1) % lut.n;
  const t = f - i;
  const a = lut.pos, b = lut.tan;
  out.set(a[i * 3] + (a[j * 3] - a[i * 3]) * t, a[i * 3 + 1] + (a[j * 3 + 1] - a[i * 3 + 1]) * t, a[i * 3 + 2] + (a[j * 3 + 2] - a[i * 3 + 2]) * t);
  if (outT) outT.set(b[i * 3] + (b[j * 3] - b[i * 3]) * t, 0, b[i * 3 + 2] + (b[j * 3 + 2] - b[i * 3 + 2]) * t).normalize();
  return out;
}

/** Flat ribbon along a LUT (uv.x = metres, uv.y = across). Optional vertical offset and facing down. */
export function ribbon(lut, width, { step = 4, yOff = 0, down = false, closed = lut.closed, offset = 0 } = {}) {
  const count = Math.floor(lut.n / step) + (closed ? 1 : 0);
  const pos = [], uv = [], idx = [];
  const segLen = lut.length / lut.n;
  for (let k = 0; k < count; k++) {
    const i = (k * step) % lut.n;
    const px = lut.pos[i * 3], py = lut.pos[i * 3 + 1] + yOff, pz = lut.pos[i * 3 + 2];
    const tx = lut.tan[i * 3], tz = lut.tan[i * 3 + 2];
    const rx = -tz, rz = tx;
    const cx = px + rx * offset, cz = pz + rz * offset;
    pos.push(cx - rx * width / 2, py, cz - rz * width / 2, cx + rx * width / 2, py, cz + rz * width / 2);
    const along = k * step * segLen;
    uv.push(along, 0, along, 1);
    if (k > 0) {
      const a = (k - 1) * 2, b = a + 1, c = k * 2, d = c + 1;
      if (down) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical wall strip along a LUT at a lateral offset. */
export function wall(lut, offset, height, { step = 4, closed = lut.closed } = {}) {
  const count = Math.floor(lut.n / step) + (closed ? 1 : 0);
  const pos = [], idx = [];
  for (let k = 0; k < count; k++) {
    const i = (k * step) % lut.n;
    const px = lut.pos[i * 3], py = lut.pos[i * 3 + 1], pz = lut.pos[i * 3 + 2];
    const rx = -lut.tan[i * 3 + 2], rz = lut.tan[i * 3];
    const x = px + rx * offset, z = pz + rz * offset;
    pos.push(x, py, z, x, py + height, z);
    if (k > 0) {
      const a = (k - 1) * 2, b = a + 1, c = k * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
