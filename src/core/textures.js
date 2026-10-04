import { hash2, valueNoise2, fbm2 } from "./noise.js";

/** Small procedural texture helpers (all return canvases). */

export function makeWaterCanvas() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = valueNoise2(x * 0.4, y * 0.4, 71);
      const band = Math.sin((y + n * 4) * 1.35) * 0.5 + 0.5;
      const i = (y * 16 + x) * 4;
      img.data[i] = 24 + n * 30;
      img.data[i + 1] = 78 + band * 42 + n * 26;
      img.data[i + 2] = 168 + band * 52 + n * 30;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function makeLavaCanvas() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = valueNoise2(x * 0.45, y * 0.45, 91) * 0.6 + valueNoise2(x * 0.16, y * 0.16, 92) * 0.4;
      let r, g, b;
      if (n > 0.66) {
        r = 255;
        g = 210 + n * 40;
        b = 90;
      } else if (n > 0.5) {
        r = 250;
        g = 120 + n * 90;
        b = 20;
      } else if (n > 0.38) {
        r = 190 + n * 120;
        g = 60;
        b = 10;
      } else {
        r = 84 + n * 60;
        g = 18;
        b = 6;
      }
      const i = (y * 16 + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function makeCloudCanvas() {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // blocky clouds: coarse grid samples, faded at borders so the texture tiles cleanly
      const gx = Math.floor(x / 2) * 0.09;
      const gy = Math.floor(y / 2) * 0.09;
      let v = fbm2(gx, gy, 123, 3);
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y) / 10;
      const fade = Math.max(0, Math.min(1, edge));
      v *= fade;
      const on = v > 0.52;
      const i = (y * S + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = on ? 210 : 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function makeSunCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, "rgba(255,251,224,1)");
  g.addColorStop(0.55, "rgba(255,236,160,0.9)");
  g.addColorStop(1, "rgba(255,205,100,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "rgba(255,252,235,0.92)";
  ctx.fillRect(21, 21, 22, 22);
  return c;
}

export function makeMoonCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgba(226,232,240,0.95)");
  g.addColorStop(0.6, "rgba(200,210,226,0.75)");
  g.addColorStop(1, "rgba(180,192,214,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "rgba(238,242,248,0.95)";
  ctx.fillRect(22, 22, 20, 20);
  for (let i = 0; i < 7; i++) {
    const x = 24 + Math.floor(hash2(i, 3, 91) * 15);
    const y = 24 + Math.floor(hash2(i, 5, 92) * 15);
    ctx.fillStyle = "rgba(168,178,196,0.8)";
    ctx.fillRect(x, y, 3, 3);
  }
  return c;
}

/** Progressive block-breaking crack overlays (4 stages, cracks accumulate). */
export function makeCrackCanvases(stages = 4) {
  const out = [];
  for (let s = 0; s < stages; s++) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "rgba(16,12,8,0.9)";
    ctx.lineWidth = 1;
    const lines = 4 + s * 4;
    for (let i = 0; i < lines; i++) {
      const a = hash2(i, 7, 55) * Math.PI * 2;
      const r0 = 0.5 + hash2(i, 7, 56) * 3;
      const r1 = 3.5 + hash2(i, 7, 57) * (3.5 + s * 2.2);
      const bend = (hash2(i, 7, 58) - 0.5) * 1.1;
      const sx = 8 + Math.cos(a) * r0;
      const sy = 8 + Math.sin(a) * r0;
      const ex = 8 + Math.cos(a + bend) * r1;
      const ey = 8 + Math.sin(a + bend) * r1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a + 1.9) * 2.6, ey + Math.sin(a + 1.9) * 2.6);
      ctx.stroke();
    }
    out.push(c);
  }
  return out;
}
