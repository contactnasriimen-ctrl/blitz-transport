import * as THREE from 'three';
import { shared } from './shaders.js';
import { buildWorld } from './world.js';
import { buildTraffic } from './vehicles.js';
import { buildSky, buildRegionLights, buildEurope } from './atmosphere.js';
import { makeStations } from './camera.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Light mode: no post-processing, capped frame rate, calmer motion.
const MOTION = 0.7; // vehicles, orbits and pulses run at 70 % speed

const C_TOP_EVE = new THREE.Color('#0b1a3a');
const C_TOP_NIGHT = new THREE.Color('#02060f');
const C_HOR_EVE = new THREE.Color('#2b4677');
const C_HOR_NIGHT = new THREE.Color('#0a1630');
const C_FOG_EVE = new THREE.Color('#152a52');
const C_FOG_NIGHT = new THREE.Color('#050d1c');
const C_DUSK = new THREE.Color('#ff5a0a');
const C_DAWN = new THREE.Color('#ff9a52');

/**
 * Creates the 3D transport city on the canvas.
 * Returns a small controller the page drives with its scroll position.
 */
export async function createCity(canvas, { labelsEl, low = false, reducedMotion = false, onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.25);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C_FOG_EVE.clone(), 0.0026);
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.4, 22000);
  camera.position.set(318, 150, 196);

  scene.add(new THREE.HemisphereLight('#8aa6e8', '#3a1d08', 2.1));
  const moonLight = new THREE.DirectionalLight('#b4c8ff', 1.5);
  moonLight.position.set(-0.45, 0.55, -0.7);
  scene.add(moonLight);

  onProgress(0.15);
  await nextFrame();
  const world = buildWorld(scene, { low });
  onProgress(0.45);
  await nextFrame();
  const traffic = buildTraffic(scene, world, { low });
  onProgress(0.6);
  await nextFrame();
  const sky = buildSky(scene, { low });
  const region = buildRegionLights(scene, { low });
  const europe = buildEurope(scene);
  onProgress(0.75);
  await nextFrame();

  const { blend } = makeStations(world, traffic);

  /* ---------- pinned HTML labels */
  const pins = [
    { id: 'pin-hq', text: 'Blitz Transport', sub: 'Zentrale · Germersheim', pos: world.anchors.sign.clone().add(new THREE.Vector3(0, 6.5, 0)), keys: ['hero'] },
    { id: 'pin-truck', text: 'Express-Lkw', sub: 'Direkt · ohne Umladen', pos: new THREE.Vector3(), follow: true, keys: ['express'] },
    { id: 'pin-move', text: 'Umzug läuft', sub: 'Sorgfältig verladen', pos: world.anchors.moveTruck.clone().add(new THREE.Vector3(0, 6.2, 0)), keys: ['moebel'] },
    { id: 'pin-yard', text: 'Stückgut & Paletten', sub: 'Umschlag im Depot', pos: new THREE.Vector3(186, 16, -112), keys: ['waren'] },
    ...europe.labels.map((l) => ({ ...l, keys: ['europa'] })),
  ];
  if (labelsEl) {
    for (const p of pins) {
      const el = document.createElement('div');
      el.className = `pin pin--${p.kind || 'tag'}`;
      el.innerHTML = `<span class="pin__dot"></span><span class="pin__txt"><b>${p.text}</b>${p.sub ? `<small>${p.sub}</small>` : ''}</span>`;
      labelsEl.appendChild(el);
      p.el = el;
      p.shown = false;
    }
  }

  /* ---------- state */
  const route = { a: 'hero', b: 'hero', t: 0 };
  const pointer = new THREE.Vector2();
  const pointerS = new THREE.Vector2();
  const camPos = camera.position.clone();
  const camTgt = new THREE.Vector3(70, 26, -46);
  const desired = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  let snapNext = true;
  let flash = 0;
  let time = 0;
  let running = false;
  let raf = 0;
  let last = 0; // time of the last rendered frame
  let lastInput = 0; // last scroll / pointer change
  let settling = true; // camera still moving towards its station
  const v = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  const perf = { frames: 0, acc: 0, checks: 0 };

  function weightOf(key, e) {
    let w = 0;
    if (route.a === key) w += 1 - e;
    if (route.b === key) w += e;
    return Math.min(1, w);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // 60 fps only while the visitor scrolls or the camera travels, otherwise 30 fps (phones: always 30)
    const busy = settling || now - lastInput < 700;
    const interval = low || !busy ? 1000 / 30 : 1000 / 60;
    if (now - last < interval - 4) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    render(dt);
  }

  function render(dt) {
    const md = reducedMotion ? 0 : dt * MOTION;
    time += md;
    shared.uTime.value = time;

    traffic.update(md);
    world.update(time, camera);

    const aspect = window.innerWidth / window.innerHeight;
    const st = blend(route.a, route.b, route.t, time, aspect);
    const e = route.a === route.b ? 0 : st.eased;

    // camera follows its station with damping (snaps after jumps)
    const k = snapNext || reducedMotion ? 1 : 1 - Math.exp(-dt * (st.map > 0.5 ? 2.6 : 3.4));
    desired.pos.copy(st.pos);
    desired.tgt.copy(st.tgt);
    camPos.lerp(desired.pos, k);
    camTgt.lerp(desired.tgt, k);
    snapNext = false;
    settling = camPos.distanceToSquared(desired.pos) > 0.04 || camTgt.distanceToSquared(desired.tgt) > 0.04;

    // pointer parallax
    pointerS.lerp(pointer, 1 - Math.exp(-dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    fwd.subVectors(camTgt, camPos);
    const dist = fwd.length();
    right.crossVectors(fwd, camera.up).normalize();
    const amt = Math.min(dist * 0.035, 6) * (1 - st.map);
    camera.position.addScaledVector(right, pointerS.x * amt).addScaledVector(camera.up, -pointerS.y * amt * 0.6);
    camera.lookAt(camTgt);
    // wider lens on portrait screens; shift the image away from the text panel
    const vw = window.innerWidth, vh = window.innerHeight;
    camera.fov = aspect < 1 ? Math.min(72, st.fov * (1 + (1 - aspect) * 0.6 * (1 - st.map))) : st.fov;
    if (aspect < 0.9) camera.setViewOffset(vw, vh, 0, st.panel * 0.21 * vh, vw, vh);
    else camera.setViewOffset(vw, vh, st.side * 0.17 * vw, 0, vw, vh);

    // atmosphere
    const n = st.night;
    shared.uNight.value = n;
    shared.uMap.value = st.map;
    shared.uFogDensity.value = st.fog;
    scene.fog.density = st.fog;
    const fogC = shared.uFogColor.value.copy(C_FOG_EVE).lerp(C_FOG_NIGHT, n);
    scene.fog.color.copy(fogC);
    sky.skyMat.uniforms.uTop.value.copy(C_TOP_EVE).lerp(C_TOP_NIGHT, n);
    sky.skyMat.uniforms.uHorizon.value.copy(C_HOR_EVE).lerp(C_HOR_NIGHT, n);
    sky.skyMat.uniforms.uGlow.value.copy(C_DUSK).lerp(C_DAWN, (st.glowX + 1) / 2);
    sky.skyMat.uniforms.uGlowAmt.value = st.glow;
    sky.skyMat.uniforms.uGlowDir.value.set(st.glowX, 0, -0.35).normalize();
    sky.starMat.uniforms.uAlpha.value = 0.2 + 0.8 * n;
    sky.moonMat.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(n, 0.55, 0.95);
    sky.update(camera);
    region.update(camera, window.innerHeight);
    europe.update(st.map, time);

    // flash (lightning) on intro
    flash *= Math.exp(-dt * 6);
    renderer.toneMappingExposure = 1.12 + flash * 2.2;

    renderer.render(scene, camera);

    // labels
    if (labelsEl) {
      const w = window.innerWidth, h = window.innerHeight;
      for (const p of pins) {
        let o = 0;
        for (const key of p.keys) o += weightOf(key, e);
        if (p.kind === 'city' || p.kind === 'range' || p.kind === 'home') o *= THREE.MathUtils.smoothstep(st.map, 0.75, 1);
        if (o < 0.02) {
          if (p.shown) {
            p.el.style.opacity = '0';
            p.el.style.visibility = 'hidden';
            p.shown = false;
          }
          continue;
        }
        if (p.follow) p.pos.copy(traffic.heroPos).add(v.set(0, 7.5, 0));
        v.copy(p.pos).project(camera);
        if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) {
          p.el.style.visibility = 'hidden';
          p.shown = false;
          continue;
        }
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        const flip = x > w - 190;
        if (flip !== p.flip) {
          p.flip = flip;
          p.el.classList.toggle('pin--flip', flip);
        }
        p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        p.el.style.opacity = o.toFixed(3);
        if (!p.shown) {
          p.el.style.visibility = 'visible';
          p.shown = true;
        }
      }
    }

    // adaptive quality: lower the resolution if frames arrive late (target 30 fps)
    if (perf.checks < 4) {
      perf.frames++;
      perf.acc += dt;
      if (perf.frames >= 60) {
        const avg = perf.acc / perf.frames;
        perf.frames = 0;
        perf.acc = 0;
        perf.checks++;
        if (avg > 0.045 && dpr > 0.75) setDpr(Math.max(0.75, dpr - 0.25));
      }
    }
  }

  function setDpr(next) {
    dpr = next;
    renderer.setPixelRatio(dpr);
    resize();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // compile shaders before the first visible frame
  try {
    europe.group.visible = true;
    await renderer.compileAsync(scene, camera);
  } catch {
    /* compileAsync is optional */
  }
  europe.group.visible = false;
  onProgress(1);

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() - 34;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setRoute(a, b, t) {
      route.a = a;
      route.b = b;
      route.t = t;
      lastInput = performance.now();
    },
    setPointer(x, y) {
      pointer.set(x, y);
      lastInput = performance.now();
    },
    snap() {
      snapNext = true;
    },
    flash() {
      if (!reducedMotion) flash = 1;
    },
    renderOnce() {
      render(1 / 30);
    },
    quality() {
      return { dpr, checks: perf.checks };
    },
  };
}
