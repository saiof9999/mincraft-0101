/** Mod registry + persistent (free) install state, stored in localStorage. */

export const MODS = [
  { id: "core", name: "Core Game", tile: 5, builtin: true, desc: "The base sandbox: mining, crafting, mobs, portals and the End." },
  { id: "weapons", name: "Weapons+", tile: 137, desc: "Katana, war hammer with knockback shockwave, and throwable shurikens." },
  { id: "furniture", name: "Furniture", tile: 133, desc: "Chairs you can sit on, oak tables, glowing lamps and sofas. Z to sleep while sitting." },
  { id: "dragons", name: "Dragons", tile: 149, desc: "Blow the dragon whistle to summon a rideable dragon. Look to steer, Space to boost." },
  { id: "backpack", name: "Backpacks", tile: 140, desc: "Equip a backpack for 18 extra slots. Craft big (27) and huge (36) upgrades." },
  { id: "vehicles", name: "Vehicles", tile: 143, desc: "Build a drivable car that cruises across land at high speed." },
  { id: "minis", name: "Mini Blocks", tile: 150, desc: "Sneak + right-click a block to sculpt a 4x4x4 mini-model on it. H to hide inside, Z to sleep." },
  { id: "boom", name: "Explosives+", tile: 144, desc: "Mega TNT (right-click with flint & steel) and throwable dynamite." },
  { id: "food", name: "Food+", tile: 145, desc: "Golden apples with regeneration, pizza, and energy drinks with a speed boost." },
  { id: "teleport", name: "Teleportation", tile: 148, desc: "The ender staff warps you up to 16 blocks through the direction you look." },
  { id: "lucky", name: "Lucky Blocks", tile: 131, desc: "Break a lucky block for random loot... or a nasty surprise." },
];

const KEY = "mincraft0101.mods";

export function installedMods() {
  if (!globalThis.localStorage) return new Set();
  try {
    const raw = JSON.parse(globalThis.localStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function setModInstalled(id, on) {
  const set = installedMods();
  if (on) set.add(id);
  else set.delete(id);
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
  return set;
}

export function modEnabled(id) {
  return id === "core" || installedMods().has(id);
}
