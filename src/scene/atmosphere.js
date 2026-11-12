import * as THREE from 'three';
import { geo, rng } from './layout.js';
import { skyMaterial, starsMaterial, cityLightsMaterial, glowSpriteMaterial, arcMaterial, ringMaterial, beamMaterial } from './shaders.js';
import { KM } from './layout.js';

/* ------------------------------------------------------------- sky + stars + moon */
export function buildSky(scene, { low = false } = {}) {
  const skyMat = skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), skyMat);
  sky.renderOrder = 2; // last opaque draw: only the visible sky pixels are shaded
  sky.frustumCulled = false;
  scene.add(sky);

  const rand = rng(5);
  const n = low ? 400 : 800;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2;
    const h = Math.pow(rand(), 0.7) * 0.95 + 0.04;
    const r = Math.sqrt(1 - h * h);
    pos.set([Math.cos(u) * r * 8400, h * 8400, Math.sin(u) * r * 8400], i * 3);
    size[i] = 1 + rand() * rand() * 2.6;
    phase[i] = rand();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const starMat = starsMaterial();
  const stars = new THREE.Points(g, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  scene.add(stars);

  const moonMat = glowSpriteMaterial('#e4ecff', 1.4);
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
  moon.renderOrder = -8;
  moon.frustumCulled = false;
  scene.add(moon);
  const moonDir = new THREE.Vector3(0.62, 0.2, -0.76).normalize();

  return {
    skyMat,
    starMat,
    moonMat,
    update(camera) {
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(moonDir, 7600);
      moon.quaternion.copy(camera.quaternion);
      moon.scale.setScalar(520);
    },
  };
}

/* ------------------------------------------------------------- lights of the region / Europe at night */
// [name, lat, lon, weight]
const CITIES = [
  ['Frankfurt', 50.11, 8.68, 3], ['Stuttgart', 48.78, 9.18, 3], ['Köln', 50.94, 6.96, 4], ['Düsseldorf', 51.23, 6.78, 3],
  ['Dortmund', 51.51, 7.47, 3], ['Essen', 51.46, 7.01, 3], ['Duisburg', 51.43, 6.76, 2], ['Bonn', 50.73, 7.1, 2],
  ['Hannover', 52.37, 9.73, 3], ['Bremen', 53.08, 8.8, 2.5], ['Hamburg', 53.55, 9.99, 5], ['Berlin', 52.52, 13.4, 6],
  ['Leipzig', 51.34, 12.37, 3], ['Dresden', 51.05, 13.74, 3], ['Nürnberg', 49.45, 11.08, 3], ['München', 48.14, 11.58, 5],
  ['Augsburg', 48.37, 10.9, 2], ['Freiburg', 47.99, 7.85, 2], ['Saarbrücken', 49.24, 6.99, 2], ['Kassel', 51.31, 9.48, 2],
  ['Erfurt', 50.98, 11.03, 2], ['Würzburg', 49.79, 9.95, 1.5], ['Ulm', 48.4, 9.99, 1.5], ['Kiel', 54.32, 10.13, 2],
  ['Rostock', 54.09, 12.1, 1.5], ['Magdeburg', 52.13, 11.63, 2], ['Strasbourg', 48.58, 7.75, 2.5], ['Metz', 49.12, 6.18, 1.5],
  ['Nancy', 48.69, 6.18, 1.5], ['Luxembourg', 49.61, 6.13, 2], ['Paris', 48.86, 2.35, 8], ['Lille', 50.63, 3.06, 3],
  ['Reims', 49.26, 4.03, 1.5], ['Lyon', 45.76, 4.84, 4], ['Dijon', 47.32, 5.04, 1.5], ['Brüssel', 50.85, 4.35, 4],
  ['Antwerpen', 51.22, 4.4, 3], ['Gent', 51.05, 3.72, 2], ['Lüttich', 50.63, 5.57, 2], ['Amsterdam', 52.37, 4.9, 4],
  ['Rotterdam', 51.92, 4.48, 4], ['Den Haag', 52.07, 4.3, 3], ['Utrecht', 52.09, 5.12, 2.5], ['Eindhoven', 51.44, 5.48, 2],
  ['Zürich', 47.37, 8.54, 3], ['Basel', 47.56, 7.59, 2], ['Bern', 46.95, 7.45, 2], ['Genf', 46.2, 6.14, 2.5],
  ['Mailand', 45.46, 9.19, 6], ['Turin', 45.07, 7.69, 3.5], ['Venedig', 45.44, 12.33, 2], ['Verona', 45.44, 10.99, 2],
  ['Bologna', 44.49, 11.34, 2.5], ['Innsbruck', 47.27, 11.4, 1.5], ['Salzburg', 47.81, 13.06, 1.5], ['Linz', 48.31, 14.29, 2],
  ['Wien', 48.21, 16.37, 5], ['Graz', 47.07, 15.44, 2], ['Prag', 50.08, 14.44, 4], ['Brünn', 49.2, 16.61, 2],
  ['Pilsen', 49.75, 13.38, 1.5], ['Breslau', 51.11, 17.04, 3], ['Posen', 52.41, 16.93, 2.5], ['Warschau', 52.23, 21.01, 5],
  ['Krakau', 50.06, 19.94, 3], ['Lodz', 51.76, 19.46, 3], ['Kattowitz', 50.26, 19.02, 3.5], ['Stettin', 53.43, 14.55, 2],
  ['Danzig', 54.35, 18.65, 2.5], ['Kopenhagen', 55.68, 12.57, 4], ['Malmö', 55.6, 13.0, 2], ['Aarhus', 56.16, 10.2, 2],
  ['Budapest', 47.5, 19.04, 5], ['Bratislava', 48.15, 17.11, 2.5], ['Ljubljana', 46.06, 14.51, 1.5], ['Zagreb', 45.81, 15.98, 2.5],
  ['London', 51.51, -0.13, 8], ['Birmingham', 52.49, -1.89, 3], ['Bordeaux', 44.84, -0.58, 2.5], ['Nantes', 47.22, -1.55, 2.5],
  ['Marseille', 43.3, 5.37, 4], ['Toulouse', 43.6, 1.44, 3], ['Genua', 44.41, 8.93, 2.5], ['Florenz', 43.77, 11.25, 2.5],
];

export function buildRegionLights(scene, { low = false } = {}) {
  const rand = rng(99);
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pts = [];
  const cols = [];
  const sizes = [];
  const warm = [1.0, 0.56, 0.2];
  const white = [0.85, 0.88, 1.0];
  const push = (x, z, s, c, k) => {
    if (Math.max(Math.abs(x), Math.abs(z)) < 340) return;
    pts.push(x, 0.5, z);
    cols.push(c[0] * k, c[1] * k, c[2] * k);
    sizes.push(s);
  };
  const mul = low ? 0.22 : 0.45;
  const P = CITIES.map(([, lat, lon, w]) => ({ ...geo(lat, lon), w }));
  for (const c of P) {
    const n = Math.round(c.w * 150 * mul);
    const sig = 9 + c.w * 6.5;
    for (let i = 0; i < n; i++) {
      const r = Math.abs(gauss());
      push(c.x + gauss() * sig, c.z + gauss() * sig, 1 + rand() * 1.6, r < 0.6 && rand() < 0.4 ? white : warm, 0.5 + 0.6 * Math.exp(-r));
    }
  }
  // corridors between neighbouring cities (motorways seen from orbit)
  for (const a of P) {
    const near = P.filter((b) => b !== a)
      .map((b) => ({ b, d: Math.hypot(b.x - a.x, b.z - a.z) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    for (const { b, d } of near) {
      if (d > 900) continue;
      const n = Math.round((d / 7) * mul);
      for (let i = 0; i < n; i++) {
        const t = rand();
        push(a.x + (b.x - a.x) * t + gauss() * 4, a.z + (b.z - a.z) * t + gauss() * 4, 0.9 + rand(), warm, 0.35 + rand() * 0.3);
      }
    }
  }
  // scattered villages
  for (let i = 0; i < 2600 * mul; i++) {
    const c = P[Math.floor(rand() * P.length)];
    const r = 60 + rand() * 260;
    const a = rand() * Math.PI * 2;
    push(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 0.8 + rand() * 0.8, warm, 0.25 + rand() * 0.3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(cols, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  const mat = cityLightsMaterial();
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  scene.add(points);
  return {
    update(camera, viewportH) {
      mat.uniforms.uScale.value = 500 + camera.position.y * 1.5;
      // dense views (small screens, far away) would blow out with additive points: scale brightness by pixels per unit
      const ppu = viewportH / (2 * Math.max(camera.position.y, 1) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      mat.uniforms.uGain.value = THREE.MathUtils.clamp(Math.pow(ppu / 0.26, 1.5), 0.12, 1);
    },
  };
}

/* ------------------------------------------------------------- Europe: routes from Germersheim */
export const DESTINATIONS = [
  ['Paris', 'FR', 48.86, 2.35],
  ['Lyon', 'FR', 45.76, 4.84],
  ['Brüssel', 'BE', 50.85, 4.35],
  ['Amsterdam', 'NL', 52.37, 4.9],
  ['Hamburg', 'DE', 53.55, 9.99],
  ['Berlin', 'DE', 52.52, 13.4],
  ['Kopenhagen', 'DK', 55.68, 12.57],
  ['Prag', 'CZ', 50.08, 14.44],
  ['Warschau', 'PL', 52.23, 21.01],
  ['Wien', 'AT', 48.21, 16.37],
  ['München', 'DE', 48.14, 11.58],
  ['Zürich', 'CH', 47.37, 8.54],
  ['Mailand', 'IT', 45.46, 9.19],
];

export function buildEurope(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const arcs = [];
  const markers = [];
  const labels = [];
  const origin = new THREE.Vector3(0, 30, 0);

  DESTINATIONS.forEach(([name, cc, lat, lon], i) => {
    const { x, z } = geo(lat, lon);
    const end = new THREE.Vector3(x, 4, z);
    const dist = Math.hypot(x, z);
    const mid = new THREE.Vector3(x * 0.5, 120 + dist * 0.24, z * 0.5);
    const curve = new THREE.QuadraticBezierCurve3(origin, mid, end);
    const mat = arcMaterial();
    mat.uniforms.uOffset.value = i * 0.37;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 5.5, 6, false), mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    arcs.push({ mat, delay: i * 0.045 });

    const ringM = ringMaterial('#ffb020', false);
    const ring = new THREE.Mesh(new THREE.RingGeometry(16, 24, 40), ringM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 3, z);
    const beamM = beamMaterial('#ffb020');
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 280, 10, 1, true).translate(0, 140, 0), beamM);
    beam.position.set(x, 0, z);
    group.add(ring, beam);
    markers.push({ ring, ringM, beamM, phase: i * 0.5 });
    labels.push({ id: `eu-${i}`, text: name, sub: cc, pos: new THREE.Vector3(x, 300, z), kind: 'city' });
  });

  // range rings: 250 / 500 / 1000 km
  for (const km of [250, 500, 1000]) {
    const r = km * KM;
    const m = ringMaterial('#6f9fff', true);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 3.5, r + 3.5, 256), m);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2;
    group.add(ring);
    markers.push({ rangeM: m });
    const a = -0.62;
    labels.push({ id: `km-${km}`, text: `${km.toLocaleString('de-DE')} km`, sub: '', pos: new THREE.Vector3(Math.cos(a) * r, 10, Math.sin(a) * r), kind: 'range' });
  }

  // home beacon
  const homeM = ringMaterial('#ff6b00', false);
  const home = new THREE.Mesh(new THREE.RingGeometry(70, 92, 64), homeM);
  home.rotation.x = -Math.PI / 2;
  home.position.y = 40;
  group.add(home);
  labels.push({ id: 'eu-home', text: 'Germersheim', sub: 'Start', pos: new THREE.Vector3(0, 60, 0), kind: 'home' });

  return {
    group,
    labels,
    update(amount, time) {
      group.visible = amount > 0.002;
      if (!group.visible) return;
      for (const a of arcs) {
        const p = THREE.MathUtils.clamp((amount - a.delay) / 0.45, 0, 1);
        a.mat.uniforms.uProgress.value = p * 1.04;
        a.mat.uniforms.uAlpha.value = amount;
      }
      for (const m of markers) {
        if (m.rangeM) {
          m.rangeM.uniforms.uAlpha.value = amount * 0.35;
          continue;
        }
        const pulse = 1 + 0.25 * Math.sin(time * 2.2 + m.phase);
        m.ring.scale.setScalar(pulse);
        m.ringM.uniforms.uAlpha.value = amount * 1.4;
        m.beamM.uniforms.uAlpha.value = amount * 0.8;
      }
      const hp = 1 + 0.15 * Math.sin(time * 2.6);
      home.scale.setScalar(hp);
      homeM.uniforms.uAlpha.value = amount * 1.6;
    },
  };
}
