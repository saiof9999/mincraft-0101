import { B, I } from "./blocks.js";

export const RECIPES = [
  { out: [B.planks, 4], in: [[B.log, 1]], shapeless: true },
  { out: [I.stick, 4], in: [[B.planks, 2]], shapeless: true },
  { out: [B.table, 1], shape: ["PP", "PP"], keys: { P: B.planks } },
  { out: [B.chest, 1], shape: ["PPP", "P P", "PPP"], keys: { P: B.planks } },
  { out: [B.furnace, 1], shape: ["CCC", "C C", "CCC"], keys: { C: B.cobble } },
  { out: [B.torch, 4], shapeless: true, in: [[I.coal, 1], [I.stick, 1]] },
  { out: [I.wPick, 1], shape: ["PPP", " S ", " S "], keys: { P: B.planks, S: I.stick } },
  { out: [I.sPick, 1], shape: ["CCC", " S ", " S "], keys: { C: B.cobble, S: I.stick } },
  { out: [I.iPick, 1], shape: ["III", " S ", " S "], keys: { I: I.iron, S: I.stick } },
  { out: [I.dPick, 1], shape: ["DDD", " S ", " S "], keys: { D: I.diamond, S: I.stick } },
  { out: [I.wAxe, 1], shape: ["PP ", "PS ", " S "], keys: { P: B.planks, S: I.stick } },
  { out: [I.sAxe, 1], shape: ["CC ", "CS ", " S "], keys: { C: B.cobble, S: I.stick } },
  { out: [I.iAxe, 1], shape: ["II ", "IS ", " S "], keys: { I: I.iron, S: I.stick } },
  { out: [I.dAxe, 1], shape: ["DD ", "DS ", " S "], keys: { D: I.diamond, S: I.stick } },
  { out: [I.wShovel, 1], shape: [" P ", " S ", " S "], keys: { P: B.planks, S: I.stick } },
  { out: [I.sShovel, 1], shape: [" C ", " S ", " S "], keys: { C: B.cobble, S: I.stick } },
  { out: [I.iShovel, 1], shape: [" I ", " S ", " S "], keys: { I: I.iron, S: I.stick } },
  { out: [I.dShovel, 1], shape: [" D ", " S ", " S "], keys: { D: I.diamond, S: I.stick } },
  { out: [I.wSword, 1], shape: [" P ", " P ", " S "], keys: { P: B.planks, S: I.stick } },
  { out: [I.sSword, 1], shape: [" C ", " C ", " S "], keys: { C: B.cobble, S: I.stick } },
  { out: [I.iSword, 1], shape: [" I ", " I ", " S "], keys: { I: I.iron, S: I.stick } },
  { out: [I.dSword, 1], shape: [" D ", " D ", " S "], keys: { D: I.diamond, S: I.stick } },
  { out: [I.boat, 1], shape: ["P P", "PPP"], keys: { P: B.planks } },
  { out: [I.bow, 1], shape: [" ST", "S T", " ST"], keys: { S: I.stick, T: I.string } },
  { out: [I.bread, 1], shapeless: true, in: [[I.wheat, 3]] },
  { out: [B.tnt, 1], shape: ["GSG", "SGS", "GSG"], keys: { G: I.gunpowder, S: B.sand } },
  { out: [I.flintSteel, 1], shapeless: true, in: [[I.iron, 1], [I.flint, 1]] },
  { out: [B.rsTorch, 1], shapeless: true, in: [[I.redstone, 1], [I.stick, 1]] },
  { out: [B.rsLamp, 1], shapeless: true, in: [[I.redstone, 4], [B.glowstone, 1]] },
  { out: [B.piston, 1], shape: ["PPP", "CIC", "CRC"], keys: { P: B.planks, C: B.cobble, I: I.iron, R: I.redstone } },
  { out: [B.repeater, 1], shape: ["TRT", "CCC"], keys: { T: B.rsTorch, R: I.redstone, C: B.stone } },
  { out: [B.lever, 1], shapeless: true, in: [[I.stick, 1], [B.cobble, 1]] },
  { out: [I.bucket, 1], shape: ["I I", " I "], keys: { I: I.iron } },
  { out: [B.ironBlock, 1], shape: ["III", "III", "III"], keys: { I: I.iron } },
  { out: [B.goldBlock, 1], shape: ["GGG", "GGG", "GGG"], keys: { G: I.gold } },
  { out: [B.diamondBlock, 1], shape: ["DDD", "DDD", "DDD"], keys: { D: I.diamond } },
  { out: [I.iron, 9], shapeless: true, in: [[B.ironBlock, 1]] },
  { out: [I.gold, 9], shapeless: true, in: [[B.goldBlock, 1]] },
  { out: [I.diamond, 9], shapeless: true, in: [[B.diamondBlock, 1]] },
  { out: [B.bookshelf, 1], shape: ["PPP", "WWW", "PPP"], keys: { P: B.planks, W: I.wheat } },
  { out: [B.wool, 1], shapeless: true, in: [[I.string, 4]] },
  { out: [B.stoneBrick, 4], shapeless: true, in: [[B.stone, 4]] },
  { out: [I.eye, 1], shapeless: true, in: [[I.pearl, 1], [I.blazeRod, 1]] },
  { out: [B.glass, 1], smelt: B.sand },
  { out: [I.iron, 1], smelt: B.ironOre },
  { out: [I.gold, 1], smelt: B.goldOre },
  { out: [B.stone, 1], smelt: B.cobble },
  { out: [I.cookPork, 1], smelt: I.rawPork },
  { out: [I.cookBeef, 1], smelt: I.rawBeef },
  { out: [I.coal, 1], smelt: B.log },
];

export const SMELTS = RECIPES.filter((r) => r.smelt);
export const CRAFTS = RECIPES.filter((r) => !r.smelt && r.out[1] > 0);

function counts(items) {
  const m = new Map();
  for (const it of items) {
    if (!it || !it.id) continue;
    m.set(it.id, (m.get(it.id) || 0) + it.count);
  }
  return m;
}

export function matchShapeless(grid, recipe) {
  const need = new Map(recipe.in.map(([id, n]) => [id, n]));
  const have = counts(grid);
  if (have.size !== need.size) {
    for (const [id, n] of need) if ((have.get(id) || 0) < n) return false;
    let extra = 0;
    for (const [id, n] of have) {
      extra += n - (need.get(id) || 0);
    }
    return extra === 0;
  }
  for (const [id, n] of need) if ((have.get(id) || 0) < n) return false;
  for (const [id] of have) if (!need.has(id)) return false;
  return true;
}

function shapeToGrid(shape, keys) {
  const g = Array(9).fill(0);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      const ch = shape[r][c];
      g[r * 3 + c] = ch === " " ? 0 : keys[ch];
    }
  }
  return g;
}

function matchesAt(grid, pat, ox, oy, rotFlip) {
  const used = Array(9).fill(false);
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const pr = r - oy;
    const pc = c - ox;
    let want = 0;
    if (pr >= 0 && pr < 3 && pc >= 0 && pc < 3) want = pat[pr * 3 + pc];
    const got = grid[i]?.id || 0;
    if (want !== got) return false;
    if (want) used[i] = true;
  }
  for (let i = 0; i < 9; i++) {
    if (!used[i] && grid[i]?.id) return false;
  }
  return true;
}

export function findCraft(grid) {
  const filled = grid.filter((x) => x && x.id);
  for (const rec of CRAFTS) {
    if (rec.shapeless) {
      if (matchShapeless(grid, rec)) return rec;
    } else if (rec.shape) {
      const pat = shapeToGrid(rec.shape, rec.keys);
      for (let oy = 0; oy < 3; oy++) {
        for (let ox = 0; ox < 3; ox++) {
          if (matchesAt(grid, pat, ox, oy)) return rec;
        }
      }
    }
  }
  return null;
}

export function canCraft(invCounts, rec) {
  if (rec.smelt) return false;
  if (rec.shapeless) {
    return rec.in.every(([id, n]) => (invCounts.get(id) || 0) >= n);
  }
  const need = new Map();
  for (const row of rec.shape) {
    for (const ch of row) {
      if (ch === " ") continue;
      const id = rec.keys[ch];
      need.set(id, (need.get(id) || 0) + 1);
    }
  }
  for (const [id, n] of need) if ((invCounts.get(id) || 0) < n) return false;
  return true;
}
