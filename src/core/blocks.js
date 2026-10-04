export const AIR = 0;

/** @typedef {{id:number,name:string,solid?:boolean,opaque?:boolean,fluid?:boolean,light?:number,hardness?:number,tool?:string,drop?:number|null,stack?:number,tile?:number|number[],item?:boolean,place?:number,food?:number,damage?:number,fuel?:number,durability?:number,mod?:string,aoe?:boolean,buff?:string,boost?:number,throw?:number}} Def */

/** @type {Def[]} */
export const DEFS = [];
const byName = new Map();

function add(def) {
  DEFS[def.id] = def;
  byName.set(def.name, def);
  return def.id;
}

export const B = {
  air: add({ id: 0, name: "air", solid: false, opaque: false, hardness: 0, drop: null }),
  bedrock: add({ id: 1, name: "bedrock", hardness: -1, tile: 1 }),
  stone: add({ id: 2, name: "stone", hardness: 1.5, tool: "pickaxe", drop: 3, tile: 2 }),
  cobble: add({ id: 3, name: "cobble", hardness: 2, tool: "pickaxe", tile: 3, fuel: 0 }),
  dirt: add({ id: 4, name: "dirt", hardness: 0.5, tool: "shovel", tile: 4 }),
  grass: add({ id: 5, name: "grass", hardness: 0.6, tool: "shovel", drop: 4, tile: [5, 4, 6] }),
  sand: add({ id: 6, name: "sand", hardness: 0.5, tool: "shovel", tile: 7, gravity: true }),
  gravel: add({ id: 7, name: "gravel", hardness: 0.6, tool: "shovel", tile: 8, gravity: true }),
  log: add({ id: 8, name: "oak log", hardness: 2, tool: "axe", tile: [9, 10, 9], fuel: 1.5 }),
  leaves: add({ id: 9, name: "leaves", solid: true, opaque: false, hardness: 0.2, tool: "axe", drop: 9, tile: 11 }),
  planks: add({ id: 10, name: "planks", hardness: 2, tool: "axe", tile: 12, fuel: 1 }),
  water: add({ id: 11, name: "water", solid: false, opaque: false, fluid: true, hardness: -1, drop: null, tile: 13 }),
  lava: add({ id: 12, name: "lava", solid: false, opaque: false, fluid: true, light: 15, hardness: -1, drop: null, tile: 14 }),
  glass: add({ id: 13, name: "glass", opaque: false, hardness: 0.3, drop: null, tile: 15 }),
  coalOre: add({ id: 14, name: "coal ore", hardness: 3, tool: "pickaxe", drop: 101, tile: 16 }),
  ironOre: add({ id: 15, name: "iron ore", hardness: 3, tool: "pickaxe", drop: 15, tile: 17 }),
  goldOre: add({ id: 16, name: "gold ore", hardness: 3, tool: "pickaxe", drop: 16, tile: 18 }),
  diamondOre: add({ id: 17, name: "diamond ore", hardness: 3, tool: "pickaxe", drop: 105, tile: 19 }),
  redstoneOre: add({ id: 18, name: "redstone ore", hardness: 3, tool: "pickaxe", drop: 106, tile: 20 }),
  coalBlock: add({ id: 19, name: "coal block", hardness: 5, tool: "pickaxe", tile: 21, fuel: 8 }),
  ironBlock: add({ id: 20, name: "iron block", hardness: 5, tool: "pickaxe", tile: 22 }),
  goldBlock: add({ id: 21, name: "gold block", hardness: 3, tool: "pickaxe", tile: 23 }),
  diamondBlock: add({ id: 22, name: "diamond block", hardness: 5, tool: "pickaxe", tile: 24 }),
  table: add({ id: 23, name: "crafting table", hardness: 2.5, tool: "axe", tile: [25, 12, 26] }),
  furnace: add({ id: 24, name: "furnace", hardness: 3.5, tool: "pickaxe", tile: [27, 3, 28] }),
  chest: add({ id: 25, name: "chest", hardness: 2.5, tool: "axe", tile: [29, 12, 30] }),
  obsidian: add({ id: 26, name: "obsidian", hardness: 50, tool: "pickaxe", tile: 31 }),
  netherrack: add({ id: 27, name: "netherrack", hardness: 0.4, tool: "pickaxe", tile: 32 }),
  netherBrick: add({ id: 28, name: "nether brick", hardness: 2, tool: "pickaxe", tile: 33 }),
  soulSand: add({ id: 29, name: "soul sand", hardness: 0.5, tool: "shovel", tile: 34 }),
  glowstone: add({ id: 30, name: "glowstone", light: 15, hardness: 0.3, tile: 35 }),
  endStone: add({ id: 31, name: "end stone", hardness: 3, tool: "pickaxe", tile: 36 }),
  endFrame: add({ id: 32, name: "end frame", hardness: -1, tile: 37 }),
  endPortal: add({ id: 33, name: "end portal", solid: false, opaque: false, hardness: -1, drop: null, tile: 38 }),
  netherPortal: add({ id: 34, name: "nether portal", solid: false, opaque: false, light: 11, hardness: -1, drop: null, tile: 39 }),
  redstone: add({ id: 35, name: "redstone wire", solid: false, opaque: false, hardness: 0, drop: 106, tile: 40 }),
  rsTorch: add({ id: 36, name: "redstone torch", solid: false, opaque: false, light: 7, hardness: 0, tile: 41 }),
  rsLamp: add({ id: 37, name: "redstone lamp", hardness: 0.3, tile: 42 }),
  repeater: add({ id: 38, name: "repeater", solid: false, opaque: false, hardness: 0, tile: 43 }),
  lever: add({ id: 39, name: "lever", solid: false, opaque: false, hardness: 0.5, tile: 44 }),
  piston: add({ id: 40, name: "piston", hardness: 1.5, tool: "pickaxe", tile: 45 }),
  tnt: add({ id: 41, name: "tnt", hardness: 0, tile: [46, 47, 46] }),
  torch: add({ id: 42, name: "torch", solid: false, opaque: false, light: 14, hardness: 0, tile: 48 }),
  bookshelf: add({ id: 43, name: "bookshelf", hardness: 1.5, tool: "axe", tile: 49 }),
  bricks: add({ id: 44, name: "bricks", hardness: 2, tool: "pickaxe", tile: 50 }),
  snow: add({ id: 45, name: "snow", hardness: 0.2, tool: "shovel", tile: 51 }),
  ice: add({ id: 46, name: "ice", opaque: false, hardness: 0.5, tool: "pickaxe", drop: null, tile: 52 }),
  cactus: add({ id: 47, name: "cactus", opaque: false, hardness: 0.4, tile: [53, 54, 53] }),
  clay: add({ id: 48, name: "clay", hardness: 0.6, tool: "shovel", tile: 55 }),
  farmland: add({ id: 49, name: "farmland", hardness: 0.6, tool: "shovel", drop: 4, tile: 56 }),
  wheat: add({ id: 50, name: "wheat crop", solid: false, opaque: false, hardness: 0, drop: 141, tile: 57 }),
  cane: add({ id: 51, name: "sugar cane", solid: false, opaque: false, hardness: 0, tile: 58 }),
  wool: add({ id: 52, name: "wool", hardness: 0.8, tile: 59 }),
  stoneBrick: add({ id: 53, name: "stone bricks", hardness: 1.5, tool: "pickaxe", tile: 60 }),
  moss: add({ id: 54, name: "mossy cobble", hardness: 2, tool: "pickaxe", tile: 61 }),
  quartz: add({ id: 55, name: "quartz", hardness: 0.8, tool: "pickaxe", tile: 62 }),
  melon: add({ id: 56, name: "melon", hardness: 1, tool: "axe", tile: 63 }),
  pumpkin: add({ id: 57, name: "pumpkin", hardness: 1, tool: "axe", tile: 64 }),
  sponge: add({ id: 58, name: "sponge", hardness: 0.6, tile: 65 }),
  goldOreN: add({ id: 59, name: "nether gold", hardness: 3, tool: "pickaxe", drop: 104, tile: 66 }),
  ancient: add({ id: 60, name: "ancient debris", hardness: 30, tool: "pickaxe", tile: 67 }),
  warped: add({ id: 61, name: "warped planks", hardness: 2, tool: "axe", tile: 68 }),
  crimson: add({ id: 62, name: "crimson planks", hardness: 2, tool: "axe", tile: 69 }),
  chorus: add({ id: 63, name: "chorus plant", opaque: false, hardness: 0.4, tile: 70 }),
  purpur: add({ id: 64, name: "purpur", hardness: 1.5, tool: "pickaxe", tile: 71 }),
  dragonEgg: add({ id: 65, name: "dragon egg", hardness: -1, light: 1, tile: 72 }),
  button: add({ id: 66, name: "stone button", solid: false, opaque: false, hardness: 0.5, tile: 73 }),
  lampOn: add({ id: 67, name: "lamp on", light: 15, hardness: 0.3, tile: 74 }),
  pistonHead: add({ id: 68, name: "piston head", hardness: 1.5, tile: 75 }),
  fire: add({ id: 69, name: "fire", solid: false, opaque: false, light: 15, hardness: 0, drop: null, tile: 76 }),
  // ---- mod blocks ----
  lucky: add({ id: 70, name: "lucky block", hardness: 0.5, tile: 131, mod: "lucky" }),
  megaTnt: add({ id: 71, name: "mega tnt", hardness: 0, tile: 132, mod: "boom" }),
  chair: add({ id: 72, name: "chair", solid: false, opaque: false, hardness: 0.8, tool: "axe", tile: 133, mod: "furniture" }),
  oakTable: add({ id: 73, name: "oak table", hardness: 1.5, tool: "axe", tile: 134, mod: "furniture" }),
  lamp: add({ id: 74, name: "lamp", solid: false, opaque: false, light: 14, hardness: 0.3, tile: 135, mod: "furniture" }),
  sofa: add({ id: 75, name: "sofa", solid: false, opaque: false, hardness: 0.8, tool: "axe", tile: 136, mod: "furniture" }),
  sandstone: add({ id: 76, name: "sandstone", hardness: 0.8, tool: "pickaxe", tile: 151 }),
  polishedStone: add({ id: 77, name: "polished stone", hardness: 2, tool: "pickaxe", tile: 152 }),
  darkPlanks: add({ id: 78, name: "dark planks", hardness: 2, tool: "axe", tile: 153, fuel: 1 }),
  hay: add({ id: 79, name: "hay bale", hardness: 0.5, tool: "shovel", tile: 154, fuel: 3 }),
};

export const I = {
  stick: add({ id: 100, name: "stick", item: true, tile: 80, fuel: 0.5, stack: 64 }),
  coal: add({ id: 101, name: "coal", item: true, tile: 81, fuel: 8, stack: 64 }),
  rawIron: add({ id: 102, name: "raw iron", item: true, tile: 82, stack: 64 }),
  iron: add({ id: 103, name: "iron ingot", item: true, tile: 83, stack: 64 }),
  gold: add({ id: 104, name: "gold ingot", item: true, tile: 84, stack: 64 }),
  diamond: add({ id: 105, name: "diamond", item: true, tile: 85, stack: 64 }),
  redstone: add({ id: 106, name: "redstone", item: true, place: 35, tile: 86, stack: 64 }),
  gunpowder: add({ id: 107, name: "gunpowder", item: true, tile: 87, stack: 64 }),
  string: add({ id: 108, name: "string", item: true, tile: 88, stack: 64 }),
  leather: add({ id: 109, name: "leather", item: true, tile: 89, stack: 64 }),
  flint: add({ id: 111, name: "flint", item: true, tile: 90, stack: 64 }),
  flintSteel: add({ id: 112, name: "flint and steel", item: true, tile: 91, stack: 1, durability: 64 }),
  wPick: add({ id: 113, name: "wood pickaxe", item: true, tile: 92, tool: "pickaxe", power: 1, stack: 1, durability: 59 }),
  sPick: add({ id: 114, name: "stone pickaxe", item: true, tile: 93, tool: "pickaxe", power: 2, stack: 1, durability: 131 }),
  iPick: add({ id: 115, name: "iron pickaxe", item: true, tile: 94, tool: "pickaxe", power: 3, stack: 1, durability: 250 }),
  dPick: add({ id: 116, name: "diamond pickaxe", item: true, tile: 95, tool: "pickaxe", power: 4, stack: 1, durability: 1561 }),
  wAxe: add({ id: 117, name: "wood axe", item: true, tile: 96, tool: "axe", power: 1, damage: 3, stack: 1, durability: 59 }),
  sAxe: add({ id: 118, name: "stone axe", item: true, tile: 97, tool: "axe", power: 2, damage: 4, stack: 1, durability: 131 }),
  iAxe: add({ id: 119, name: "iron axe", item: true, tile: 98, tool: "axe", power: 3, damage: 5, stack: 1, durability: 250 }),
  dAxe: add({ id: 120, name: "diamond axe", item: true, tile: 99, tool: "axe", power: 4, damage: 6, stack: 1, durability: 1561 }),
  wShovel: add({ id: 121, name: "wood shovel", item: true, tile: 100, tool: "shovel", power: 1, stack: 1, durability: 59 }),
  sShovel: add({ id: 122, name: "stone shovel", item: true, tile: 101, tool: "shovel", power: 2, stack: 1, durability: 131 }),
  iShovel: add({ id: 123, name: "iron shovel", item: true, tile: 102, tool: "shovel", power: 3, stack: 1, durability: 250 }),
  dShovel: add({ id: 124, name: "diamond shovel", item: true, tile: 103, tool: "shovel", power: 4, stack: 1, durability: 1561 }),
  wSword: add({ id: 125, name: "wood sword", item: true, tile: 104, damage: 4, stack: 1, durability: 59 }),
  sSword: add({ id: 126, name: "stone sword", item: true, tile: 105, damage: 5, stack: 1, durability: 131 }),
  iSword: add({ id: 127, name: "iron sword", item: true, tile: 106, damage: 6, stack: 1, durability: 250 }),
  dSword: add({ id: 128, name: "diamond sword", item: true, tile: 107, damage: 7, stack: 1, durability: 1561 }),
  bow: add({ id: 129, name: "bow", item: true, tile: 108, stack: 1, durability: 384 }),
  arrow: add({ id: 130, name: "arrow", item: true, tile: 109, stack: 64 }),
  bread: add({ id: 131, name: "bread", item: true, food: 5, tile: 110, stack: 64 }),
  apple: add({ id: 132, name: "apple", item: true, food: 4, tile: 111, stack: 64 }),
  rawPork: add({ id: 133, name: "raw pork", item: true, food: 3, tile: 112, stack: 64 }),
  cookPork: add({ id: 134, name: "cooked pork", item: true, food: 8, tile: 113, stack: 64 }),
  rawBeef: add({ id: 135, name: "raw beef", item: true, food: 3, tile: 114, stack: 64 }),
  cookBeef: add({ id: 136, name: "cooked beef", item: true, food: 8, tile: 115, stack: 64 }),
  boat: add({ id: 137, name: "oak boat", item: true, tile: 116, stack: 1 }),
  pearl: add({ id: 138, name: "ender pearl", item: true, tile: 117, stack: 16 }),
  blazeRod: add({ id: 139, name: "blaze rod", item: true, tile: 118, stack: 64, fuel: 12 }),
  eye: add({ id: 140, name: "eye of end", item: true, tile: 119, stack: 64 }),
  wheat: add({ id: 141, name: "wheat", item: true, tile: 120, stack: 64 }),
  bucket: add({ id: 142, name: "bucket", item: true, tile: 121, stack: 16 }),
  waterBucket: add({ id: 143, name: "water bucket", item: true, place: 11, tile: 122, stack: 1 }),
  lavaBucket: add({ id: 144, name: "lava bucket", item: true, place: 12, tile: 123, stack: 1 }),
  rotten: add({ id: 145, name: "rotten flesh", item: true, food: 4, tile: 124, stack: 64 }),
  bone: add({ id: 146, name: "bone", item: true, tile: 125, stack: 64 }),
  pearlShard: add({ id: 147, name: "ghast tear", item: true, tile: 126, stack: 64 }),
  netherWart: add({ id: 148, name: "nether wart", item: true, tile: 127, stack: 64 }),
  snowball: add({ id: 149, name: "snowball", item: true, tile: 128, stack: 16 }),
  egg: add({ id: 150, name: "egg", item: true, tile: 129, stack: 16 }),
  seeds: add({ id: 151, name: "seeds", item: true, place: 50, tile: 130, stack: 64 }),
  // ---- mod items ----
  katana: add({ id: 152, name: "katana", item: true, tile: 137, damage: 9, stack: 1, durability: 400, mod: "weapons" }),
  hammer: add({ id: 153, name: "war hammer", item: true, tile: 138, damage: 11, aoe: true, stack: 1, durability: 300, mod: "weapons" }),
  shuriken: add({ id: 154, name: "shuriken", item: true, tile: 139, throw: 26, stack: 16, mod: "weapons" }),
  backpack: add({ id: 155, name: "backpack", item: true, tile: 140, stack: 1, mod: "backpack" }),
  bigBackpack: add({ id: 156, name: "big backpack", item: true, tile: 141, stack: 1, mod: "backpack" }),
  hugeBackpack: add({ id: 157, name: "huge backpack", item: true, tile: 142, stack: 1, mod: "backpack" }),
  car: add({ id: 158, name: "car", item: true, tile: 143, stack: 1, mod: "vehicles" }),
  dynamite: add({ id: 159, name: "dynamite", item: true, tile: 144, throw: 18, stack: 16, mod: "boom" }),
  goldenApple: add({ id: 160, name: "golden apple", item: true, tile: 145, food: 4, buff: "regen", stack: 16, mod: "food" }),
  pizza: add({ id: 161, name: "pizza", item: true, tile: 146, food: 10, stack: 8, mod: "food" }),
  energyDrink: add({ id: 162, name: "energy drink", item: true, tile: 147, boost: 45, stack: 8, mod: "food" }),
  enderStaff: add({ id: 163, name: "ender staff", item: true, tile: 148, stack: 1, durability: 24, mod: "teleport" }),
  dragonWhistle: add({ id: 164, name: "dragon whistle", item: true, tile: 149, stack: 1, mod: "dragons" }),
};

export function def(id) {
  return DEFS[id] || DEFS[0];
}

export function isSolid(id) {
  const d = DEFS[id];
  return !!(d && d.solid !== false && !d.item && id);
}

export function isOpaque(id) {
  const d = DEFS[id];
  return !!(d && d.opaque !== false && !d.fluid && !d.item && id);
}

export function isFluid(id) {
  return id === B.water || id === B.lava;
}

export function lightValue(id) {
  return DEFS[id]?.light || 0;
}

export function placeId(id) {
  const d = DEFS[id];
  if (!d || d.item) return d?.place || 0;
  return id;
}

export function allPlaceable() {
  return DEFS.filter((d) => d && d.id && !d.item && d.drop !== null && d.id < 100 && d.hardness !== undefined && d.name !== "air" && d.name !== "piston head" && d.name !== "fire" && d.name !== "end portal" && d.name !== "nether portal" && d.name !== "wheat crop");
}

export function allItems() {
  return DEFS.filter((d) => d && d.id);
}

export function byIdName(name) {
  return byName.get(name);
}
