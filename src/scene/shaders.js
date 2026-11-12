import * as THREE from 'three';

/**
 * ShaderMaterial that renders straight to the screen (no post-processing pass):
 * adds the renderer's tone mapping and sRGB output at the end of the fragment shader.
 */
export function M(params) {
  const out = '\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}';
  return new THREE.ShaderMaterial({ ...params, fragmentShader: params.fragmentShader.replace(/\}\s*$/, out) });
}

// Uniforms shared by every custom material (fog, time, time of night).
export const shared = {
  uTime: { value: 0 },
  uNight: { value: 0 }, // 0 = evening, 1 = deep night (fewer lit windows)
  uFogColor: { value: new THREE.Color('#0a1830') },
  uFogDensity: { value: 0.0026 },
  uMap: { value: 0 }, // 1 = Europe map view (map grid visible)
};

export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uMap;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 applyFog(vec3 col, vec3 w){
  float d = distance(cameraPosition, w);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
float band(float x, float a, float b, float aa){ return smoothstep(a - aa, a + aa, x) * (1.0 - smoothstep(b - aa, b + aa, x)); }
`;

/* ---------------------------------------------------------------- buildings */
// instanceColor carries parameters: r = lit bias, g = style (0 tower, .33 mid, .66 house, 1 warehouse), b = crown light (0 none, .5 blue, 1 orange)
export function buildingMaterial() {
  return M({
    uniforms: { ...shared },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vW; varying vec3 vN; varying vec3 vPar; varying float vTop; varying float vSeed;
      void main(){
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(m) * normal);
        vTop = (m * vec4(0.0, 1.0, 0.0, 1.0)).y;
        vPar = instanceColor;
        vSeed = aSeed;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vW; varying vec3 vN; varying vec3 vPar; varying float vTop; varying float vSeed;
      void main(){
        vec3 n = normalize(vN);
        float style = vPar.g;
        vec3 L = normalize(vec3(-0.45, 0.55, -0.7));
        float diff = max(dot(n, L), 0.0);
        float y = vW.y;
        float hgt = max(vTop, 1.0);
        vec3 base = mix(vec3(0.009, 0.016, 0.033), vec3(0.02, 0.026, 0.04), step(0.5, style));
        vec3 col = base * (0.7 + 0.9 * diff);
        col += vec3(0.16, 0.07, 0.025) * exp(-y * 0.3) * 0.5; // warm street bounce
        if (n.y > 0.5) {
          col = vec3(0.011, 0.018, 0.034) + vec3(0.008, 0.012, 0.024) * diff;
        } else {
          float u = abs(n.x) > 0.5 ? vW.z : vW.x;
          // facade type: punched windows, office ribbons or full curtain wall
          float type = style < 0.2 ? fract(vSeed * 7.13) : 0.0;
          vec2 cs = vec2(2.9, 3.1); vec2 lo = vec2(0.24, 0.3); vec2 hi = vec2(0.76, 0.82); float chunk = 1.0;
          if (style < 0.2) {
            if (type < 0.4) { cs = vec2(2.3, 3.5); lo = vec2(0.15, 0.22); hi = vec2(0.85, 0.84); }
            else if (type < 0.75) { cs = vec2(1.6, 3.6); lo = vec2(0.05, 0.3); hi = vec2(0.95, 0.88); chunk = 5.0; }
            else { cs = vec2(1.5, 3.6); lo = vec2(0.04, 0.07); hi = vec2(0.96, 0.96); chunk = 6.0; }
          } else if (style > 0.5) { cs = vec2(2.6, 2.6); lo = vec2(0.27, 0.33); hi = vec2(0.73, 0.8); }
          vec2 cell = vec2(u, y - 0.5) / cs;
          vec2 id = floor(cell); vec2 f = fract(cell);
          vec2 aa = fwidth(cell) * 1.1;
          float win = band(f.x, lo.x, hi.x, aa.x) * band(f.y, lo.y, hi.y, aa.y);
          win *= step(y, vTop - 1.1) * step(style < 0.5 ? 3.4 : 0.9, y);
          win *= 1.0 - step(0.95, style);
          float side = floor(n.x * 3.0 + n.z * 5.0);
          vec2 lid = vec2(floor(id.x / chunk), id.y);
          float h = hash12(lid + vec2(vSeed * 91.7, side * 17.0));
          float ratio = mix(0.5, 0.2, uNight) * (0.6 + vPar.r * 0.8);
          if (style > 0.5 && style < 0.95) ratio = mix(0.72, 0.3, uNight);
          float lit = step(h, ratio);
          float h2 = hash12(lid * 1.37 + vec2(4.1, vSeed * 3.0));
          float coolP = style > 0.5 ? 0.9 : (type >= 0.4 ? 0.3 : 0.62);
          vec3 wc = mix(vec3(1.0, 0.5, 0.17), vec3(0.55, 0.72, 1.0), step(coolP, h2));
          wc *= (0.45 + 0.45 * hash12(id + 7.7)) * (0.85 + 0.3 * (1.0 - f.y));
          vec3 glass = vec3(0.005, 0.01, 0.022) + vec3(0.012, 0.022, 0.045) * smoothstep(0.0, hgt, y) * (0.5 + diff);
          col = mix(col, mix(glass, wc, lit), win);
          if (style < 0.5) { // shop fronts
            float sh = hash12(vec2(floor(u / 6.0), vSeed * 31.0));
            float shop = band(y, 0.7, 2.9, 0.05) * band(fract(u / 6.0), 0.08, 0.92, 0.02) * step(sh, 0.7);
            col = mix(col, mix(vec3(1.0, 0.48, 0.14), vec3(0.6, 0.8, 1.0), step(0.45, sh)) * 1.05, shop);
          }
          if (style > 0.95) { // warehouse: dock doors + clerestory
            float du = fract(u / 8.0);
            float door = band(du, 0.2, 0.75, 0.01) * step(y, 4.4);
            col = mix(col, vec3(1.0, 0.68, 0.32) * 1.7, door);
            float strip = band(y, vTop - 2.7, vTop - 1.7, 0.02) * step(0.5, fract(u / 3.0));
            col = mix(col, vec3(0.55, 0.72, 1.0) * 0.9, strip);
          }
          float cr = step(0.25, vPar.b) * band(y, vTop - 1.5, vTop - 0.45, 0.04);
          vec3 crc = vPar.b > 0.75 ? vec3(1.0, 0.4, 0.02) : vec3(0.25, 0.55, 1.0);
          col = mix(col, crc * 2.6, cr);
        }
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
}

/* ------------------------------------------------------------------- ground */
export function groundMaterial({ P, R, C, YARD, SIDEWALK, PARK, HIGHWAY, floods }) {
  return M({
    uniforms: {
      ...shared,
      uFloods: { value: floods }, // yard flood light positions (xz)
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec2 uFloods[6];
      varying vec3 vW;
      const float P = ${P.toFixed(1)}; const float HW = ${(R / 2).toFixed(2)}; const float CS = ${C.toFixed(1)};
      const float SW = ${SIDEWALK.toFixed(2)};
      const vec4 YARD = vec4(${YARD.x0.toFixed(2)}, ${YARD.z0.toFixed(2)}, ${YARD.x1.toFixed(2)}, ${YARD.z1.toFixed(2)});
      const vec2 PARK = vec2(${PARK.x.toFixed(1)}, ${PARK.z.toFixed(1)});
      const float HR = ${HIGHWAY.radius.toFixed(1)};
      float gridLine(float c, float spacing, float width){
        float fw = fwidth(c);
        float a = abs(fract(c / spacing - 0.5) - 0.5) * spacing;
        float line = 1.0 - smoothstep(width, width + fw * 1.5, a);
        return line * (1.0 - smoothstep(spacing * 0.03, spacing * 0.12, fw));
      }
      void main(){
        vec2 p = vW.xz;
        vec2 fw = fwidth(p);
        float aa = max(fw.x, fw.y);
        float box = max(abs(p.x), abs(p.y));
        float inCity = 1.0 - smoothstep(CS + HW + SW - aa, CS + HW + SW + aa, box);
        float inYard = step(YARD.x, p.x) * step(p.x, YARD.z) * step(YARD.y, p.y) * step(p.y, YARD.w);
        vec2 m = abs(mod(p + P * 0.5, P) - P * 0.5);
        float roadV = 1.0 - smoothstep(HW - aa, HW + aa, m.x);
        float roadH = 1.0 - smoothstep(HW - aa, HW + aa, m.y);
        float streets = inCity * (1.0 - inYard);
        float road = max(roadV, roadH) * streets;
        float walk = max(1.0 - smoothstep(HW + SW - aa, HW + SW + aa, m.x), 1.0 - smoothstep(HW + SW - aa, HW + SW + aa, m.y)) * streets;

        // countryside: very dark with a faint survey grid
        vec3 col = vec3(0.007, 0.013, 0.024);
        float survey = max(gridLine(p.x, 64.0, 0.15), gridLine(p.y, 64.0, 0.15));
        col += vec3(0.02, 0.04, 0.075) * survey * (1.0 - inCity) * (1.0 - uMap);
        // map grid (1° of latitude) for the Europe view
        float mg = max(gridLine(p.x, 280.0, 1.0), gridLine(p.y, 280.0, 1.0));
        col += vec3(0.025, 0.05, 0.1) * mg * uMap;

        vec3 lot = vec3(0.014, 0.022, 0.04);
        bool homes = p.x < -100.0 && p.y > -68.0;
        bool park = abs(p.x - PARK.x) < P * 0.5 - HW && abs(p.y - PARK.y) < P * 0.5 - HW;
        if (homes || park) lot = vec3(0.01, 0.027, 0.02);
        col = mix(col, lot, inCity);
        col = mix(col, vec3(0.045, 0.058, 0.082), walk);
        col = mix(col, vec3(0.02, 0.027, 0.04), road);

        // lane markings + zebra crossings
        float dashH = (1.0 - smoothstep(0.1, 0.1 + aa, m.y)) * step(fract(p.x / 7.0), 0.55) * step(HW + SW, m.x);
        float dashV = (1.0 - smoothstep(0.1, 0.1 + aa, m.x)) * step(fract(p.y / 7.0), 0.55) * step(HW + SW, m.y);
        float zH = step(HW + 0.5, m.x) * step(m.x, HW + 2.6) * step(m.y, HW - 0.7) * step(fract(p.y / 1.1), 0.5) * roadH;
        float zV = step(HW + 0.5, m.y) * step(m.y, HW + 2.6) * step(m.x, HW - 0.7) * step(fract(p.x / 1.1), 0.5) * roadV;
        float marks = max(max(dashH, dashV), max(zH, zV)) * streets;
        col = mix(col, vec3(0.13, 0.14, 0.16), marks * (1.0 - smoothstep(4.0, 12.0, aa * 60.0)));

        // logistics yard: concrete, yellow lane lines, parking bays
        vec3 yard = vec3(0.03, 0.036, 0.05);
        float bays = step(fract((p.x - 2.0) / 4.4), 0.05) * band(p.y, -70.0, -50.0, aa);
        float yl = max(band(p.y, -168.0, -167.6, aa), band(p.x, 104.0, 104.4, aa));
        yard = mix(yard, vec3(0.6, 0.48, 0.06), yl * 0.8);
        yard = mix(yard, vec3(0.35, 0.37, 0.42), bays);
        col = mix(col, yard, inYard);

        // street light pools at intersections + yard flood lights
        float pool = exp(-dot(m, m) / 70.0) * streets;
        float flood = 0.0;
        if (inYard > 0.5) for (int i = 0; i < 6; i++) { vec2 d = p - uFloods[i]; flood += exp(-dot(d, d) / 520.0); }
        col += vec3(1.0, 0.5, 0.16) * pool * 0.22;
        col += vec3(1.0, 0.82, 0.55) * flood * 0.16 * inYard;
        // soft orange glow under the elevated ring road
        float r = length(p);
        float dr = r - HR; // never pow() a negative base: NaN on D3D, and bloom spreads it over the screen
        col += vec3(1.0, 0.45, 0.08) * exp(-dr * dr / 300.0) * 0.06;

        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
}

/* ----------------------------------------------------------------- highway */
// uv.x = metres along the road, uv.y = 0..1 across. Edge lines glow orange.
export function highwayMaterial(width, fade = [1e9, 2e9]) {
  return M({
    uniforms: { ...shared, uFade: { value: new THREE.Vector2(fade[0], fade[1]) } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec2 uFade;
      varying vec3 vW; varying vec2 vUv;
      void main(){
        if (vUv.x > uFade.y) discard;
        float W = ${width.toFixed(1)};
        float a = (vUv.y - 0.5) * W;
        float aw = fwidth(a) * 1.2;
        float ax = abs(a);
        vec3 col = vec3(0.024, 0.032, 0.048);
        float dash = band(ax, 4.85, 5.15, aw) * step(fract(vUv.x / 9.0), 0.5);
        col = mix(col, vec3(0.5, 0.53, 0.58), dash);
        col = mix(col, vec3(0.2, 0.22, 0.26), band(ax, 0.0, 0.7, aw));
        float edge = band(ax, W * 0.5 - 0.75, W * 0.5 - 0.35, aw);
        float pulse = 0.85 + 0.15 * sin(vUv.x * 0.05 - uTime * 3.0);
        col = mix(col, vec3(1.0, 0.42, 0.02) * 3.2 * pulse, edge);
        col = mix(col, vec3(0.007, 0.013, 0.024), smoothstep(uFade.x, uFade.y, vUv.x));
        gl_FragColor = vec4(applyFog(col, vW), 1.0);
      }`,
  });
}

/* ------------------------------------------------------------------- trails */
// Long-exposure light trails behind vehicles. uv.y: 0 at the vehicle, 1 at the tail end.
export function trailMaterial() {
  return M({
    uniforms: { ...shared },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vCol; varying vec3 vW;
      void main(){
        vUv = uv; vCol = instanceColor;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec2 vUv; varying vec3 vCol; varying vec3 vW;
      void main(){
        float along = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6);
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = along * smoothstep(0.0, 0.8, across);
        float d = distance(cameraPosition, vW);
        float fog = exp(-uFogDensity * uFogDensity * d * d);
        gl_FragColor = vec4(vCol * a * 2.4 * fog, 1.0);
      }`,
  });
}

/* --------------------------------------------------------------------- sky */
export function skyMaterial() {
  return M({
    uniforms: {
      ...shared,
      uTop: { value: new THREE.Color('#050b1a') },
      uHorizon: { value: new THREE.Color('#1a2e57') },
      uGlow: { value: new THREE.Color('#ff6a10') },
      uGlowAmt: { value: 1 },
      uGlowDir: { value: new THREE.Vector3(-1, 0, -0.3).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uGlowAmt; uniform vec3 uGlowDir; uniform vec3 uFogColor;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.42));
        vec2 hd = normalize(d.xz + 1e-5);
        float g = pow(max(dot(hd, normalize(uGlowDir.xz)), 0.0), 4.0);
        col += uGlow * g * exp(-max(h, 0.0) * 10.0) * uGlowAmt * 0.9;
        col += uGlow * exp(-max(h, 0.0) * 30.0) * uGlowAmt * 0.12;
        col = mix(col, uFogColor, smoothstep(0.02, -0.04, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function starsMaterial() {
  return M({
    uniforms: { ...shared, uAlpha: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      uniform float uTime;
      varying float vTw;
      void main(){
        vTw = 0.6 + 0.4 * sin(uTime * (0.8 + aPhase) + aPhase * 30.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; varying float vTw;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vTw * uAlpha, 1.0);
      }`,
  });
}

/* ---------------------------------------------------- distant ground lights */
export function cityLightsMaterial() {
  return M({
    uniforms: { ...shared, uScale: { value: 600 }, uGain: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 aColor;
      uniform float uScale; uniform float uGain;
      varying vec3 vC; varying vec3 vW;
      void main(){
        vC = aColor * uGain;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        gl_PointSize = clamp(aSize * uScale / -mv.z, 1.5, 6.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying vec3 vC; varying vec3 vW;
      void main(){
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, r);
        float d = distance(cameraPosition, vW);
        float fog = exp(-uFogDensity * uFogDensity * d * d * 0.5);
        gl_FragColor = vec4(vC * a * fog, 1.0);
      }`,
  });
}

/* ------------------------------------------------------------ Europe layer */
export function arcMaterial() {
  return M({
    uniforms: { uTime: shared.uTime, uProgress: { value: 0 }, uAlpha: { value: 0 }, uOffset: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uProgress; uniform float uAlpha; uniform float uOffset;
      varying vec2 vUv;
      void main(){
        float drawn = 1.0 - smoothstep(uProgress - 0.02, uProgress, vUv.x);
        float pd = (fract(vUv.x - uTime * 0.22 - uOffset) - 0.5) * 9.0;
        float pulse = exp(-pd * pd);
        vec3 col = mix(vec3(1.0, 0.38, 0.0), vec3(1.0, 0.82, 0.1), vUv.x);
        float a = (0.55 + 1.6 * pulse) * drawn * uAlpha;
        gl_FragColor = vec4(col * a * 1.8, 1.0);
      }`,
  });
}

export function ringMaterial(color = '#7fb2ff', dashed = true) {
  return M({
    uniforms: { uTime: shared.uTime, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(color) }, uDashed: { value: dashed ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uColor; uniform float uDashed; uniform float uTime;
      varying vec3 vP;
      void main(){
        float ang = atan(vP.y, vP.x);
        float dash = mix(1.0, step(0.5, fract(ang * 40.0 / 6.2831 + uTime * 0.05)), uDashed);
        gl_FragColor = vec4(uColor * dash * uAlpha, 1.0);
      }`,
  });
}

export function beamMaterial(color = '#ffb020') {
  return M({
    uniforms: { uAlpha: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float b = clamp(1.0 - vUv.y, 0.0, 1.0); float a = b * b * uAlpha; gl_FragColor = vec4(uColor * a * 1.6, 1.0); }`,
  });
}

export function glowSpriteMaterial(color, strength = 1) {
  return M({
    uniforms: { uAlpha: { value: 1 }, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float disc = smoothstep(0.36, 0.33, r);
        float halo = exp(-r * 4.0) * 0.6 * (1.0 - smoothstep(0.6, 1.0, r));
        gl_FragColor = vec4(uColor * (disc * 1.3 + halo) * uAlpha * uStrength, 1.0);
      }`,
  });
}
