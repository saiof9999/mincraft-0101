import { B } from "../core/blocks.js";
import { fbm2, valueNoise3, hash2, hash3 } from "../core/noise.js";

export const SEA = 42;
export const MAX_Y = 80;

export function biomeAt(x, z, seed) {
  const t = fbm2(x * 0.003, z * 0.003, seed + 3);
  const m = fbm2(x * 0.004, z * 0.004, seed + 9);
  if (t < 0.32) return "ocean";
  if (t > 0.72 && m > 0.55) return "mountains";
  if (m < 0.32) return "desert";
  if (t < 0.42) return "beach";
  if (t > 0.6 && m < 0.45) return "snow";
  if (m > 0.6) return "forest";
  return "plains";
}

export function heightAt(x, z, seed) {
  const bio = biomeAt(x, z, seed);
  let h = fbm2(x * 0.012, z * 0.012, seed) * 28 + 28;
  const ridge = Math.abs(fbm2(x * 0.008, z * 0.008, seed + 2) - 0.5) * 2;
  if (bio === "ocean") h = 28 + fbm2(x * 0.01, z * 0.01, seed) * 8;
  if (bio === "beach") h = 41 + fbm2(x * 0.02, z * 0.02, seed) * 3;
  if (bio === "desert") h = 40 + fbm2(x * 0.02, z * 0.02, seed) * 6;
  if (bio === "mountains") h = 38 + ridge * 32 + fbm2(x * 0.02, z * 0.02, seed) * 8;
  if (bio === "snow") h = 44 + fbm2(x * 0.015, z * 0.015, seed) * 12;
  if (bio === "forest") h = 42 + fbm2(x * 0.02, z * 0.02, seed) * 8;
  return Math.max(2, Math.min(MAX_Y - 2, Math.floor(h)));
}

function cave(x, y, z, seed) {
  if (y < 2 || y > 50) return false;
  const n = valueNoise3(x * 0.06, y * 0.08, z * 0.06, seed + 21);
  const n2 = valueNoise3(x * 0.03, y * 0.04, z * 0.03, seed + 22);
  return n > 0.72 && n2 > 0.45;
}

function tree(worldSet, x, y, z, seed) {
  const h = 4 + (hash2(x, z, seed) * 3) | 0;
  for (let i = 0; i < h; i++) worldSet(x, y + i, z, B.log);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy < 1) continue;
        worldSet(x + dx, y + h + dy, z + dz, B.leaves);
      }
    }
  }
}

export function generateChunk(cx, cz, dim, seed, set, extras) {
  if (dim === "nether") return genNether(cx, cz, seed, set);
  if (dim === "end") return genEnd(cx, cz, seed, set, extras);
  return genOver(cx, cz, seed, set);
}

function genOver(cx, cz, seed, set) {
  const ox = cx * 16;
  const oz = cz * 16;
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const x = ox + lx;
      const z = oz + lz;
      const bio = biomeAt(x, z, seed);
      const h = heightAt(x, z, seed);
      for (let y = 0; y < MAX_Y; y++) {
        if (y === 0) {
          set(x, y, z, B.bedrock);
          continue;
        }
        if (cave(x, y, z, seed) && y < h) {
          if (y < 8) set(x, y, z, B.lava);
          else set(x, y, z, B.air);
          continue;
        }
        if (y > h) {
          if (y <= SEA && bio !== "desert") set(x, y, z, B.water);
          else set(x, y, z, B.air);
          continue;
        }
        if (y === h) {
          if (bio === "desert") set(x, y, z, B.sand);
          else if (bio === "beach" || h < SEA + 1) set(x, y, z, B.sand);
          else if (bio === "snow") set(x, y, z, B.snow);
          else if (h < SEA) set(x, y, z, B.dirt);
          else set(x, y, z, B.grass);
        } else if (y > h - 4) {
          set(x, y, z, bio === "desert" ? B.sand : B.dirt);
        } else {
          let b = B.stone;
          if (y < 12 && hash3(x, y, z, seed) > 0.97) b = B.diamondOre;
          else if (y < 20 && hash3(x, y, z, seed + 1) > 0.96) b = B.goldOre;
          else if (y < 40 && hash3(x, y, z, seed + 2) > 0.93) b = B.ironOre;
          else if (hash3(x, y, z, seed + 3) > 0.92) b = B.coalOre;
          else if (y < 16 && hash3(x, y, z, seed + 4) > 0.94) b = B.redstoneOre;
          set(x, y, z, b);
        }
      }
      if (bio === "forest" && h > SEA && hash2(x, z, seed + 40) > 0.94) {
        tree(set, x, h + 1, z, seed);
      }
      if (bio === "plains" && h > SEA && hash2(x, z, seed + 41) > 0.985) {
        tree(set, x, h + 1, z, seed);
      }
      if (bio === "desert" && h > SEA && hash2(x, z, seed + 42) > 0.97) {
        const ch = 2 + ((hash2(x, z, seed) * 3) | 0);
        for (let i = 0; i < ch; i++) set(x, h + 1 + i, z, B.cactus);
      }
    }
  }
}

function genNether(cx, cz, seed, set) {
  const ox = cx * 16;
  const oz = cz * 16;
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const x = ox + lx;
      const z = oz + lz;
      const floor = 8 + fbm2(x * 0.03, z * 0.03, seed + 80) * 10;
      const ceil = 70 - fbm2(x * 0.03, z * 0.03, seed + 81) * 8;
      for (let y = 0; y < MAX_Y; y++) {
        if (y === 0 || y === MAX_Y - 1) {
          set(x, y, z, B.bedrock);
          continue;
        }
        if (y < floor) {
          let b = B.netherrack;
          if (hash3(x, y, z, seed) > 0.96) b = B.goldOreN;
          if (hash3(x, y, z, seed + 2) > 0.985) b = B.ancient;
          if (y < 12 && y > floor - 3) b = B.lava;
          set(x, y, z, b);
        } else if (y > ceil) {
          set(x, y, z, hash3(x, y, z, seed + 5) > 0.92 ? B.glowstone : B.netherrack);
        } else {
          const n = valueNoise3(x * 0.05, y * 0.05, z * 0.05, seed + 90);
          if (n > 0.78) set(x, y, z, B.netherBrick);
          else if (n > 0.74) set(x, y, z, B.soulSand);
          else set(x, y, z, B.air);
        }
      }
    }
  }
}

function genEnd(cx, cz, seed, set, extras) {
  const ox = cx * 16;
  const oz = cz * 16;
  const dist = Math.hypot(ox + 8, oz + 8);
  for (let lz = 0; lz < 16; lz++) {
    for (let lx = 0; lx < 16; lx++) {
      const x = ox + lx;
      const z = oz + lz;
      const d = Math.hypot(x, z);
      const island = 56 - d * 0.35 + fbm2(x * 0.02, z * 0.02, seed) * 6;
      for (let y = 0; y < MAX_Y; y++) {
        if (d < 55 && y <= island && y > island - 12) set(x, y, z, B.endStone);
        else if (d > 90 && d < 140) {
          const outer = 48 + fbm2(x * 0.03, z * 0.03, seed + 2) * 8;
          if (y <= outer && y > outer - 8) set(x, y, z, B.endStone);
        } else set(x, y, z, B.air);
      }
      if (d < 8 && Math.abs(x) < 2 && Math.abs(z) < 2) {
        for (let y = Math.floor(island) + 1; y < Math.floor(island) + 4; y++) set(x, y, z, B.obsidian);
      }
    }
  }
  if (cx === 0 && cz === 0) extras.dragon = true;
}

export function strongholdHere(cx, cz, seed) {
  const rx = ((cx % 24) + 24) % 24;
  const rz = ((cz % 24) + 24) % 24;
  return rx === 8 && rz === 8 && (cx !== 0 || cz !== 0);
}

export function carveStronghold(cx, cz, set) {
  const ox = cx * 16 + 4;
  const oz = cz * 16 + 4;
  const y = 12;
  for (let dx = 0; dx < 9; dx++) {
    for (let dz = 0; dz < 9; dz++) {
      for (let dy = 0; dy < 6; dy++) {
        const wall = dx === 0 || dz === 0 || dx === 8 || dz === 8 || dy === 0 || dy === 5;
        set(ox + dx, y + dy, oz + dz, wall ? B.stoneBrick : B.air);
      }
    }
  }
  const fx = ox + 2;
  const fz = oz + 2;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const edge = i === 0 || j === 0 || i === 4 || j === 4;
      const corner = (i === 0 || i === 4) && (j === 0 || j === 4);
      if (edge && !corner) set(fx + i, y + 1, fz + j, B.endFrame);
      else if (!edge) set(fx + i, y + 1, fz + j, B.air);
    }
  }
}
