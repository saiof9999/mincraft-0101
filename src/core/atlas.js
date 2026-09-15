import { DEFS } from "./blocks.js";

export const TILE = 16;
export const COLS = 16;
export const ROWS = 16;

function rnd(x, y, s) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + s * 45.164) * 43758.5453;
  return n - Math.floor(n);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function rgb(r, g, b) {
  return [r, g, b, 255];
}

function speckle(px, py, base, varC, seed) {
  const t = rnd(px, py, seed) * 2 - 1;
  return [base[0] + varC[0] * t, base[1] + varC[1] * t, base[2] + varC[2] * t, 255].map((v, i) => (i === 3 ? 255 : Math.max(0, Math.min(255, v))));
}

const painters = {
  1: (x, y) => speckle(x, y, [40, 40, 45], [8, 8, 8], 1),
  2: (x, y) => speckle(x, y, [120, 120, 120], [14, 14, 14], 2),
  3: (x, y) => speckle(x, y, [110, 110, 110], [22, 22, 22], 3),
  4: (x, y) => speckle(x, y, [134, 96, 67], [16, 12, 10], 4),
  5: (x, y) => speckle(x, y, [90, 160, 55], [18, 22, 12], 5),
  6: (x, y) => {
    if (y < 3) return speckle(x, y, [90, 160, 55], [12, 16, 8], 5);
    return speckle(x, y, [134, 96, 67], [16, 12, 10], 4);
  },
  7: (x, y) => speckle(x, y, [220, 205, 140], [18, 16, 12], 7),
  8: (x, y) => speckle(x, y, [136, 126, 126], [20, 16, 16], 8),
  9: (x, y) => speckle(x, y, [145, 103, 58], [14, 10, 8], 9),
  10: (x, y) => {
    const ring = Math.abs(x - 7.5) < 3 && Math.abs(y - 7.5) < 3;
    return speckle(x, y, ring ? [90, 70, 40] : [145, 103, 58], [10, 8, 6], 10);
  },
  11: (x, y) => {
    const c = speckle(x, y, [50, 120, 40], [16, 24, 12], 11);
    c[3] = 220;
    return c;
  },
  12: (x, y) => {
    const grain = x % 4 === 0 ? -20 : 0;
    const s = speckle(x, y, [178, 142, 80], [12, 10, 8], 12);
    return [s[0] + grain, s[1] + grain, s[2] + grain, 255];
  },
  13: (x, y) => {
    const w = speckle(x, y, [40, 80, 200], [10, 16, 20], 13);
    w[3] = 160;
    return w;
  },
  14: (x, y) => speckle(x, y, [210, 90, 20], [30, 20, 8], 14),
  15: (x, y) => {
    const g = speckle(x, y, [180, 210, 220], [10, 10, 12], 15);
    g[3] = 90;
    return g;
  },
  16: (x, y) => ore(x, y, [120, 120, 120], [20, 20, 20], 2),
  17: (x, y) => ore(x, y, [210, 170, 140], [20, 20, 20], 15),
  18: (x, y) => ore(x, y, [250, 210, 70], [20, 20, 20], 16),
  19: (x, y) => ore(x, y, [80, 220, 220], [20, 20, 20], 17),
  20: (x, y) => ore(x, y, [180, 20, 20], [20, 20, 20], 18),
  21: (x, y) => speckle(x, y, [30, 30, 32], [10, 10, 10], 21),
  22: (x, y) => metal(x, y, [200, 200, 205]),
  23: (x, y) => metal(x, y, [250, 210, 50]),
  24: (x, y) => metal(x, y, [80, 230, 225]),
  25: (x, y) => speckle(x, y, [120, 80, 40], [8, 8, 6], 25),
  26: (x, y) => {
    if (y > 4 && y < 12 && x > 3 && x < 13) return speckle(x, y, [90, 70, 40], [6, 6, 6], 26);
    return speckle(x, y, [160, 120, 70], [8, 8, 6], 12);
  },
  27: (x, y) => speckle(x, y, [70, 70, 70], [8, 8, 8], 27),
  28: (x, y) => {
    if (x > 5 && x < 11 && y > 5 && y < 11) return speckle(x, y, [30, 30, 30], [4, 4, 4], 28);
    return speckle(x, y, [90, 90, 90], [8, 8, 8], 3);
  },
  29: (x, y) => speckle(x, y, [130, 90, 30], [8, 8, 6], 29),
  30: (x, y) => {
    if (x > 4 && x < 12 && y > 5 && y < 12) return speckle(x, y, [40, 24, 8], [6, 4, 2], 30);
    return speckle(x, y, [150, 110, 50], [8, 8, 6], 12);
  },
  31: (x, y) => speckle(x, y, [20, 10, 35], [8, 6, 10], 31),
  32: (x, y) => speckle(x, y, [110, 40, 40], [16, 10, 8], 32),
  33: (x, y) => speckle(x, y, [70, 20, 24], [10, 6, 6], 33),
  34: (x, y) => speckle(x, y, [70, 55, 45], [12, 8, 6], 34),
  35: (x, y) => speckle(x, y, [220, 180, 80], [24, 18, 10], 35),
  36: (x, y) => speckle(x, y, [200, 195, 140], [12, 12, 10], 36),
  37: (x, y) => {
    const s = speckle(x, y, [40, 80, 70], [8, 10, 8], 37);
    if (y < 4) return speckle(x, y, [80, 40, 90], [8, 6, 10], 37);
    return s;
  },
  38: (x, y) => {
    const p = speckle(x, y, [20, 0, 40], [20, 0, 30], 38);
    p[3] = 200;
    return p;
  },
  39: (x, y) => {
    const p = speckle(x, y, [90, 20, 180], [20, 8, 30], 39);
    p[3] = 180;
    return p;
  },
  40: (x, y) => {
    if (y > 12) return speckle(x, y, [140, 20, 20], [20, 8, 8], 40);
    return [0, 0, 0, 0];
  },
  41: (x, y) => torch(x, y, [220, 40, 40]),
  42: (x, y) => speckle(x, y, [90, 70, 50], [10, 8, 6], 42),
  43: (x, y) => speckle(x, y, [150, 140, 130], [8, 8, 8], 43),
  44: (x, y) => speckle(x, y, [90, 90, 90], [8, 8, 8], 44),
  45: (x, y) => {
    if (y < 5) return speckle(x, y, [180, 180, 180], [8, 8, 8], 45);
    return speckle(x, y, [140, 140, 140], [8, 8, 8], 2);
  },
  46: (x, y) => speckle(x, y, [180, 50, 40], [16, 10, 8], 46),
  47: (x, y) => speckle(x, y, [40, 40, 40], [8, 8, 8], 47),
  48: (x, y) => torch(x, y, [255, 200, 60]),
  49: (x, y) => {
    if (y % 5 < 3) return speckle(x, y, [80, 50, 25], [8, 6, 4], 49);
    return speckle(x, y, [160, 120, 70], [8, 8, 6], 12);
  },
  50: (x, y) => speckle(x, y, [150, 70, 55], [12, 8, 6], 50),
  51: (x, y) => speckle(x, y, [240, 245, 250], [8, 8, 8], 51),
  52: (x, y) => {
    const i = speckle(x, y, [160, 200, 230], [10, 10, 12], 52);
    i[3] = 180;
    return i;
  },
  53: (x, y) => speckle(x, y, [30, 120, 40], [10, 16, 8], 53),
  54: (x, y) => speckle(x, y, [20, 90, 30], [8, 12, 6], 54),
  55: (x, y) => speckle(x, y, [150, 155, 170], [10, 10, 12], 55),
  56: (x, y) => speckle(x, y, [110, 70, 40], [10, 8, 6], 56),
  57: (x, y) => {
    if ((x + y) % 3 === 0) return speckle(x, y, [200, 190, 60], [8, 8, 6], 57);
    return [0, 0, 0, 0];
  },
  58: (x, y) => speckle(x, y, [60, 170, 70], [10, 16, 8], 58),
  59: (x, y) => speckle(x, y, [230, 230, 230], [8, 8, 8], 59),
  60: (x, y) => speckle(x, y, [122, 122, 122], [10, 10, 10], 60),
  61: (x, y) => speckle(x, y, [90, 110, 80], [12, 14, 10], 61),
  62: (x, y) => speckle(x, y, [235, 230, 220], [8, 8, 6], 62),
  63: (x, y) => speckle(x, y, [50, 160, 50], [12, 16, 10], 63),
  64: (x, y) => speckle(x, y, [210, 130, 30], [14, 10, 6], 64),
  65: (x, y) => speckle(x, y, [200, 200, 70], [12, 12, 8], 65),
  66: (x, y) => ore(x, y, [250, 210, 70], [110, 40, 40], 59),
  67: (x, y) => speckle(x, y, [70, 50, 45], [10, 8, 6], 67),
  68: (x, y) => speckle(x, y, [30, 130, 120], [8, 12, 10], 68),
  69: (x, y) => speckle(x, y, [140, 40, 50], [12, 8, 8], 69),
  70: (x, y) => speckle(x, y, [90, 50, 110], [12, 8, 14], 70),
  71: (x, y) => speckle(x, y, [160, 100, 160], [10, 8, 10], 71),
  72: (x, y) => speckle(x, y, [20, 10, 30], [20, 8, 24], 72),
  73: (x, y) => speckle(x, y, [120, 120, 120], [8, 8, 8], 73),
  74: (x, y) => speckle(x, y, [250, 230, 140], [12, 10, 8], 74),
  75: (x, y) => speckle(x, y, [180, 180, 180], [8, 8, 8], 75),
  76: (x, y) => {
    const f = speckle(x, y, [255, 140, 20], [30, 40, 10], 76);
    if (rnd(x, y, 9) < 0.3) f[3] = 0;
    return f;
  },
};

function ore(x, y, col, stone, seed) {
  const vein = rnd(x, y, seed) > 0.72 || rnd(x + 1, y, seed) > 0.85;
  return speckle(x, y, vein ? col : [120, 120, 120], [14, 14, 14], seed);
}

function metal(x, y, col) {
  const border = x === 0 || y === 0 || x === 15 || y === 15;
  const c = border ? col.map((v) => v * 0.7) : col;
  return speckle(x, y, c, [10, 10, 10], col[0]);
}

function torch(x, y, flame) {
  if (y < 6 && Math.abs(x - 8) < 3) return speckle(x, y, flame, [20, 20, 10], 48);
  if (y >= 6 && Math.abs(x - 8) < 2) return speckle(x, y, [90, 60, 30], [6, 6, 4], 48);
  return [0, 0, 0, 0];
}

function itemIcon(id, x, y) {
  const hue = (id * 47) % 255;
  if (id >= 113 && id <= 128) {
    const blade = y < 9 && Math.abs(x - 8) < 2;
    const handle = y >= 9 && Math.abs(x - 8) < 1;
    if (blade) return speckle(x, y, [180, 180, 190], [8, 8, 8], id);
    if (handle) return speckle(x, y, [120, 80, 40], [6, 6, 4], id);
    if (id >= 125 && y < 11 && x > 4 && x < 12) return speckle(x, y, [200, 200, 210], [8, 8, 8], id);
  }
  if (id === 129) {
    if (x < 4 || y > 12) return speckle(x, y, [120, 80, 40], [8, 6, 4], 129);
    if (x > 12) return speckle(x, y, [200, 200, 200], [6, 6, 6], 129);
  }
  return speckle(x, y, [80 + (hue % 120), 70, 180 - (hue % 80)], [16, 12, 16], id);
}

export function createAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(canvas.width, canvas.height);

  function setPx(x, y, c) {
    const i = (y * canvas.width + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = c[3] ?? 255;
  }

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const idx = ty * COLS + tx;
      const fn = painters[idx] || ((x, y) => itemIcon(idx, x, y));
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          setPx(tx * TILE + px, ty * TILE + py, fn(px, py));
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function tileUV(tile) {
  const tx = tile % COLS;
  const ty = Math.floor(tile / COLS);
  const u0 = tx / COLS + 0.001;
  const v0 = 1 - (ty + 1) / ROWS + 0.001;
  const u1 = (tx + 1) / COLS - 0.001;
  const v1 = 1 - ty / ROWS - 0.001;
  return [u0, v0, u1, v1];
}

export function tilesFor(id) {
  const d = DEFS[id];
  if (!d) return [2, 2, 2];
  const t = d.tile ?? 2;
  if (Array.isArray(t)) return t;
  return [t, t, t];
}

export function iconCanvas(id, atlas) {
  const d = DEFS[id];
  const tile = Array.isArray(d?.tile) ? d.tile[2] ?? d.tile[0] : d?.tile ?? 80;
  const tx = tile % COLS;
  const ty = Math.floor(tile / COLS);
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, tx * 16, ty * 16, 16, 16, 0, 0, 16, 16);
  return c;
}
