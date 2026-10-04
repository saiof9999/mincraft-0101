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
  2: (x, y) => (rnd(x, y, 12) > 0.88 ? speckle(x, y, [96, 96, 100], [8, 8, 8], 2) : speckle(x, y, [124, 124, 126], [10, 10, 10], 2)),
  3: (x, y) => (x % 6 === 0 || y % 6 === 0 ? speckle(x, y, [78, 78, 80], [6, 6, 6], 3) : speckle(x, y, [122, 122, 124], [14, 14, 14], 3)),
  4: (x, y) => speckle(x, y, [134, 96, 67], [16, 12, 10], 4),
  5: (x, y) => (rnd(x, y, 51) > 0.78 ? speckle(x, y, [118, 188, 74], [10, 14, 8], 5) : speckle(x, y, [88, 156, 54], [12, 16, 10], 5)),
  6: (x, y) => {
    if (y < 3) return speckle(x, y, [90, 160, 55], [12, 16, 8], 5);
    return speckle(x, y, [134, 96, 67], [16, 12, 10], 4);
  },
  7: (x, y) => speckle(x, y, [220, 205, 140], [18, 16, 12], 7),
  8: (x, y) => { const c = rnd(Math.floor(x / 3), Math.floor(y / 3), 8); return speckle(x, y, c > 0.6 ? [152, 144, 142] : c > 0.3 ? [120, 112, 112] : [96, 90, 90], [8, 8, 8], 8); },
  9: (x, y) => speckle(x, y, [145, 103, 58], [14, 10, 8], 9),
  10: (x, y) => {
    const ring = Math.abs(x - 7.5) < 3 && Math.abs(y - 7.5) < 3;
    return speckle(x, y, ring ? [90, 70, 40] : [145, 103, 58], [10, 8, 6], 10);
  },
  11: (x, y) => {
    if (rnd(x, y, 11) > 0.86) return [0, 0, 0, 0];
    const c = speckle(x, y, [56, 126, 44], [16, 24, 12], 11);
    c[3] = 235;
    return c;
  },
  12: (x, y) => {
    if (y % 4 === 3) return speckle(x, y, [136, 106, 58], [6, 5, 4], 12);
    const knot = (x === 7 && y % 8 < 2) || (x === 3 && y % 8 > 4 && y % 8 < 6);
    return speckle(x, y, knot ? [150, 116, 62] : [181, 145, 83], [10, 8, 6], 12);
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
  36: (x, y) => (rnd(x, y, 36) > 0.8 ? speckle(x, y, [176, 170, 116], [6, 6, 6], 36) : speckle(x, y, [206, 200, 148], [8, 8, 8], 36)),
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
  42: (x, y) => ((x === 3 || x === 12) && (y === 3 || y === 12) ? speckle(x, y, [60, 44, 30], [4, 4, 4], 42) : speckle(x, y, [104, 80, 58], [10, 8, 6], 42)),
  43: (x, y) => { if (y < 4) return speckle(x, y, [196, 190, 178], [6, 6, 6], 43); if (Math.abs(x - 5) < 1 && y > 6 && y < 10) return speckle(x, y, [226, 60, 40], [8, 6, 6], 43); if (Math.abs(x - 11) < 1 && y > 6 && y < 10) return speckle(x, y, [110, 110, 114], [6, 6, 6], 43); return speckle(x, y, [168, 158, 148], [8, 8, 8], 43); },
  44: (x, y) => { const dx = x - 8, dy = y - 10; if (dx * dx + dy * dy < 22) return speckle(x, y, [112, 112, 116], [8, 8, 8], 44); if (Math.abs(x - 8 + (12 - y) * 0.4) < 1 && y > 2 && y < 10) return speckle(x, y, [140, 102, 58], [8, 6, 4], 44); return [0, 0, 0, 0]; },
  45: (x, y) => (y < 4 ? speckle(x, y, [168, 134, 84], [8, 6, 4], 45) : speckle(x, y, [146, 146, 150], [10, 10, 10], 45)),
  46: (x, y) => speckle(x, y, [180, 50, 40], [16, 10, 8], 46),
  47: (x, y) => speckle(x, y, [40, 40, 40], [8, 8, 8], 47),
  48: (x, y) => torch(x, y, [255, 200, 60]),
  49: (x, y) => {
    if (y % 5 < 3) return speckle(x, y, [80, 50, 25], [8, 6, 4], 49);
    return speckle(x, y, [160, 120, 70], [8, 8, 6], 12);
  },
  50: (x, y) => {
    const row = Math.floor(y / 4);
    const off = row % 2 ? 2 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 0) return speckle(x, y, [188, 180, 170], [6, 6, 6], 50);
    return speckle(x, y, [158, 78, 62], [12, 8, 6], 50);
  },
  51: (x, y) => (rnd(x, y, 51) > 0.85 ? speckle(x, y, [255, 255, 255], [0, 0, 0], 51) : speckle(x, y, [238, 244, 250], [6, 6, 6], 51)),
  52: (x, y) => {
    const i = speckle(x, y, [160, 200, 230], [10, 10, 12], 52);
    i[3] = 180;
    return i;
  },
  53: (x, y) => speckle(x, y, [30, 120, 40], [10, 16, 8], 53),
  54: (x, y) => speckle(x, y, [20, 90, 30], [8, 12, 6], 54),
  55: (x, y) => speckle(x, y, [154, 160, 176], [6, 8, 10], 55),
  56: (x, y) => speckle(x, y, [110, 70, 40], [10, 8, 6], 56),
  57: (x, y) => {
    if ((x + y) % 3 === 0) return speckle(x, y, [200, 190, 60], [8, 8, 6], 57);
    return [0, 0, 0, 0];
  },
  58: (x, y) => (Math.abs(x - 8) < 4 ? speckle(x, y, x % 4 === 1 ? [46, 140, 52] : [74, 190, 84], [10, 12, 8], 58) : [0, 0, 0, 0]),
  59: (x, y) => ((x + y) % 4 < 2 ? speckle(x, y, [238, 238, 238], [5, 5, 5], 59) : speckle(x, y, [216, 216, 220], [5, 5, 5], 59)),
  60: (x, y) => (x % 8 === 0 || y % 4 === 0 ? speckle(x, y, [88, 88, 90], [6, 6, 6], 60) : speckle(x, y, [130, 130, 132], [10, 10, 10], 60)),
  61: (x, y) => speckle(x, y, [90, 110, 80], [12, 14, 10], 61),
  62: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? speckle(x, y, [210, 205, 195], [4, 4, 4], 62) : speckle(x, y, [238, 234, 226], [5, 5, 4], 62)),
  63: (x, y) => (x % 8 < 3 ? speckle(x, y, [70, 176, 60], [10, 12, 8], 63) : speckle(x, y, [196, 214, 110], [10, 10, 8], 63)),
  64: (x, y) => (x % 6 === 0 ? speckle(x, y, [166, 100, 20], [8, 6, 4], 64) : speckle(x, y, [220, 138, 32], [12, 8, 6], 64)),
  65: (x, y) => (rnd(x, y, 65) > 0.82 ? speckle(x, y, [150, 148, 52], [6, 6, 4], 65) : speckle(x, y, [206, 204, 82], [10, 10, 8], 65)),
  66: (x, y) => ore(x, y, [250, 210, 70], [110, 40, 40], 59),
  67: (x, y) => speckle(x, y, [70, 50, 45], [10, 8, 6], 67),
  68: (x, y) => speckle(x, y, [30, 130, 120], [8, 12, 10], 68),
  69: (x, y) => speckle(x, y, [140, 40, 50], [12, 8, 8], 69),
  70: (x, y) => speckle(x, y, [90, 50, 110], [12, 8, 14], 70),
  71: (x, y) => speckle(x, y, x % 8 === 0 || y % 8 === 0 ? [130, 78, 130] : [170, 108, 170], [8, 8, 10], 71),
  72: (x, y) => speckle(x, y, [20, 10, 30], [20, 8, 24], 72),
  73: (x, y) => { const dx = x - 8, dy = y - 8; return dx * dx + dy * dy < 34 ? speckle(x, y, [128, 128, 132], [8, 8, 8], 73) : [0, 0, 0, 0]; },
  74: (x, y) => { const dx = x - 8, dy = y - 8; return dx * dx + dy * dy < 20 ? speckle(x, y, [255, 250, 200], [6, 6, 6], 74) : speckle(x, y, [196, 168, 96], [8, 8, 6], 74); },
  75: (x, y) => (y < 6 ? speckle(x, y, [168, 134, 84], [8, 6, 4], 75) : speckle(x, y, [156, 156, 160], [10, 10, 10], 75)),
  76: (x, y) => {
    const f = speckle(x, y, [255, 140, 20], [30, 40, 10], 76);
    if (rnd(x, y, 9) < 0.3) f[3] = 0;
    return f;
  },
  // ---- item icons (real pixel art for every item) ----
  80: (x, y) => (Math.abs(x - y + 2) < 2 && x > 2 && x < 13 ? speckle(x, y, [154, 110, 64], [10, 8, 5], 80) : [0, 0, 0, 0]),
  81: (x, y) => { const dx = x - 8, dy = y - 8; return dx * dx + dy * dy < 26 ? speckle(x, y, rnd(x, y, 81) > 0.75 ? [74, 74, 80] : [38, 38, 42], [8, 8, 8], 81) : [0, 0, 0, 0]; },
  82: (x, y) => { const dx = x - 8, dy = y - 9; return dx * dx + dy * dy < 28 ? speckle(x, y, rnd(x, y, 82) > 0.7 ? [140, 116, 100] : [190, 164, 144], [10, 8, 8], 82) : [0, 0, 0, 0]; },
  83: (x, y) => ingot(x, y, [212, 214, 220], [242, 244, 248], [158, 160, 168]),
  84: (x, y) => ingot(x, y, [246, 206, 62], [255, 236, 130], [198, 158, 40]),
  85: (x, y) => gem(x, y, [92, 228, 222]),
  86: (x, y) => (x > 3 && x < 13 && y > 4 && y < 13 && rnd(x, y, 86) > 0.55 ? speckle(x, y, [216, 42, 30], [20, 10, 8], 86) : [0, 0, 0, 0]),
  87: (x, y) => (x > 3 && x < 13 && y > 5 && y < 13 && rnd(x, y, 87) > 0.55 ? speckle(x, y, [116, 116, 122], [12, 12, 12], 87) : [0, 0, 0, 0]),
  88: (x, y) => (Math.abs(x - y + 1) < 1 && x > 3 && x < 12 ? speckle(x, y, [238, 238, 238], [8, 8, 8], 88) : [0, 0, 0, 0]),
  89: (x, y) => (x > 3 && x < 12 && y > 3 && y < 13 && !(x < 5 && y < 6) && !(x > 9 && y > 10) ? speckle(x, y, [172, 110, 58], [12, 10, 8], 89) : [0, 0, 0, 0]),
  90: (x, y) => (y > 3 + Math.abs(x - 8) * 1.1 && y < 13 && Math.abs(x - 8) < 5 ? speckle(x, y, [54, 54, 60], [10, 10, 10], 90) : [0, 0, 0, 0]),
  91: (x, y) => { const dx = x - 7, dy = y - 8; const r = dx * dx + dy * dy; if (r < 30 && (r > 10 || Math.abs(dy) > 2 || dx < -1)) return speckle(x, y, [198, 200, 208], [10, 10, 10], 91); if (x > 10 && y > 9) return speckle(x, y, [54, 54, 60], [10, 10, 10], 91); return [0, 0, 0, 0]; },
  92: pick([150, 108, 62]),
  93: pick([138, 138, 142]),
  94: pick([218, 220, 226]),
  95: pick([98, 230, 220]),
  96: axe([150, 108, 62]),
  97: axe([138, 138, 142]),
  98: axe([218, 220, 226]),
  99: axe([98, 230, 220]),
  100: shovel([150, 108, 62]),
  101: shovel([138, 138, 142]),
  102: shovel([218, 220, 226]),
  103: shovel([98, 230, 220]),
  104: sword([150, 108, 62]),
  105: sword([138, 138, 142]),
  106: sword([218, 220, 226]),
  107: sword([98, 230, 220]),
  108: (x, y) => { const bx = 12 - Math.round(Math.sin(((y - 2) / 11) * Math.PI) * 4); if (Math.abs(x - bx) < 2 && y > 1 && y < 14) return speckle(x, y, [126, 88, 48], [8, 6, 4], 108); if (x === 5 && y > 2 && y < 13) return speckle(x, y, [232, 232, 232], [6, 6, 6], 108); return [0, 0, 0, 0]; },
  109: (x, y) => { if (Math.abs(x - y) < 1 && x > 4 && x < 12) return speckle(x, y, [150, 108, 62], [8, 6, 4], 109); if (y <= 6 && Math.abs(13 - y - x) < 2 && x >= 9) return speckle(x, y, [190, 192, 200], [8, 8, 8], 109); if (x <= 6 && y >= 9 && (x + y) % 2 === 0 && Math.abs(y - x - 3) < 4) return speckle(x, y, [235, 235, 235], [6, 6, 6], 109); return [0, 0, 0, 0]; },
  110: (x, y) => { const dx = x - 8, dy = y - 9; if (dx * dx + dy * dy * 1.4 < 34) return speckle(x, y, dy < -2 ? [182, 136, 72] : [216, 170, 98], [10, 8, 6], 110); return [0, 0, 0, 0]; },
  111: (x, y) => { const dx = x - 8, dy = y - 9; if (x === 8 && y > 2 && y < 5) return speckle(x, y, [110, 76, 40], [6, 4, 3], 111); if (dx * dx + dy * dy * 1.2 < 26) return speckle(x, y, [214, 48, 44], [14, 10, 8], 111); return [0, 0, 0, 0]; },
  112: (x, y) => blob(x, y, [236, 148, 148], 112),
  113: (x, y) => blob(x, y, [190, 118, 66], 113),
  114: (x, y) => blob(x, y, [176, 58, 50], 114),
  115: (x, y) => blob(x, y, [142, 88, 52], 115),
  116: (x, y) => { if (y >= 7 && y <= 12 && x >= 2 && x <= 13) { if (y >= 8 && y <= 10 && x >= 4 && x <= 11) return [0, 0, 0, 0]; return speckle(x, y, [139, 90, 43], [10, 8, 6], 116); } return [0, 0, 0, 0]; },
  117: (x, y) => { const dx = x - 8, dy = y - 8; if (dx * dx + dy * dy < 24) return speckle(x, y, dx + dy < 0 ? [72, 214, 182] : [34, 156, 130], [10, 10, 10], 117); return [0, 0, 0, 0]; },
  118: (x, y) => (Math.abs(x - y + 2) < 2 && x > 2 && x < 13 ? speckle(x, y, rnd(x, y, 118) > 0.7 ? [255, 230, 120] : [240, 168, 40], [10, 8, 6], 118) : [0, 0, 0, 0]),
  119: (x, y) => { const dx = x - 8, dy = y - 8; if (dx * dx + dy * dy < 30) return dx * dx + dy * dy < 7 ? speckle(x, y, [18, 42, 32], [4, 4, 4], 119) : speckle(x, y, [72, 210, 130], [12, 10, 10], 119); return [0, 0, 0, 0]; },
  120: (x, y) => ((x === 4 || x === 8 || x === 12) && y > 2 && y < 14 ? speckle(x, y, y < 8 ? [222, 186, 74] : [158, 128, 52], [10, 8, 6], 120) : [0, 0, 0, 0]),
  121: (x, y) => bucketPx(x, y, null),
  122: (x, y) => bucketPx(x, y, [56, 128, 232]),
  123: (x, y) => bucketPx(x, y, [240, 120, 30]),
  124: (x, y) => { const dx = x - 8, dy = y - 9; if (dx * dx + dy * dy * 1.3 < 30) return speckle(x, y, rnd(x, y, 124) > 0.7 ? [104, 118, 60] : [158, 94, 58], [12, 10, 8], 124); return [0, 0, 0, 0]; },
  125: (x, y) => { const d = Math.abs(x - y + 2); if (d < 1 && x > 3 && x < 12) return speckle(x, y, [238, 236, 226], [6, 6, 6], 125); if ((x === 3 || x === 12) && y > 4 && y < 12 && Math.abs(x - y + 2) < 4) return speckle(x, y, [226, 224, 214], [6, 6, 6], 125); return [0, 0, 0, 0]; },
  126: (x, y) => { const dx = x - 8, dy = y - 10; if (dx * dx + dy * dy < 18 && y > 4) return speckle(x, y, dy < 0 ? [228, 240, 248] : [186, 210, 228], [8, 8, 8], 126); return [0, 0, 0, 0]; },
  127: (x, y) => { const spots = [[5, 11], [8, 7], [11, 10], [8, 12], [6, 8]]; for (const [sx, sy] of spots) { if ((x - sx) * (x - sx) + (y - sy) * (y - sy) < 4) return speckle(x, y, [198, 44, 52], [10, 8, 8], 127); } if (Math.abs(x - 8) < 1 && y > 7 && y < 14) return speckle(x, y, [90, 60, 40], [6, 5, 4], 127); return [0, 0, 0, 0]; },
  128: (x, y) => { const dx = x - 8, dy = y - 8; return dx * dx + dy * dy < 30 ? speckle(x, y, dx + dy < 0 ? [246, 250, 254] : [214, 224, 236], [6, 6, 6], 128) : [0, 0, 0, 0]; },
  129: (x, y) => { const dx = (x - 8) / 4.2, dy = (y - 9) / 5.6; return dx * dx + dy * dy < 1 ? speckle(x, y, dy < -0.2 ? [248, 244, 234] : [226, 218, 200], [6, 6, 6], 129) : [0, 0, 0, 0]; },
  130: (x, y) => (x > 3 && x < 13 && y > 4 && y < 13 && rnd(x, y, 130) > 0.7 ? speckle(x, y, [110, 176, 70], [10, 10, 8], 130) : [0, 0, 0, 0]),
  // ---- mod tiles ----
  131: (x, y) => {
    const q = x > 4 && x < 11 && y > 3 && y < 12 && (x === 5 || x === 10 || y === 4 || y === 11 || (x + y) % 3 === 0);
    return speckle(x, y, q ? [60, 160, 60] : [235, 200, 40], [12, 12, 10], 131);
  },
  132: (x, y) => speckle(x, y, y < 5 || y > 11 ? [200, 60, 50] : [235, 235, 225], [14, 10, 8], 132),
  133: (x, y) => {
    if (y >= 3 && y <= 8 && x >= 3 && x <= 6) return speckle(x, y, [150, 105, 60], [8, 6, 4], 133); // backrest
    if (y >= 9 && y <= 12) return speckle(x, y, [170, 120, 70], [8, 6, 4], 133); // seat
    if (y > 12 && (x === 4 || x === 11)) return speckle(x, y, [120, 82, 46], [6, 5, 3], 133); // legs
    return [0, 0, 0, 0];
  },
  134: (x, y) => {
    if (y >= 3 && y <= 6) return speckle(x, y, [172, 122, 70], [8, 6, 4], 134);
    if (y > 6 && (x === 3 || x === 12)) return speckle(x, y, [120, 82, 46], [6, 5, 3], 134);
    return [0, 0, 0, 0];
  },
  135: (x, y) => {
    if (y < 6 && x > 4 && x < 11) return speckle(x, y, [255, 235, 150], [16, 14, 8], 135);
    if (y >= 6 && Math.abs(x - 8) < 2) return speckle(x, y, [90, 90, 96], [6, 6, 6], 135);
    return [0, 0, 0, 0];
  },
  136: (x, y) => {
    if (y >= 2 && y <= 6 && x > 1) return speckle(x, y, [170, 60, 60], [10, 8, 8], 136); // backrest
    if (y > 6 && y <= 12 && x > 1) return speckle(x, y, [200, 80, 80], [10, 8, 8], 136); // seat
    if (y > 12 && (x === 2 || x === 13)) return speckle(x, y, [120, 82, 46], [6, 5, 3], 136);
    return [0, 0, 0, 0];
  },
  137: (x, y) => {
    if (Math.abs(x - y + 3) < 2 && y < 10) return speckle(x, y, [225, 228, 235], [8, 8, 10], 137);
    if (Math.abs(x - y + 3) < 2 && y >= 10) return speckle(x, y, [40, 40, 48], [6, 6, 8], 137);
    return [0, 0, 0, 0];
  },
  138: (x, y) => {
    if (y >= 2 && y <= 7 && x >= 3 && x <= 12) return speckle(x, y, [130, 132, 140], [10, 10, 10], 138);
    if (y > 7 && Math.abs(x - 8) < 2) return speckle(x, y, [110, 75, 40], [6, 6, 4], 138);
    return [0, 0, 0, 0];
  },
  139: (x, y) => {
    const d = Math.abs(x - 8) + Math.abs(y - 8);
    if (d < 4) return speckle(x, y, [190, 192, 200], [8, 8, 8], 139);
    if (d === 4 || d === 5) return speckle(x, y, [150, 152, 160], [8, 8, 8], 139);
    return [0, 0, 0, 0];
  },
  140: (x, y) => {
    if (x > 2 && x < 13 && y > 3 && y < 14) return speckle(x, y, [140, 95, 50], [10, 8, 6], 140);
    if (Math.abs(x - 8) < 2 && y <= 5) return speckle(x, y, [100, 66, 34], [6, 5, 4], 140);
    return [0, 0, 0, 0];
  },
  141: (x, y) => {
    if (x > 1 && x < 14 && y > 2 && y < 15) return speckle(x, y, [90, 110, 160], [10, 8, 8], 141);
    if (Math.abs(x - 8) < 2 && y <= 5) return speckle(x, y, [60, 74, 110], [6, 5, 4], 141);
    return [0, 0, 0, 0];
  },
  142: (x, y) => {
    if (x > 1 && x < 14 && y > 2 && y < 15) return speckle(x, y, [40, 140, 130], [10, 8, 8], 142);
    if (Math.abs(x - 8) < 2 && y <= 5) return speckle(x, y, [24, 92, 86], [6, 5, 4], 142);
    return [0, 0, 0, 0];
  },
  143: (x, y) => {
    if (y >= 6 && y <= 10) return speckle(x, y, [210, 50, 45], [12, 8, 6], 143);
    if (y === 11 && (x > 2 && x < 13)) return speckle(x, y, [30, 30, 34], [6, 6, 6], 143);
    if (y === 5 && x > 4 && x < 11) return speckle(x, y, [180, 220, 240], [8, 8, 8], 143);
    return [0, 0, 0, 0];
  },
  144: (x, y) => {
    if (Math.abs(x - 8) < 3 && y > 2 && y < 14) return speckle(x, y, y > 4 && y < 7 ? [240, 230, 180] : [200, 60, 50], [10, 8, 6], 144);
    return [0, 0, 0, 0];
  },
  145: (x, y) => {
    const dx = x - 8, dy = y - 9;
    if (dx * dx + dy * dy * 1.3 < 30) return speckle(x, y, [250, 215, 60], [14, 12, 8], 145);
    if (y < 4 && Math.abs(x - 8) < 2) return speckle(x, y, [110, 150, 60], [8, 8, 6], 145);
    return [0, 0, 0, 0];
  },
  146: (x, y) => {
    const dx = x - 8, dy = y - 9;
    if (dx * dx + dy * dy < 42 && y < 13) return speckle(x, y, y > 9 ? [225, 170, 90] : [220, 120, 60], [10, 10, 8], 146);
    return [0, 0, 0, 0];
  },
  147: (x, y) => {
    if (x > 4 && x < 11 && y > 3 && y < 14) return speckle(x, y, y > 5 && y < 11 ? [80, 230, 220] : [190, 195, 200], [10, 10, 8], 147);
    return [0, 0, 0, 0];
  },
  148: (x, y) => {
    if (Math.abs(x - 8) < 2 && y > 6) return speckle(x, y, [70, 50, 110], [8, 6, 10], 148);
    const dx = x - 8, dy = y - 4;
    if (dx * dx + dy * dy < 9) return speckle(x, y, [40, 220, 190], [12, 10, 10], 148);
    return [0, 0, 0, 0];
  },
  149: (x, y) => {
    const dx = x - 6, dy = y - 8;
    if (dx * dx + dy * dy < 22) return speckle(x, y, [200, 200, 210], [8, 8, 8], 149);
    if (x > 9 && x < 13 && y > 7 && y < 10) return speckle(x, y, [60, 60, 70], [6, 6, 6], 149);
    return [0, 0, 0, 0];
  },
  150: (x, y) => {
    const gx = x % 8, gy = y % 8;
    if (gx > 1 && gy > 1) return speckle(x, y, [120, 160, 220], [10, 10, 10], 150);
    return [0, 0, 0, 0];
  },
  // ---- extra block tiles ----
  151: (x, y) => (y === 2 || y === 7 || y === 12 ? speckle(x, y, [214, 196, 150], [6, 6, 6], 151) : speckle(x, y, [232, 216, 170], [8, 8, 6], 151)),
  152: (x, y) => speckle(x, y, x === 0 || y === 0 || x === 15 || y === 15 ? [96, 96, 100] : [140, 140, 144], [6, 6, 6], 152),
  153: (x, y) => (y % 4 === 3 ? speckle(x, y, [60, 42, 26], [5, 4, 3], 153) : speckle(x, y, [97, 69, 43], [8, 6, 5], 153)),
  154: (x, y) => (y === 3 || y === 8 || y === 12 ? speckle(x, y, [176, 138, 52], [8, 6, 4], 154) : speckle(x, y, [216, 178, 72], [10, 8, 6], 154)),
};

function blob(x, y, col, seed) {
  const dx = x - 8;
  const dy = (y - 9) * 1.15;
  if (dx * dx + dy * dy < 30) return speckle(x, y, col, [14, 12, 10], seed);
  return [0, 0, 0, 0];
}

function ingot(x, y, col, hi, lo) {
  if (y === 6 && x > 3 && x < 12) return speckle(x, y, hi, [6, 6, 6], 83);
  if (y >= 7 && y <= 10 && x > 2 && x < 13) return speckle(x, y, col, [8, 8, 8], 83);
  if (y === 11 && x > 1 && x < 14) return speckle(x, y, lo, [6, 6, 6], 83);
  return [0, 0, 0, 0];
}

function gem(x, y, col) {
  const dx = Math.abs(x - 8);
  const dy = Math.abs(y - 8);
  if (dx + dy < 6) {
    if (dx + dy < 3) return [Math.min(255, col[0] + 70), Math.min(255, col[1] + 70), Math.min(255, col[2] + 70), 255];
    return speckle(x, y, col, [10, 10, 10], 90);
  }
  return [0, 0, 0, 0];
}

const HANDLE = [140, 102, 58];

function pick(m) {
  return (x, y) => {
    if (Math.abs(x - 8) < 1 && y > 4 && y < 15) return speckle(x, y, HANDLE, [8, 6, 4], 9);
    if (y >= 2 && y <= 5) {
      const lo = [5, 3, 2, 1][y - 2];
      const hi = [11, 13, 14, 14][y - 2];
      if (x >= lo && x <= hi) return speckle(x, y, m, [12, 12, 12], 9);
    }
    return [0, 0, 0, 0];
  };
}

function axe(m) {
  return (x, y) => {
    if (Math.abs(x - 9) < 1 && y > 3 && y < 15) return speckle(x, y, HANDLE, [8, 6, 4], 9);
    if (x >= 3 && x <= 9 && y >= 2 && y <= 7) {
      if (y <= 3 || x <= 6 || (y <= 5 && x <= 8)) return speckle(x, y, m, [12, 12, 12], 9);
      return [0, 0, 0, 0];
    }
    return [0, 0, 0, 0];
  };
}

function shovel(m) {
  return (x, y) => {
    if (Math.abs(x - 8) < 1 && y > 6 && y < 15) return speckle(x, y, HANDLE, [8, 6, 4], 9);
    if (x >= 6 && x <= 10 && y >= 2 && y <= 6) {
      if ((x === 6 || x === 10) && (y === 2 || y === 6)) return [0, 0, 0, 0];
      return speckle(x, y, m, [12, 12, 12], 9);
    }
    return [0, 0, 0, 0];
  };
}

function sword(m) {
  return (x, y) => {
    const d = Math.abs(x - (14 - y));
    if (d < 2 && y >= 2 && y <= 10) return speckle(x, y, m, [10, 10, 10], 9);
    if (y >= 10 && y <= 11 && x >= 5 && x <= 10) return speckle(x, y, [90, 62, 36], [8, 6, 4], 9);
    if (d < 1 && y >= 11 && y <= 14) return speckle(x, y, HANDLE, [8, 6, 4], 9);
    return [0, 0, 0, 0];
  };
}

function bucketPx(x, y, fill) {
  if (fill && y >= 5 && y <= 6 && Math.abs(x - 8) < 10 - y) return speckle(x, y, fill, [10, 10, 10], 121);
  if (y === 4 && x >= 3 && x <= 13) return speckle(x, y, [192, 194, 200], [8, 8, 8], 121);
  const hw = 12 - y;
  if (y >= 5 && y <= 12 && (Math.abs(x - 8) === hw || Math.abs(x - 8) === hw - 1)) return speckle(x, y, [178, 180, 186], [8, 8, 8], 121);
  if (y === 12 && Math.abs(x - 8) <= 1) return speckle(x, y, [150, 152, 158], [8, 8, 8], 121);
  return [0, 0, 0, 0];
}

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
