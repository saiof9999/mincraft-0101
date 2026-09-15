export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + (seed | 0);
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed) {
  return hash2(x, y * 1013 + z, seed);
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  return n00 * (1 - fx) * (1 - fy) + n10 * fx * (1 - fy) + n01 * (1 - fx) * fy + n11 * fx * fy;
}

export function fbm2(x, y, seed, oct = 5) {
  let a = 1;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += valueNoise2(x * f, y * f, seed + i * 19) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

export function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const fz = fade(z - z0);
  const n = (ix, iy, iz) => hash3(ix, iy, iz, seed);
  const x00 = n(x0, y0, z0) * (1 - fx) + n(x0 + 1, y0, z0) * fx;
  const x10 = n(x0, y0 + 1, z0) * (1 - fx) + n(x0 + 1, y0 + 1, z0) * fx;
  const x01 = n(x0, y0, z0 + 1) * (1 - fx) + n(x0 + 1, y0, z0 + 1) * fx;
  const x11 = n(x0, y0 + 1, z0 + 1) * (1 - fx) + n(x0 + 1, y0 + 1, z0 + 1) * fx;
  const y0v = x00 * (1 - fy) + x10 * fy;
  const y1v = x01 * (1 - fy) + x11 * fy;
  return y0v * (1 - fz) + y1v * fz;
}
