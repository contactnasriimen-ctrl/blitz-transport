import * as THREE from 'three';
import { P, R, C, LOT, YARD, HQ, HOME, PARK, HIGHWAY, SIDEWALK, blockKind, rng } from './layout.js';
import { buildingMaterial, groundMaterial, highwayMaterial, M } from './shaders.js';
import { part, paint, merge, writeBox, makeLUT, ribbon, wall, glowLambert } from './parts.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const BRAND = {
  orange: '#ff6b00',
  navy: '#142c50',
  white: '#e9edf3',
  yellow: '#ffd400',
};

/** Static city: ground, buildings, highway, depot and the moving scene. */
export function buildWorld(scene, { low = false } = {}) {
  const rand = rng(20261111);
  const anchors = {};

  /* ---------- ground */
  const floodPts = [[108, -176], [160, -176], [212, -176], [150, -84], [214, -84], [110, -62]];
  const floodsV2 = floodPts.map(([x, z]) => new THREE.Vector2(x, z));
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16000, 16000, 1, 1),
    groundMaterial({ P, R, C, YARD, SIDEWALK, PARK, HIGHWAY, floods: floodsV2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = 1; // after buildings: the depth test skips the ground hidden behind them
  scene.add(ground);

  /* ---------- buildings */
  const B = []; // [x, z, w, d, h, lit, style, crown, yaw]
  const roofs = []; // houses: [x, z, w, d, h, yaw]
  const trees = []; // [x, z, s]
  const lamps = []; // [x, z]
  const aviation = []; // [x, y, z]

  const tower = (x, z, w, d, h) => {
    const crown = h > 48 && rand() < 0.5 ? (rand() < 0.5 ? 1 : 0.5) : 0;
    if (h > 55 && rand() < 0.55) {
      B.push([x, z, w, d, h * 0.58, rand(), 0, 0, 0]);
      B.push([x, z, w * 0.72, d * 0.72, h, rand(), 0, crown, 0]);
    } else B.push([x, z, w, d, h, rand(), 0, crown, 0]);
    if (h > 70) aviation.push([x, h + 0.6, z]);
  };

  for (let i = -7; i < 7; i++) {
    for (let j = -7; j < 7; j++) {
      const bx = (i + 0.5) * P;
      const bz = (j + 0.5) * P;
      const kind = blockKind(bx, bz);
      const L = LOT - 0.4;
      if (kind === 'downtown') {
        const r = Math.max(Math.abs(bx), Math.abs(bz));
        const tall = 1 - (r - 16) / 64;
        const th = () => 24 + tall * 72 * (0.45 + rand() * 0.75) + rand() * 14;
        const pat = rand();
        if (pat < 0.4) tower(bx, bz, 12 + rand() * 6.5, 12 + rand() * 6.5, th());
        else if (pat < 0.72) {
          const alongX = rand() < 0.5;
          for (const s of [-1, 1]) {
            const w = 8 + rand() * 0.9;
            const d = 15 + rand() * 3.5;
            if (alongX) tower(bx + s * L * 0.5, bz, w, d, th());
            else tower(bx, bz + s * L * 0.5, d, w, th());
          }
        } else {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(bx + sx * L * 0.5, bz + sz * L * 0.5, 7.6 + rand(), 7.6 + rand(), th() * (0.75 + rand() * 0.3));
        }
      } else if (kind === 'mid') {
        if (rand() < 0.25) {
          B.push([bx, bz, 15 + rand() * 4, 15 + rand() * 4, 9 + rand() * 22, rand(), 0.33, 0, 0]);
        } else {
          const nx = rand() < 0.5 ? 2 : 3;
          const cw = (2 * L) / nx;
          for (let a = 0; a < nx; a++) {
            for (let b = 0; b < 2; b++) {
              if (rand() < 0.12) continue;
              const x = bx - L + cw * (a + 0.5);
              const z = bz - L + L * (b + 0.5);
              B.push([x, z, cw - 1.2 - rand() * 1.2, L - 1.2 - rand() * 1.2, 7 + rand() * 17, rand(), 0.33, 0, 0]);
            }
          }
        }
        lamps.push([bx - P / 2 + R / 2 + 0.6, bz - P / 2 + R / 2 + 0.6]);
      } else if (kind === 'homes') {
        const off = [-6.3, 0, 6.3];
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 3; b++) {
            if (a === 1 && b === 1) {
              trees.push([bx + (rand() - 0.5) * 3, bz + (rand() - 0.5) * 3, 0.9 + rand() * 0.5]);
              continue;
            }
            const x = bx + off[a] + (rand() - 0.5) * 0.6;
            const z = bz + off[b] + (rand() - 0.5) * 0.6;
            const yaw = a === 1 ? 0 : Math.PI / 2;
            const w = 4.8 + rand() * 0.8, d = 5.4 + rand() * 0.8, h = 3 + rand() * 2.6;
            B.push([x, z, w, d, h, 0.5 + rand() * 0.5, 0.66, 0, yaw]);
            roofs.push([x, z, w + 0.5, d + 0.5, h, yaw]);
            if (rand() < 0.45) trees.push([x + (rand() - 0.5) * 7, z + (rand() - 0.5) * 7, 0.7 + rand() * 0.4]);
          }
        }
      } else if (kind === 'park') {
        for (let k = 0; k < 26; k++) trees.push([bx + (rand() - 0.5) * 2 * L, bz + (rand() - 0.5) * 2 * L, 0.8 + rand() * 0.7]);
      } else if (kind === 'hq') {
        B.push([HQ.x, HQ.z - 3, 19, 10, HQ.h, 1, 0.33, 1, 0]);
      }
      if (kind !== 'yard') lamps.push([bx + P / 2 - R / 2 - 0.6, bz + P / 2 - R / 2 - 0.6]);
    }
  }

  // depot halls (warehouse style)
  B.push([160, -200, 104, 22, 13, 1, 1, 0, 0]);
  B.push([118, -118, 22, 60, 11, 1, 1, 0, 0]);

  const bGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const seeds = new THREE.InstancedBufferAttribute(new Float32Array(B.length), 1);
  bGeo.setAttribute('aSeed', seeds);
  const bMesh = new THREE.InstancedMesh(bGeo, buildingMaterial(), B.length);
  const col = new THREE.Color();
  B.forEach((b, i) => b.push((Math.sin(i * 12.9898) * 43758.5453) % 1)); // stable per-building seed (b[9])
  const bOrder = B.map((_, i) => i);
  const bDist = new Float32Array(B.length);
  // Draw buildings front-to-back so hidden pixels are skipped by the depth test (big win on weak GPUs)
  function writeBuildings(cx, cz) {
    for (let i = 0; i < B.length; i++) bDist[i] = (B[i][0] - cx) ** 2 + (B[i][1] - cz) ** 2;
    bOrder.sort((a, b) => bDist[a] - bDist[b]);
    bOrder.forEach((bi, slot) => {
      const b = B[bi];
      writeBox(bMesh.instanceMatrix.array, slot, b[0], 0, b[1], b[2], b[4], b[3], b[8]);
      bMesh.setColorAt(slot, col.setRGB(b[5], b[6], b[7]));
      seeds.array[slot] = Math.abs(b[9]);
    });
    bMesh.instanceMatrix.needsUpdate = true;
    bMesh.instanceColor.needsUpdate = true;
    seeds.needsUpdate = true;
  }
  writeBuildings(300, 200);
  bMesh.computeBoundingSphere();
  scene.add(bMesh);
  let sortX = 300, sortZ = 200, sortT = 0;

  /* ---------- house roofs (prisms) */
  const prism = new THREE.BufferGeometry();
  {
    const v = [
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, // front gable
      -0.5, 0, 0.5, 0, 1, 0.5, 0.5, 0, 0.5, // back gable
      -0.5, 0, -0.5, 0, 1, -0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, -0.5, 0, 0.5, // left slope
      0.5, 0, -0.5, 0.5, 0, 0.5, 0, 1, 0.5, 0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5, // right slope
    ];
    prism.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    prism.computeVertexNormals();
  }
  const roofMesh = new THREE.InstancedMesh(prism, new THREE.MeshLambertMaterial({ color: '#3a2a2a', side: THREE.DoubleSide }), roofs.length);
  roofs.forEach((r, i) => writeBox(roofMesh.instanceMatrix.array, i, r[0], r[4], r[1], r[2], 2.3, r[3], r[5]));
  roofMesh.computeBoundingSphere();
  scene.add(roofMesh);

  /* ---------- trees */
  const treeGeo = merge([
    part(0.35, 1.6, 0.35, 0, 0.8, 0, '#2b1d14'),
    paint(new THREE.ConeGeometry(1.7, 4.2, 7).translate(0, 3.6, 0), '#0f3a2a'),
    paint(new THREE.ConeGeometry(1.25, 3, 7).translate(0, 5.2, 0), '#135038'),
  ]);
  const treeMesh = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), trees.length);
  trees.forEach((t, i) => writeBox(treeMesh.instanceMatrix.array, i, t[0], 0, t[1], t[2], t[2] * (0.9 + rand() * 0.3), t[2], rand() * 6));
  treeMesh.computeBoundingSphere();
  scene.add(treeMesh);

  /* ---------- street lamps */
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.28).multiplyScalar(3) });
  const poleMat = new THREE.MeshLambertMaterial({ color: '#1b2433' });
  const poleGeo = new THREE.BoxGeometry(0.22, 7, 0.22).translate(0, 3.5, 0);
  const headGeo = new THREE.BoxGeometry(0.9, 0.22, 0.5).translate(0, 7, 0);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
  const heads = new THREE.InstancedMesh(headGeo, lampMat, lamps.length);
  lamps.forEach(([x, z], i) => writeBox(poles.instanceMatrix.array, i, x, 0, z, 1, 1, 1, Math.PI / 4));
  heads.instanceMatrix = poles.instanceMatrix;
  poles.computeBoundingSphere();
  heads.boundingSphere = poles.boundingSphere;
  scene.add(poles, heads);

  /* ---------- aviation lights (blink together like the real thing) */
  const avMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.05) });
  const av = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), avMat, Math.max(aviation.length, 1));
  aviation.forEach(([x, y, z], i) => writeBox(av.instanceMatrix.array, i, x, y, z, 1, 1, 1));
  av.count = aviation.length;
  av.computeBoundingSphere();
  scene.add(av);

  /* ---------- HQ roof sign */
  const sign = makeSign();
  sign.position.set(HQ.x, HQ.h + 4.6, HQ.z - 3);
  sign.rotation.y = 0.76;
  scene.add(sign);
  const posts = merge([part(0.4, 4.6, 0.4, -10, 2.3, 0, '#1b2433'), part(0.4, 4.6, 0.4, 10, 2.3, 0, '#1b2433'), part(21, 0.3, 0.3, 0, 0.6, 0, '#1b2433')]);
  const postMesh = new THREE.Mesh(posts, new THREE.MeshLambertMaterial({ vertexColors: true }));
  postMesh.position.set(HQ.x, HQ.h, HQ.z - 3);
  postMesh.rotation.y = 0.76;
  scene.add(postMesh);
  anchors.sign = V3(HQ.x, HQ.h + 4.6, HQ.z - 3);
  anchors.hq = V3(HQ.x, HQ.h * 0.5, HQ.z);

  /* ---------- depot: containers, pallets */
  const containers = [];
  const palette = [BRAND.orange, BRAND.navy, BRAND.white, BRAND.yellow, '#a8321e', '#4c5868', '#1d6b72', BRAND.orange];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      for (let lane = 0; lane < 2; lane++) {
        if (rand() < 0.12) continue;
        const x = 162 + c * 13.5;
        const z = -160 + r * 15 + lane * 2.65;
        const stack = 1 + Math.floor(rand() * 4);
        for (let s = 0; s < stack; s++) containers.push([x + (rand() - 0.5) * 0.3, s * 2.6, z, palette[Math.floor(rand() * palette.length)]]);
      }
    }
  }
  const contGeo = merge([
    part(12, 2.55, 2.45, 0, 1.275, 0, '#ffffff'),
    part(12.05, 0.12, 2.5, 0, 2.5, 0, '#808080'),
    part(0.1, 2.3, 2.2, 6.02, 1.25, 0, '#9a9a9a'),
  ]);
  const contMesh = new THREE.InstancedMesh(contGeo, glowLambert({}, 0.12), containers.length);
  containers.forEach((c, i) => {
    writeBox(contMesh.instanceMatrix.array, i, c[0], c[1], c[2], 1, 1, 1);
    contMesh.setColorAt(i, col.set(c[3]));
  });
  contMesh.computeBoundingSphere();
  scene.add(contMesh);

  const cargo = []; // [x, y, z, w, h, d, color]
  for (let k = 0; k < 6; k++) {
    const x = 124 + k * 17;
    for (let s = 0; s < 3; s++) {
      if (rand() < 0.3) continue;
      const h = 1 + rand() * 0.6;
      cargo.push([x + (rand() - 0.5) * 2, 0.15, -186.2 + s * 1.5, 1.2, h, 1.0, rand() < 0.4 ? BRAND.orange : '#b48a5a']);
    }
  }
  // pallets (wooden bases)
  cargo.forEach((c) => cargo.push([c[0], 0, c[2], 1.25, 0.15, 1.05, '#6e5235']));

  /* ---------- the moving scene (HOME block, east side) */
  const truckPos = V3(-99.6, 0, 22);
  anchors.moveTruck = truckPos.clone();
  anchors.home = V3(-105.8, 3, 16);
  // cardboard boxes on the pavement
  for (let k = 0; k < 9; k++) {
    const sx = -101.8 + (k % 2) * 0.95;
    const sz = 15.5 + Math.floor(k / 3) * 1.1;
    const lvl = k % 3 === 2 ? 1 : 0;
    cargo.push([sx, lvl * 0.72, sz + (rand() - 0.5) * 0.2, 0.85, 0.7, 0.85, rand() < 0.2 ? '#c9a06a' : '#b8895a']);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cargoMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ emissive: '#120a04' }), cargo.length);
  cargo.forEach((c, i) => {
    writeBox(cargoMesh.instanceMatrix.array, i, c[0], c[1], c[2], c[3], c[4], c[5], rand() * 0.1);
    cargoMesh.setColorAt(i, col.set(c[6]));
  });
  cargoMesh.computeBoundingSphere();
  scene.add(cargoMesh);

  // orange sofa waiting at the ramp + loading ramp
  const sofa = new THREE.Mesh(
    merge([
      part(1.0, 0.45, 2.3, 0, 0.35, 0, BRAND.orange),
      part(0.3, 0.6, 2.3, -0.38, 0.85, 0, BRAND.orange),
      part(1.0, 0.35, 0.28, 0, 0.7, 1.0, '#e55f00'),
      part(1.0, 0.35, 0.28, 0, 0.7, -1.0, '#e55f00'),
      part(0.9, 0.12, 2.1, 0.05, 0.08, 0, '#2a1a10'),
    ]),
    glowLambert({}, 0.25),
  );
  sofa.position.set(-101.6, 0.08, 30.4);
  sofa.rotation.y = 0.08;
  scene.add(sofa);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 3.9), new THREE.MeshLambertMaterial({ color: '#8d8f94', emissive: '#1a1a1c' }));
  ramp.position.set(truckPos.x, 0.58, truckPos.z + 3.75 + 1.75);
  ramp.rotation.x = 0.29;
  scene.add(ramp);

  // light pools (porch, HQ front, sofa)
  const pools = [[-102.6, 16.2, 9, '#ffb060'], [-100, 28, 12, '#ffd8a0'], [112, -8, 26, '#ff9a40'], [104, -18, 10, '#ffb060']];
  const poolMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    M({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vC * exp(-r * r * 4.0) * 0.5, 1.0); }`,
    }),
    pools.length,
  );
  pools.forEach(([x, z, s, c], i) => {
    writeBox(poolMesh.instanceMatrix.array, i, x, 0.05, z, s, 1, s);
    poolMesh.setColorAt(i, col.set(c));
  });
  poolMesh.computeBoundingSphere();
  scene.add(poolMesh);

  // porch light + flood light heads
  const glow = [[-102.7, 2.6, 16.2], ...floodPts.map(([x, z]) => [x, 16, z])];
  const glowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.9) }), glow.length);
  glow.forEach(([x, y, z], i) => writeBox(glowMesh.instanceMatrix.array, i, x, y, z, i === 0 ? 0.3 : 2.4, i === 0 ? 0.3 : 0.5, i === 0 ? 0.3 : 1.2));
  glowMesh.computeBoundingSphere();
  scene.add(glowMesh);
  const fpoles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 16, 0.5).translate(0, 8, 0), poleMat, floodPts.length);
  floodPts.forEach(([x, z], i) => writeBox(fpoles.instanceMatrix.array, i, x, 0, z, 1, 1, 1));
  fpoles.computeBoundingSphere();
  scene.add(fpoles);
  anchors.yard = V3(165, 0, -140);

  /* ---------- elevated ring road + Autobahns */
  const ringPts = [];
  const N = 72;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const r = HIGHWAY.radius / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
    ringPts.push(V3(c * r, HIGHWAY.y, s * r));
  }
  const ringCurve = new THREE.CatmullRomCurve3(ringPts, true, 'centripetal');
  const ring = makeLUT(ringCurve, 2400);

  const hwMat = highwayMaterial(HIGHWAY.width);
  const abMat = highwayMaterial(HIGHWAY.width, [700, 2000]); // Autobahns fade out into the countryside
  const wallMat = new THREE.MeshLambertMaterial({ color: '#1c2638', side: THREE.DoubleSide });
  const underMat = new THREE.MeshLambertMaterial({ color: '#0d1420' });
  const roads = [ring];
  const near = [ring]; // parts that get walls, underside and pillars
  const dirs = [
    [0, -1],
    [1, -0.22],
    [-1, 0.09],
    [0.16, 1],
  ];
  for (const [dx, dz] of dirs) {
    const l = Math.hypot(dx, dz);
    const ux = dx / l, uz = dz / l;
    const start = 300 / Math.max(Math.abs(ux), Math.abs(uz));
    const a = V3(ux * start, HIGHWAY.y, uz * start);
    roads.push(makeLUT(new THREE.LineCurve3(a, V3(ux * (start + 2000), HIGHWAY.y, uz * (start + 2000))), 800));
    near.push(makeLUT(new THREE.LineCurve3(a, V3(ux * (start + 700), HIGHWAY.y, uz * (start + 700))), 280));
  }
  roads.forEach((lut, idx) => scene.add(new THREE.Mesh(ribbon(lut, HIGHWAY.width), idx === 0 ? hwMat : abMat)));
  const pillarsAt = [];
  near.forEach((lut) => {
    scene.add(new THREE.Mesh(ribbon(lut, HIGHWAY.width, { yOff: -1.1, down: true }), underMat));
    for (const side of [-1, 1]) scene.add(new THREE.Mesh(wall(lut, side * HIGHWAY.width * 0.5, 1.0), wallMat));
    const every = Math.max(1, Math.round(36 / (lut.length / lut.n)));
    for (let i = 0; i < lut.n; i += every) pillarsAt.push([lut.pos[i * 3], lut.pos[i * 3 + 2], Math.atan2(lut.tan[i * 3], lut.tan[i * 3 + 2])]);
  });
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 1, 2.2).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: '#202a3b' }), pillarsAt.length);
  pillarsAt.forEach(([x, z, yaw], i) => writeBox(pillars.instanceMatrix.array, i, x, 0, z, 1, HIGHWAY.y - 1.1, 1, yaw));
  pillars.computeBoundingSphere();
  scene.add(pillars);

  return {
    anchors,
    ring,
    autobahns: roads.slice(1),
    update(t, camera) {
      avMat.color.setRGB(Math.sin(t * 3.2) > 0.55 ? 3 : 0.15, 0.05, 0.03);
      if (camera && performance.now() - sortT > 400) {
        const { x, z } = camera.position;
        if ((x - sortX) ** 2 + (z - sortZ) ** 2 > 400) {
          writeBuildings(x, z);
          sortX = x;
          sortZ = z;
        }
        sortT = performance.now();
      }
    },
  };
}

/** HQ rooftop sign drawn on a canvas (uses the page font once it has loaded). */
function makeSign() {
  const W = 1024, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const font = (px) => `italic 800 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  // bolt
  g.save();
  g.translate(70, 18);
  g.scale(9, 9);
  g.beginPath();
  g.moveTo(14.5, 1.5); g.lineTo(4, 13.5); g.lineTo(10.8, 13.5); g.lineTo(8.6, 22.5); g.lineTo(20, 9.6); g.lineTo(13, 9.6); g.closePath();
  const bg = g.createLinearGradient(0, 0, 0, 24);
  bg.addColorStop(0, '#ffe14a');
  bg.addColorStop(1, '#ff6b00');
  g.fillStyle = bg;
  g.fill();
  g.restore();
  g.textBaseline = 'alphabetic';
  g.font = font(150);
  g.fillStyle = '#ffffff';
  g.fillText('BLITZ', 290, 150);
  g.font = font(84);
  g.fillStyle = '#ff7a12';
  g.fillText('TRANSPORT', 296, 232);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.7, 1.7, 1.7) });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), mat);
  mesh.renderOrder = 2;
  return mesh;
}
