import { B, I, DEFS } from "./blocks.js";

const skip = new Set([0, 33, 34, 50, 68, 69]);

export const CREATIVE_TABS = [
  {
    id: "building",
    name: "Building",
    ids: [
      B.grass, B.dirt, B.stone, B.cobble, B.log, B.planks, B.leaves, B.sand, B.gravel,
      B.glass, B.bricks, B.stoneBrick, B.moss, B.wool, B.bookshelf, B.clay, B.ice, B.snow,
      B.obsidian, B.ironBlock, B.goldBlock, B.diamondBlock, B.coalBlock, B.quartz, B.purpur,
      B.warped, B.crimson,
    ],
  },
  {
    id: "nature",
    name: "Nature",
    ids: [B.cactus, B.melon, B.pumpkin, B.cane, B.farmland, B.sponge, B.chorus],
  },
  {
    id: "utility",
    name: "Utility",
    ids: [
      B.table, B.furnace, B.chest, B.torch, B.tnt, B.glowstone,
      B.water, B.lava,
    ],
  },
  {
    id: "ores",
    name: "Ores",
    ids: [B.coalOre, B.ironOre, B.goldOre, B.diamondOre, B.redstoneOre, B.goldOreN, B.ancient],
  },
  {
    id: "nether",
    name: "Nether",
    ids: [B.netherrack, B.netherBrick, B.soulSand, B.glowstone, B.obsidian],
  },
  {
    id: "end",
    name: "End",
    ids: [B.endStone, B.endFrame, B.purpur, B.chorus, B.dragonEgg],
  },
  {
    id: "redstone",
    name: "Redstone",
    ids: [B.redstone, B.rsTorch, B.rsLamp, B.repeater, B.lever, B.button, B.piston, I.redstone],
  },
  {
    id: "tools",
    name: "Tools",
    ids: [
      I.wPick, I.sPick, I.iPick, I.dPick, I.wAxe, I.sAxe, I.iAxe, I.dAxe,
      I.wShovel, I.sShovel, I.iShovel, I.dShovel, I.wSword, I.sSword, I.iSword, I.dSword,
      I.bow, I.arrow, I.flintSteel, I.boat, I.bucket, I.waterBucket, I.lavaBucket, I.stick,
    ],
  },
  {
    id: "items",
    name: "Items",
    ids: [
      I.coal, I.rawIron, I.iron, I.gold, I.diamond, I.redstone, I.gunpowder, I.string,
      I.leather, I.flint, I.bread, I.apple, I.rawPork, I.cookPork, I.wheat, I.seeds,
      I.pearl, I.eye, I.blazeRod,
    ],
  },
];

export function creativeList(tabId, query) {
  const q = (query || "").trim().toLowerCase();
  let ids;
  if (!tabId || tabId === "all") {
    const seen = new Set();
    ids = [];
    for (const tab of CREATIVE_TABS) {
      for (const id of tab.ids) {
        if (!id || seen.has(id) || skip.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    for (const d of DEFS) {
      if (!d || !d.id || skip.has(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      ids.push(d.id);
    }
  } else {
    ids = (CREATIVE_TABS.find((t) => t.id === tabId)?.ids || []).filter((id) => id && !skip.has(id));
  }
  if (!q) return ids;
  return ids.filter((id) => (DEFS[id]?.name || "").toLowerCase().includes(q));
}
