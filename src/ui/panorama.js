import { createAtlas } from "../core/atlas.js";
import { fbm2, hash2 } from "../core/noise.js";

/**
 * Draws a Minecraft-style pixel-art landscape panorama for the title screen.
 * Returns { url, w } — url is a PNG data URL designed to be tiled repeat-x.
 */
export function makePanorama(seed = (Math.random() * 1e9) | 0) {
  const T = 24; // px per block
  const W = 1920;
  const H = 960;
  const cols = W / T;
  const rows = H / T;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#5f9cf5");
  sky.addColorStop(0.5, "#8fbdf9");
  sky.addColorStop(0.78, "#c3ddfb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // sun with glow
  ctx.save();
  ctx.shadowColor = "rgba(255,240,180,0.9)";
  ctx.shadowBlur = 44;
  ctx.fillStyle = "#fff7d6";
  ctx.fillRect(cols * 0.74 * T, rows * 0.09 * T, T * 2.4, T * 2.4);
  ctx.restore();

  const atlas = createAtlas();
  const tile = (t, cx, cy, alpha = 1, haze = 0) => {
    const tx = (t % 16) * 16;
    const ty = Math.floor(t / 16) * 16;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(atlas, tx, ty, 16, 16, cx * T, cy * T, T, T);
    if (haze) {
      ctx.globalAlpha = haze;
      ctx.fillStyle = "#cfe3ff";
      ctx.fillRect(cx * T, cy * T, T, T);
    }
    ctx.globalAlpha = 1;
  };

  const seaRow = Math.round(rows * 0.63);
  const surfRow = (x) => Math.floor(rows * (0.3 + fbm2(x * 0.055, 0.5, seed, 4) * 0.4));
  const mountRow = (x) => Math.floor(rows * (0.18 + fbm2(x * 0.028, 9.5, seed + 77, 3) * 0.42));

  // blocky clouds
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 30; i++) {
    const cx = Math.floor(hash2(i, 1, seed) * cols);
    const cy = 1 + Math.floor(hash2(i, 2, seed) * 6);
    const cw = 2 + Math.floor(hash2(i, 3, seed) * 5);
    const ch = hash2(i, 4, seed) > 0.55 ? 2 : 1;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(cx * T, cy * T, cw * T, ch * T);
  }
  ctx.globalAlpha = 1;

  for (let col = 0; col < cols; col++) {
    const sy = surfRow(col);
    const underWater = sy > seaRow;
    // hazy mountains behind
    const my = mountRow(col);
    if (my < sy - 1) {
      for (let y = my; y < rows; y++) {
        const cap = y <= my + 1 && my < rows * 0.34;
        tile(cap ? 51 : 2, col, y, 1, 0.35);
      }
    }
    // ground columns
    for (let y = sy; y < rows; y++) {
      let t;
      if (y === sy) t = underWater ? (sy - seaRow <= 2 ? 7 : 4) : sy < rows * 0.34 ? 51 : 6;
      else if (y < sy + 3) t = 4;
      else t = 2;
      tile(t, col, y);
    }
    // water
    if (underWater) for (let y = seaRow; y < sy; y++) tile(13, col, y, 0.85);
    // trees
    if (!underWater && sy < rows * 0.6 && hash2(col, 11, seed) > 0.87) {
      const th = 3 + Math.floor(hash2(col, 12, seed) * 2);
      for (let i = 1; i <= th; i++) tile(9, col, sy - i);
      const top = sy - th;
      for (let dy = -2; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && (dy === -2 || dy === 0)) continue;
          if (dx === 0 && dy === 0) continue;
          const px = col + dx;
          const py = top + dy;
          if (px >= 0 && px < cols && py >= 0) tile(11, px, py);
        }
      }
    }
  }

  // horizon haze
  const haze = ctx.createLinearGradient(0, (seaRow - 3) * T, 0, (seaRow + 3) * T);
  haze.addColorStop(0, "rgba(214,232,255,0)");
  haze.addColorStop(0.5, "rgba(214,232,255,0.28)");
  haze.addColorStop(1, "rgba(214,232,255,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, (seaRow - 3) * T, W, 6 * T);

  // readability shading baked in (top + bottom)
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(4,8,18,0.42)");
  shade.addColorStop(0.3, "rgba(4,8,18,0.05)");
  shade.addColorStop(0.55, "rgba(4,8,18,0.12)");
  shade.addColorStop(1, "rgba(4,8,18,0.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  return { url: c.toDataURL("image/png"), w: W };
}
