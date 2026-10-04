# Mincraft 0101

A browser 3D voxel sandbox inspired by the feel of classic block games — original art, original name, full survival and creative loop, with a free in-game mod store, mini-block sculpting, rideable dragons and vehicles, chat commands and more.

## Mods (title screen → Mods & Store, all free)

| Mod | What it adds |
| --- | --- |
| Weapons+ | Katana, war hammer (AoE knockback), throwable shurikens |
| Furniture | Chairs (sit with right-click), oak tables, lamps, sofas |
| Dragons | Dragon whistle → summon & ride a flying dragon (W + Space boost, Shift dismount) |
| Backpacks | Equip 18-slot pack; craft big (27) and huge (36) upgrades |
| Vehicles | Drivable car (right-click to enter, WASD to drive, Space to exit) |
| Mini Blocks | Sneak + right-click any block to sculpt a 4x4x4 mini-model on it. H hides you inside it (mobs ignore you), Z sleeps until dawn |
| Explosives+ | Mega TNT & throwable dynamite (light TNT with flint & steel) |
| Food+ | Golden apple (regen), pizza, energy drink (speed boost) |
| Teleportation | Ender staff warps you up to 16 blocks |
| Lucky Blocks | Random loot... or a trap |

## Chat & commands

Press **T** (or **/**) to open chat. Commands: `/help`, `/time day|night|noon|midnight`, `/gamemode c|s`, `/give <item> [count]`, `/tp x y z`, `/heal`, `/feed`, `/spawn`, `/fly`, `/kill`, `/seed`, `/mods`, `/clear`. Most commands require the **cheats** flag chosen on the Create World screen.

## Item drops

Broken blocks tumble to the ground as spinning item drops — walk over them to collect. Mob loot drops too.

## Controls & survival feel

- **Non-inverted, standard mouse look** (mouse up = look up) — the aim ray and camera are now perfectly aligned
- **Auto-jump**: walk into a 1-block step and you climb it smoothly (sneak disables it)
- **Double-tap W** (or hold Ctrl) to sprint; sprinting needs hunger above 3 shanks
- **Drowning**: ~14 s of air with a bubble meter above the hunger bar, then damage; air refills fast at the surface, with splash & bubble sounds
- You almost never spawn in water — the game spirals outward to find dry, tree-free land
- Hold right-click to keep placing blocks; creative breaks continuously while holding left-click

## Graphics & feel

- Baked per-vertex **ambient occlusion** and directional face shading on every block
- **Living sky**: moving sun & moon, stars at night, drifting blocky clouds, dawn/dusk color grading
- **Animated water & lava** with dedicated scrolling textures; dense underwater/lava fog + screen tint
- **First-person hand** holding the selected block/item, with swing, swap and walk animations
- **Block-breaking crack overlays** (4 stages) and block-colored debris **particles**
- Camera **view bob, sprint FOV kick, landing dip**, damage vignette flash
- Torch/glowstone/lava emit real **point lights** near the player; subtle always-on player fill light
- Per-material **dig/step/break sounds** synthesized live (stone, dirt, sand, wood, glass, snow)

## Saves

The game **autosaves every 20 s** (and on exit) to your browser. The title screen shows a **Continue** button for the latest world — player position, inventory, health, hunger, chests, time of day and every block edit are restored, in any dimension.

New worlds now auto-generate unique names so repeated "New World" saves stay easy to identify in the continue list.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). Click the game view to lock the mouse.

For a production build, run `npm run build` to generate an optimized bundle with the heavy 3D engine split into its own chunk for faster startup.

## Controls

| Action | Key |
| --- | --- |
| Move | WASD |
| Jump / swim up / fly up | Space |
| Sneak / fly down | Shift |
| Sprint | Ctrl |
| Look | Mouse (click to lock) |
| Break / attack | Left click |
| Place / use | Right click |
| Hotbar | 1–9 or scroll |
| Inventory + recipe book | E |
| Creative item selector | C (creative only) |
| Cycle camera 1st / 3rd / front | F5 |
| Camera settings | Esc pause menu |
| Drop | Q |
| Double-tap Space | Toggle fly (creative) |
| Debug | F3 |
| Leave boat | Space |

## Modes

**Survival** — health, hunger, mining speed, mobs at night, crafting, smelting at a furnace, boats, redstone, Nether and End portals.

**Creative** — flight, instant break, infinite blocks, full item selector (C).

## Dimensions

- **Overworld** — biomes, caves, ores, trees, stronghold with End frames.
- **Nether** — netherrack, lava seas, glowstone, piglins, ghasts. Light a 4×5 obsidian frame with flint and steel.
- **The End** — island, dragon, obsidian pillars. Fill all 12 End frames with Eyes of End.

Eyes of End craft from an ender pearl (enderman) + blaze rod (nether loot / creative).
