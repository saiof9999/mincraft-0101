import * as THREE from "three";
import { World } from "./world/world.js";
import { Player, rayBlocks } from "./player/player.js";
import { EntityManager } from "./entities/mobs.js";
import { Redstone } from "./systems/redstone.js";
import { UI } from "./ui/ui.js";
import { B, I, def, placeId, isSolid } from "./core/blocks.js";
import { SMELTS } from "./core/recipes.js";
import { makeAudio } from "./audio.js";
import { CS } from "./world/chunk.js";
import { heightAt, SEA } from "./world/gen.js";

export class Game {
  constructor(mode, seed, uiRoot) {
    this.mode = mode;
    this.seed = seed || ((Math.random() * 1e9) | 0);
    this.running = true;
    this.time = 0;
    this.tickAcc = 0;
    this.audio = makeAudio();
    this.canvas = document.getElementById("c");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 256);
    this.sun = new THREE.DirectionalLight(0xfff0c8, 1.1);
    this.sun.position.set(40, 80, 20);
    this.hemi = new THREE.HemisphereLight(0x9ecbff, 0x3d2a1a, 0.55);
    this.scene.add(this.sun, this.hemi, new THREE.AmbientLight(0xffffff, 0.18));
    this.worlds = {
      overworld: new World(this.scene, this.seed, "overworld"),
    };
    this.world = this.worlds.overworld;
    this.player = new Player(this.world, mode);
    this.scene.add(this.player.model);
    this.ents = new EntityManager(this.scene, this.world);
    this.rs = new Redstone(this.world);
    this.ui = new UI(uiRoot, this.world.atlas);
    this.ui.showHud();
    this.chests = new Map();
    this.hl = this.makeHighlight();
    this.scene.add(this.hl);
    this.look = null;
    this.debug = false;
    this.mb = { l: false, r: false };
    this.bind();
    this.resize();
    this.sky(0.45);
    this.world.stream(this.player.pos.x, this.player.pos.z);
    let n = 0;
    for (const ch of this.world.chunks.values()) {
      if (!ch.dirty) continue;
      const dx = ch.cx - Math.floor(this.player.pos.x / 16);
      const dz = ch.cz - Math.floor(this.player.pos.z / 16);
      if (dx * dx + dz * dz <= 2 && n < 9) {
        ch.rebuild(this.world, this.world.mats);
        n++;
      }
    }
    this.ui.paintHotbar(this.player.inv);
    this.ui.chat(`World seed ${this.seed} · ${mode}`);
    if (mode === "creative") this.ui.chat("C opens the item selector. F5 cycles cameras.");
    else this.ui.chat("E inventory / recipe book. Survive the night.");
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  makeHighlight() {
    const g = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x000000 }));
    m.visible = false;
    return m;
  }

  bind() {
    const el = this.canvas;
    el.addEventListener("click", () => {
      if (!this.ui.invOpen && !this.ui.creativeOpen && !this.ui.pause && !this.player.dead) el.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === el;
    });
    document.addEventListener("mousemove", (e) => {
      if (this.locked) this.player.look(e.movementX, e.movementY);
    });
    document.addEventListener("keydown", (e) => this.key(e, true));
    document.addEventListener("keyup", (e) => this.key(e, false));
    document.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.mb.l = true;
      if (e.button === 2) {
        this.mb.r = true;
        this.use();
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.mb.l = false;
        this.player.breakT = 0;
        this.player.breakPos = null;
      }
      if (e.button === 2) this.mb.r = false;
    });
    document.addEventListener("wheel", (e) => {
      if (this.ui.invOpen) return;
      this.player.inv.selected = (this.player.inv.selected + Math.sign(e.deltaY) + 9) % 9;
      this.ui.paintHotbar(this.player.inv);
    }, { passive: true });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => this.resize());
    this.ui.root.querySelector("#resume").onclick = () => this.setPause(false);
    this.ui.root.querySelector("#tomain").onclick = () => location.reload();
    this.ui.root.querySelector("#respawn").onclick = () => this.respawn();
    this.ui.root.querySelector("#camSel").onchange = (e) => {
      this.player.camMode = +e.target.value;
    };
    this.ui.root.querySelector("#sens").oninput = (e) => {
      this.player.sens = (+e.target.value) / 10000;
    };
    this.ui.root.querySelector("#fov").oninput = (e) => {
      this.player.fov = +e.target.value;
    };
    this.ui.root.querySelector("#dist").oninput = (e) => {
      this.player.thirdDist = (+e.target.value) / 10;
    };
    this.ui.root.querySelector("#invy").onchange = (e) => {
      this.player.invertY = e.target.checked;
    };
  }

  key(e, down) {
    const k = e.code;
    this.player.keys[k] = down;
    if (!down) return;
    if (k === "Escape") {
      if (this.ui.invOpen) this.ui.closeInv();
      else if (this.ui.creativeOpen) this.ui.closeCreative();
      else this.setPause(!this.ui.pause);
      return;
    }
    if (this.ui.pause || this.player.dead) return;
    if (k === "KeyE") {
      if (this.ui.invOpen) this.ui.closeInv();
      else {
        document.exitPointerLock();
        this.ui.openInv(this.player, false);
      }
    }
    if (k === "KeyC" && this.mode === "creative") {
      if (this.ui.creativeOpen) this.ui.closeCreative();
      else {
        document.exitPointerLock();
        this.ui.openCreative(this.player);
      }
    }
    if (k === "F5") {
      this.player.camMode = (this.player.camMode + 1) % 3;
      this.ui.toast(["First person", "Third person", "Front view"][this.player.camMode]);
    }
    if (k === "F3") this.debug = !this.debug;
    if (k === "KeyQ") this.drop();
    if (k === "Space" && this.mode === "creative") {
      const now = performance.now();
      if (now - (this._flyTap || 0) < 280) this.player.flying = !this.player.flying;
      this._flyTap = now;
    }
    if (k.startsWith("Digit")) {
      const n = +k.slice(5);
      if (n >= 1 && n <= 9) {
        this.player.inv.selected = n - 1;
        this.ui.paintHotbar(this.player.inv);
      }
    }
    if (k === "KeyF") this.player.sprint = true;
  }

  setPause(v) {
    this.ui.setPause(v);
    if (v) document.exitPointerLock();
    else this.canvas.requestPointerLock();
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.ui.pause && !this.ui.invOpen && !this.ui.creativeOpen) this.update(dt);
    this.renderer.render(this.scene, this.cam);
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    const day = (this.time / 120) % 1;
    this.player._night = this.world.dim === "overworld" && (day < 0.25 || day > 0.78);
    this.sky(day);
    this.world.stream(this.player.pos.x, this.player.pos.z);
    this.player.update(dt, this.cam);
    this.ents.world = this.world;
    this.ents.update(dt, this.player, this);
    this.player.tickHunger(dt);
    this.tickAcc += dt;
    while (this.tickAcc >= 0.05) {
      this.tickAcc -= 0.05;
      this.rs.world = this.world;
      this.rs.tick();
    }
    this.look = rayBlocks(this.world, this.player.eyePos(), this.player.lookDir(), 6);
    if (this.look) {
      this.hl.visible = true;
      this.hl.position.set(this.look.x + 0.5, this.look.y + 0.5, this.look.z + 0.5);
    } else this.hl.visible = false;
    if (this.mb.l && this.locked) this.mine(dt);
    this.portalTravel();
    if (this.player.dead) {
      this.ui.setDead(true);
      document.exitPointerLock();
    }
    this.ui.paintHotbar(this.player.inv);
    this.ui.paintBars(this.player);
    if (this.debug) {
      const p = this.player.pos;
      const bio = this.world.dim;
      this.ui.debug(
        `Free Craft 1.0\n${this.mode} ${bio}\nXYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}\nChunk ${Math.floor(p.x / CS)} ${Math.floor(p.z / CS)}\nFacing ${this.player.yaw.toFixed(2)}\nLight day ${(day * 24).toFixed(1)}h\nSeed ${this.seed}\nFPS ${(1 / dt) | 0}`
      );
    } else this.ui.debug("", false);
  }

  sky(day) {
    if (this.world.dim === "nether") {
      this.scene.background = new THREE.Color(0x330808);
      this.scene.fog = new THREE.FogExp2(0x330808, 0.035);
      this.sun.intensity = 0.35;
      this.hemi.color.set(0xff6644);
      return;
    }
    if (this.world.dim === "end") {
      this.scene.background = new THREE.Color(0x100818);
      this.scene.fog = new THREE.FogExp2(0x100818, 0.02);
      this.sun.intensity = 0.45;
      this.hemi.color.set(0x8866aa);
      return;
    }
    const t = Math.cos(day * Math.PI * 2) * 0.5 + 0.5;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x0a1020), new THREE.Color(0x7ec8ff), t);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 48, 140);
    this.sun.intensity = 0.25 + t * 0.95;
    this.sun.position.set(Math.cos(day * Math.PI * 2) * 80, Math.sin(day * Math.PI * 2) * 80, 20);
  }

  mine(dt) {
    const hit = this.ents.closest(this.player.eyePos(), 4, (e) => e.type !== "arrow" && e.type !== "boat" && e.type !== "fireball" && e.type !== "pearl");
    if (hit && this.player.attackCd <= 0) {
      const held = this.player.inv.held();
      const dmg = def(held.id).damage || 1;
      this.ents.hit(hit, dmg, this.player);
      this.player.attackCd = 0.55;
      this.audio.break();
      return;
    }
    if (!this.look) return;
    const { x, y, z, id } = this.look;
    const d = def(id);
    if (d.hardness < 0) return;
    if (this.mode === "creative") {
      this.world.setBlock(x, y, z, 0);
      this.audio.break();
      this.mb.l = false;
      return;
    }
    const held = this.player.inv.held();
    const hd = def(held.id);
    let spd = 1;
    if (d.tool && hd.tool === d.tool) spd += hd.power || 1;
    if (this.player.hunger <= 0) spd *= 0.3;
    const key = `${x},${y},${z}`;
    if (this.player.breakPos !== key) {
      this.player.breakPos = key;
      this.player.breakT = 0;
    }
    this.player.breakT += dt * spd;
    if (this.player.breakT >= (d.hardness || 0.5)) {
      const drop = d.drop === undefined ? id : d.drop;
      this.world.setBlock(x, y, z, 0);
      if (drop) this.player.inv.add(drop, drop === I.redstone ? 4 : 1);
      if (id === B.gravel && Math.random() < 0.1) this.player.inv.add(I.flint, 1);
      if (id === B.leaves && Math.random() < 0.12) this.player.inv.add(I.apple, 1);
      if (id === B.leaves && Math.random() < 0.2) this.player.inv.add(I.seeds, 1);
      this.player.breakT = 0;
      this.audio.break();
    }
  }

  use() {
    const held = this.player.inv.held();
    const hd = def(held.id);
    if (hd.food && this.player.eat(hd.food)) {
      this.player.inv.consumeHeld();
      this.audio.eat();
      return;
    }
    if (held.id === I.pearl) {
      const dir = this.player.lookDir();
      this.ents.spawn("pearl", this.player.eyePos().x, this.player.eyePos().y, this.player.eyePos().z, {
        vel: dir.multiplyScalar(18),
        owner: "player",
        hp: 1,
      });
      this.player.inv.consumeHeld();
      return;
    }
    if (held.id === I.snowball || held.id === I.egg) {
      const dir = this.player.lookDir();
      this.ents.spawn("pearl", this.player.eyePos().x, this.player.eyePos().y, this.player.eyePos().z, {
        vel: dir.multiplyScalar(20),
        owner: "player",
        hp: 1,
      });
      this.player.inv.consumeHeld();
      return;
    }
    if (held.id === I.bow) {
      const hasArrow = this.mode === "creative" || this.player.inv.counts().get(I.arrow);
      if (hasArrow) {
        if (this.mode !== "creative") this.player.inv.take(I.arrow, 1);
        const dir = this.player.lookDir();
        this.ents.spawn("arrow", this.player.eyePos().x, this.player.eyePos().y, this.player.eyePos().z, {
          vel: dir.multiplyScalar(32),
          owner: "player",
          hp: 1,
        });
      }
      return;
    }
    if (held.id === I.boat) {
      const p = this.player.pos.clone().add(this.player.lookDir().multiplyScalar(2));
      const boat = this.ents.spawnBoat(p.x, p.y, p.z);
      boat.pos.set(p.x, p.y, p.z);
      if (this.mode !== "creative") this.player.inv.consumeHeld();
      this.audio.place();
      return;
    }
    const nearBoat = this.ents.closest(this.player.pos, 2.2, (e) => e.type === "boat");
    if (nearBoat && !this.player.boat) {
      this.player.boat = nearBoat;
      this.ui.toast("Sailing · Space to leave");
      return;
    }
    if (!this.look) return;
    const { x, y, z, id, face } = this.look;
    if (this.rs.toggle(x, y, z)) {
      this.audio.click();
      return;
    }
    if (id === B.table) {
      document.exitPointerLock();
      this.ui.openInv(this.player, true);
      return;
    }
    if (id === B.chest) {
      document.exitPointerLock();
      this.openChest(x, y, z);
      return;
    }
    if (id === B.furnace) {
      this.smeltOnce();
      return;
    }
    if (id === B.endFrame && held.id === I.eye) {
      this.world.meta.set(`${x},${y},${z}`, 1);
      this.player.inv.consumeHeld();
      if (this.endReady(x, y, z)) {
        this.world.fillEndPortal(x, y, z);
        this.ui.chat("The End portal opens.");
      }
      return;
    }
    if (held.id === I.flintSteel) {
      this.world.tryLightPortal(x + face[0], y + face[1], z + face[2]);
      this.world.setBlock(x + face[0], y + face[1], z + face[2], B.fire);
      this.audio.place();
      return;
    }
    if (held.id === I.bucket && (id === B.water || id === B.lava)) {
      this.world.setBlock(x, y, z, 0);
      this.player.inv.hotbar[this.player.inv.selected] = { id: id === B.water ? I.waterBucket : I.lavaBucket, count: 1 };
      return;
    }
    const place = placeId(held.id) || (!hd.item ? held.id : 0);
    if (!place) return;
    const px = x + face[0];
    const py = y + face[1];
    const pz = z + face[2];
    if (this.world.getBlock(px, py, pz)) return;
    if (this.player.collides(this.player.pos.x, this.player.pos.y, this.player.pos.z) && isSolid(place)) {
      /* still allow if not overlapping after place - check target cell vs player */
    }
    const pb = this.player.aabb();
    if (isSolid(place) && px + 1 > pb.x0 && px < pb.x1 && py + 1 > pb.y0 && py < pb.y1 && pz + 1 > pb.z0 && pz < pb.z1) return;
    this.world.setBlock(px, py, pz, place);
    if (place === I.waterBucket || held.id === I.waterBucket) this.player.inv.hotbar[this.player.inv.selected] = { id: I.bucket, count: 1 };
    else if (held.id === I.lavaBucket) this.player.inv.hotbar[this.player.inv.selected] = { id: I.bucket, count: 1 };
    else if (this.mode !== "creative") this.player.inv.consumeHeld();
    this.audio.place();
  }

  smeltOnce() {
    const inv = this.player.inv;
    const fuel = [...inv.allSlots()].find((s) => def(s.id).fuel);
    if (!fuel && this.mode !== "creative") {
      this.ui.toast("Need fuel");
      return;
    }
    for (const rec of SMELTS) {
      if (inv.counts().get(rec.smelt)) {
        if (this.mode !== "creative") {
          inv.take(rec.smelt, 1);
          inv.take(fuel.id, 1);
        }
        inv.add(rec.out[0], rec.out[1]);
        this.ui.toast("Smelted " + def(rec.out[0]).name);
        this.audio.click();
        return;
      }
    }
    this.ui.toast("Nothing to smelt");
  }

  openChest(x, y, z) {
    const k = `${this.world.dim}:${x},${y},${z}`;
    if (!this.chests.has(k)) this.chests.set(k, Array.from({ length: 27 }, () => ({ id: 0, count: 0 })));
    const slots = this.chests.get(k);
    this.player._chest = slots;
    this.ui.invOpen = true;
    const p = this.ui.root.querySelector("#invpanel");
    p.classList.remove("hidden");
    p.innerHTML = `<h2>Chest</h2><div class="grid inv" id="ch"></div><div class="grid inv" id="invm"></div>`;
    slots.forEach((s) => p.querySelector("#ch").append(this.ui.slotEl(s, this.player, false, () => this.openChest(x, y, z))));
    [...this.player.inv.main, ...this.player.inv.hotbar].forEach((s) =>
      p.querySelector("#invm").append(this.ui.slotEl(s, this.player, false, () => this.openChest(x, y, z)))
    );
  }

  endReady(x, y, z) {
    let n = 0;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (this.world.getBlock(x + dx, y, z + dz) === B.endFrame && this.world.meta.get(`${x + dx},${y},${z + dz}`)) n++;
      }
    }
    return n >= 12;
  }

  drop() {
    const s = this.player.inv.held();
    if (!s.id) return;
    this.player.inv.consumeHeld();
  }

  shootFire(from, dir) {
    this.ents.spawn("fireball", from.x, from.y, from.z, { vel: dir.multiplyScalar(10), owner: "dragon", hp: 1 });
  }

  portalTravel() {
    if (this.player.portalT < 2.5) return;
    const id = this.world.getBlock(Math.floor(this.player.pos.x), Math.floor(this.player.pos.y + 1), Math.floor(this.player.pos.z));
    this.player.portalT = 0;
    if (id === B.netherPortal) this.goto(this.world.dim === "nether" ? "overworld" : "nether");
    if (id === B.endPortal) this.goto(this.world.dim === "end" ? "overworld" : "end");
  }

  goto(dim) {
    this.audio.portal();
    const from = this.world.dim;
    const fx = this.player.pos.x;
    const fz = this.player.pos.z;
    this.scene.remove(this.world.group);
    if (!this.worlds[dim]) this.worlds[dim] = new World(this.scene, this.seed, dim);
    this.world = this.worlds[dim];
    this.scene.add(this.world.group);
    this.player.world = this.world;
    this.ents.world = this.world;
    this.rs.world = this.world;
    this.world.stream(0, 0);
    if (dim === "nether" && from === "overworld") {
      const x = Math.floor(fx / 8);
      const z = Math.floor(fz / 8);
      this.world.buildNetherPortal(x, this.world.surfaceY(x, z), z);
      this.player.pos.set(x + 1.5, this.world.surfaceY(x, z) + 1, z + 0.5);
    } else if (dim === "overworld" && from === "nether") {
      const x = Math.floor(fx * 8);
      const z = Math.floor(fz * 8);
      this.player.pos.set(x + 0.5, this.world.surfaceY(x, z) + 1, z + 0.5);
    } else if (dim === "end") {
      this.player.pos.set(0.5, 64, 0.5);
      if (!this.ents.list.some((e) => e.type === "dragon")) {
        this.ents.spawn("dragon", 20, 64, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * 12;
          const pz = Math.sin(a) * 12;
          for (let y = 50; y < 62; y++) this.world.setBlock(Math.floor(px), y, Math.floor(pz), B.obsidian);
        }
      }
    } else {
      const s = this.world.spawnPos();
      this.player.pos.set(s.x, s.y, s.z);
    }
    this.ui.chat(`Entered the ${dim}.`);
    this.ui.toast(dim.toUpperCase());
  }

  respawn() {
    this.player.dead = false;
    this.player.health = 20;
    this.player.hunger = 20;
    const s = this.worlds.overworld.spawnPos();
    if (this.world.dim !== "overworld") this.goto("overworld");
    this.player.pos.set(s.x, s.y, s.z);
    this.ui.setDead(false);
    this.canvas.requestPointerLock();
  }

  dispose() {
    this.running = false;
    this.renderer.dispose();
  }
}
