// City layout shared by world, vehicles and camera.
// Units are roughly metres. +x = east, -z = north, y = up.

export const P = 32; // road pitch (block + road)
export const R = 9; // road width
export const SIDEWALK = 1.6;
export const C = 224; // half size of the street grid (outer ring road at ±C)
export const LOT = P / 2 - R / 2 - SIDEWALK; // half size of a building lot (9.9)

// Logistics yard (no streets inside): x0, z0, x1, z1
export const YARD = { x0: 96 + R / 2, z0: -C + R / 2, x1: C - R / 2, z1: -32 - R / 2 };

export const HQ = { x: 112, z: -16, w: 20, d: 15, h: 24 };
export const HOME = { x: -112, z: 16 }; // block of the moving scene
export const PARK = { x: -48, z: 48 };

export const HIGHWAY = { radius: 282, wobble: 9, y: 9, width: 18 };

export function blockKind(bx, bz) {
  if (bx > YARD.x0 && bz < YARD.z1) return 'yard';
  if (bx === HQ.x && bz === HQ.z) return 'hq';
  if (bx === PARK.x && bz === PARK.z) return 'park';
  if (bx <= -112 && bz >= -48) return 'homes';
  if (Math.max(Math.abs(bx), Math.abs(bz)) <= 80) return 'downtown';
  return 'mid';
}

// Deterministic random numbers so the city looks the same on every visit.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Europe map: degrees → scene units around Germersheim.
export const ORIGIN = { lat: 49.22, lon: 8.37 };
export const K = 280; // units per degree of latitude
export function geo(lat, lon) {
  const x = (lon - ORIGIN.lon) * Math.cos((ORIGIN.lat * Math.PI) / 180) * K;
  const z = -(lat - ORIGIN.lat) * K;
  return { x, z };
}
export const KM = K / 111.2; // units per km
