import * as THREE from "three";
import { World } from "./world/world.js";
import { Player, rayBlocks } from "./player/player.js";
import { EntityManager } from "./entities/mobs.js";
import { Redstone } from "./systems/redstone.js";
import { UI } from "./ui/ui.js";
import { B, I, DEFS, def, placeId, isSolid, lightValue } from "./core/blocks.js";
import { installedMods } from "./core/mods.js";
import { NetClient } from "./net/client.js";
import { SMELTS } from "./core/recipes.js";
import { makeAudio } from "./audio.js";
import { Particles } from "./fx.js";
import { Hand } from "./player/hand.js";
import { makeSunCanvas, makeMoonCanvas, makeCloudCanvas, makeCrackCanvases } from "./core/textures.js";
import { tilesFor, tileUV } from "./core/atlas.js";
import { newSaveId, writeSave, packSlots, unpackSlots } from "./save.js";
import { CS, CH } from "./world/chunk.js";
import { heightAt, SEA } from "./world/gen.js";

const MINI_FACES = [
  { n: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.74 },
  { n: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.74 },
  { n: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.84 },
  { n: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.84 },
];

function addMiniCube(buf, x, y, z, s, tile) {
  const [u0, v0, u1, v1] = tileUV(tile);
  const uvs = [u0, v0, u1, v0, u1, v1, u0, v1];
  for (const f of MINI_FACES) {
    const bi = buf.p.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = f.verts[i];
      buf.p.push(x + v[0] * s, y + v[1] * s, z + v[2] * s);
      buf.n.push(f.n[0], f.n[1], f.n[2]);
      buf.u.push(uvs[i * 2], uvs[i * 2 + 1]);
      buf.c.push(f.shade, f.shade, f.shade);
    }
    buf.i.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
  }
}

export class Game {
  constructor(mode, seed, uiRoot, saveData = null, opts = {}) {
    this.mode = mode;
    this.seed = seed || ((Math.random() * 1e9) | 0);
    this.worldName = opts.name || saveData?.name || "New World";
    this.cheats = saveData ? !!saveData.cheats : !!opts.cheats;
    this.mods = installedMods();
    this.chatOpen = false;
    this.sculpt = null;
    this.fuses = [];
    this.miniMeshes = new Map();
    this.savedMinis = null;
    this.net = null;
    this.remotes = new Map();
    this.netT = 0;
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
    this.attachNet(this.world);
    this.player = new Player(this.world, mode);
    this.scene.add(this.player.model);
    this.ents = new EntityManager(this.scene, this.world);
    this.rs = new Redstone(this.world);
    this.ui = new UI(uiRoot, this.world.atlas);
    this.ui.showHud();
    this.ui.onChatSubmit = (t) => this.submitChat(t);
    this.ui.onChatCancel = () => this.closeChat();
    this.chests = new Map();
    this.hl = this.makeHighlight();
    this.scene.add(this.hl);
    this.scene.add(this.cam); // lets the held-item viewmodel ride the camera
    this.particles = new Particles(this.scene, this.world.atlas);
    this.makeCrack();
    this.hand = new Hand(this.cam, this.world.mats.opaque, this.world.mats.opaque.map);
    this.hand.setId(this.player.inv.held().id);
    this.initSky();
    this.initLights();
    this.world.onExplode = (x, y, z, r) => this.particles.burst(x, y, z, 3, 34, { spread: r, speed: 7, up: 6, size: 0.16 });
    this._lastHp = this.player.health;
    this.stepAcc = 2;
    this.saveT = 0;
    this.lightT = 0;
    this.saveId = saveData?.id || newSaveId();
    this.sculptHl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.27, 0.27, 0.27)), new THREE.LineBasicMaterial({ color: 0x111111 }));
    this.sculptHl.visible = false;
    this.scene.add(this.sculptHl);
    if (opts.server && !saveData) this.connectServer();
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
    if (saveData) this.applySave(saveData);
    else this.restoreMinis();
    this.ensureSafeSpawn();
    this.ui.paintHotbar(this.player.inv);
    this.ui.chat(`"${this.worldName}" · seed ${this.seed} · ${mode}${this.cheats ? " · cheats ON" : ""}`);
    if (mode === "creative") this.ui.chat("C opens the item selector. Double-tap Space to fly. F5 cycles cameras.");
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

  clearMiniMeshes() {
    for (const m of this.miniMeshes.values()) {
      this.scene.remove(m);
      m.geometry?.dispose();
    }
    this.miniMeshes.clear();
  }

  detachEvents() {
    const handlers = this._listeners || {};
    const el = this.canvas;
    if (el) {
      if (handlers.canvasClick) el.removeEventListener("click", handlers.canvasClick);
    }
    if (handlers.pointerLock) document.removeEventListener("pointerlockchange", handlers.pointerLock);
    if (handlers.mouseMove) document.removeEventListener("mousemove", handlers.mouseMove);
    if (handlers.keyDown) document.removeEventListener("keydown", handlers.keyDown);
    if (handlers.keyUp) document.removeEventListener("keyup", handlers.keyUp);
    if (handlers.mouseDown) document.removeEventListener("mousedown", handlers.mouseDown);
    if (handlers.mouseUp) document.removeEventListener("mouseup", handlers.mouseUp);
    if (handlers.wheel) document.removeEventListener("wheel", handlers.wheel, { passive: true });
    if (handlers.beforeUnload) window.removeEventListener("beforeunload", handlers.beforeUnload);
    if (handlers.contextMenu) document.removeEventListener("contextmenu", handlers.contextMenu);
    if (handlers.resize) window.removeEventListener("resize", handlers.resize);
    this._listeners = null;
  }

  bind() {
    const el = this.canvas;
    const handlers = {};
    handlers.canvasClick = () => {
      if (!this.ui.invOpen && !this.ui.creativeOpen && !this.ui.pause && !this.player.dead) el.requestPointerLock();
    };
    handlers.pointerLock = () => {
      this.locked = document.pointerLockElement === el;
    };
    handlers.mouseMove = (e) => {
      if (this.locked) this.player.look(e.movementX, e.movementY);
    };
    handlers.keyDown = (e) => this.key(e, true);
    handlers.keyUp = (e) => this.key(e, false);
    handlers.mouseDown = (e) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.mb.l = true;
        this.hand.swing();
      }
      if (e.button === 2) {
        this.mb.r = true;
        this.use();
        this.placeCd = 0.24; // avoid double-fire with the hold-to-place repeat
      }
    };
    handlers.mouseUp = (e) => {
      if (e.button === 0) {
        this.mb.l = false;
        this.player.breakT = 0;
        this.player.breakPos = null;
      }
      if (e.button === 2) this.mb.r = false;
    };
    handlers.wheel = (e) => {
      if (this.ui.invOpen) return;
      this.player.inv.selected = (this.player.inv.selected + Math.sign(e.deltaY) + 9) % 9;
      this.ui.paintHotbar(this.player.inv);
      this.announceHeld();
    };
    handlers.beforeUnload = () => {
      try { this.save(); } catch {}
    };
    handlers.contextMenu = (e) => e.preventDefault();
    handlers.resize = () => this.resize();
    this._listeners = handlers;
    el.addEventListener("click", handlers.canvasClick);
    document.addEventListener("pointerlockchange", handlers.pointerLock);
    document.addEventListener("mousemove", handlers.mouseMove);
    document.addEventListener("keydown", handlers.keyDown);
    document.addEventListener("keyup", handlers.keyUp);
    document.addEventListener("mousedown", handlers.mouseDown);
    document.addEventListener("mouseup", handlers.mouseUp);
    document.addEventListener("wheel", handlers.wheel, { passive: true });
    window.addEventListener("beforeunload", handlers.beforeUnload);
    document.addEventListener("contextmenu", handlers.contextMenu);
    window.addEventListener("resize", handlers.resize);
    this.ui.root.querySelector("#resume").onclick = () => this.setPause(false);
    this.ui.root.querySelector("#tomain").onclick = () => {
      try { this.save(); } catch {}
      setTimeout(() => location.reload(), 250);
    };
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
    if (this.chatOpen) {
      return;
    }
    this.player.keys[k] = down;
    if (k === "KeyW") {
      if (down) {
        const now = performance.now();
        if (now - (this._lastW || 0) < 280) this.player._dblSprint = true; // double-tap W to sprint
        this._lastW = now;
      } else {
        this.player._dblSprint = false;
      }
    }
    if (!down) return;
    if (k === "Escape") {
      if (this.sculpt) {
        this.exitSculpt();
        return;
      }
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
    if (k === "KeyG") {
      this.player.camMode = (this.player.camMode + 1) % 3;
      this.ui.toast(["First person", "Third person", "Front view"][this.player.camMode]);
    }
    if (k === "F3") this.debug = !this.debug;
    if (k === "KeyQ") this.drop();
    if (k === "Space" && !e.repeat) {
      // double-press Space to toggle flight (creative, or survival with cheats)
      if (this.mode === "creative" || this.cheats) {
        const now = performance.now();
        if (now - (this._flyTap || 0) < 280) {
          this.player.flying = !this.player.flying;
          this.player.vel.y = 0;
          this.ui.toast(this.player.flying ? "Flying ON - Space up, Shift down" : "Flying OFF");
          this._flyTap = 0;
        } else {
          this._flyTap = now;
        }
      }
    }
    if (k.startsWith("Digit")) {
      const n = +k.slice(5);
      if (n >= 1 && n <= 9) {
        this.player.inv.selected = n - 1;
        this.ui.paintHotbar(this.player.inv);
        this.announceHeld();
      }
    }
    if (k === "KeyF") this.player.sprint = true;
    if (k === "KeyT" && !this.ui.pause && !this.player.dead && !this.sculpt) {
      this.openChat("");
      return;
    }
    if (k === "Slash" && !this.ui.pause && !this.player.dead && !this.sculpt) {
      this.openChat("/");
      return;
    }
    if (k === "KeyH" && this.sculpt && !this.player.hidden) {
      this.hideInSculpt();
      return;
    }
    if (k === "KeyO") {
      if (this.sculpt) {
        this.exitSculpt();
        this.ui.toast("Back to normal size");
        return;
      }
      if (this.player.hidden) {
        this.player.unhide();
        this.ui.toast("Came out of hiding");
        return;
      }
    }
    if (k === "KeyZ" && (this.sculpt || this.player.sitting)) {
      this.sleep();
      return;
    }
  }

  modsOn(id) {
    return this.mods.has(id) || id === "core";
  }

  connectServer(attempt = 0) {
    const url = `ws://${location.hostname || "localhost"}:8081/mp`;
    const net = new NetClient(url, this.worldName);
    net.on("welcome", (m) => {
      this.net = net;
      this.applyServerWorld(m.seed, m.edits);
      const online = (m.players || []).length + 1;
      this.ui.chat(`Connected to the multiplayer server - ${online} online. Blocks, chat and players sync live.`);
      for (const pl of m.players || []) this.ensureRemote(pl);
    });
    net.on("join", (m) => this.ui.chat(`${m.name || "A player"} joined the server`));
    net.on("leave", (m) => {
      this.removeRemote(m.id);
      this.ui.chat(`${m.name || "A player"} left the server`);
    });
    net.on("pos", (m) => this.ensureRemote(m));
    net.on("block", (m) => {
      const w = this.worlds[m.dim];
      if (w) w.setBlock(m.x, m.y, m.z, m.block, { silent: true, record: false });
    });
    net.on("chat", (m) => this.ui.chat(`<${m.from}> ${m.text}`));
    net.on("close", () => {
      this.net = null;
      for (const id of [...this.remotes.keys()]) this.removeRemote(id);
      this.ui.chat("Lost connection to the server - continuing offline.");
    });
    net.connect().catch(() => {
      if (attempt < 6) setTimeout(() => this.connectServer(attempt + 1), 1200);
      else this.ui.chat("Could not reach the multiplayer server - playing single-player.");
    });
  }

  attachNet(w) {
    if (!this.net) return;
    w.onChange = (x, y, z, id, dim) => this.net?.send({ t: "block", dim, x, y, z, id });
  }

  editsToPairs(obj) {
    if (!obj) return null;
    return Object.entries(obj).map(([k, v]) => {
      const [x, y, z] = k.split(",").map(Number);
      return [x, y, z, v];
    });
  }

  /** rebuild every dimension with the server's seed + shared edits */
  applyServerWorld(seed, edits) {
    this.seed = seed;
    this.netEdits = edits || {};
    for (const w of Object.values(this.worlds)) this.scene.remove(w.group);
    this.worlds = { overworld: new World(this.scene, this.seed, "overworld") };
    for (const w of Object.values(this.worlds)) this.attachNet(w);
    this.world = this.worlds.overworld;
    this.world.loadEdits(this.editsToPairs(this.netEdits.overworld));
    this.scene.add(this.world.group);
    this.player.world = this.world;
    this.ents.world = this.world;
    this.rs.world = this.world;
    this.world.stream(this.player.pos.x, this.player.pos.z);
    this.restoreMinis();
    this.ensureSafeSpawn();
  }

  ensureRemote(m) {
    if (!m || m.id === this.net?.id) return;
    let e = this.remotes.get(m.id);
    if (!e) {
      e = this.ents.spawn("remote", m.x || 0, (m.y || 50) + 1, m.z || 0, { name: (m.name || "Player").slice(0, 16), ridx: m.id });
      const tag = makeNameSprite(e.name);
      tag.position.y = 2.1;
      e.mesh.add(tag);
      this.remotes.set(m.id, e);
      return;
    }
    e.target.set(m.x, m.y, m.z);
    e.targetYaw = m.yaw || 0;
    e.rdim = m.dim;
  }

  removeRemote(id) {
    const e = this.remotes.get(id);
    if (e) {
      e.dead = true;
      this.remotes.delete(id);
    }
  }

  /** hard guarantee: never spawn/load/respawn stuck inside blocks or in liquid */
  ensureSafeSpawn() {
    const p = this.player;
    const w = this.world;
    const bx = Math.floor(p.pos.x);
    const by = Math.floor(p.pos.y);
    const bz = Math.floor(p.pos.z);
    const feet = w.getBlock(bx, by, bz);
    const head = w.getBlock(bx, by + 1, bz);
    const safeHere =
      !isSolid(feet) &&
      !isSolid(head) &&
      feet !== B.water &&
      feet !== B.lava &&
      head !== B.water &&
      head !== B.lava;
    if (safeHere) {
      p.fallStart = p.pos.y;
      return;
    }
    // search nearby generated terrain for open air above solid, non-tree ground
    const safeColumn = (x, z) => {
      for (let y = CH - 2; y > 1; y--) {
        const below = w.getBlock(x, y - 1, z);
        if (!isSolid(below) || below === B.leaves || below === B.log) continue;
        if (w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) continue; // air only (rejects water/lava/blocks)
        return y;
      }
      return -1;
    };
    const cx = Math.floor(p.pos.x);
    const cz = Math.floor(p.pos.z);
    for (let r = 0; r <= 20; r++) {
      const steps = Math.max(1, r * 8);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = cx + Math.round(Math.cos(a) * r);
        const z = cz + Math.round(Math.sin(a) * r);
        const y = safeColumn(x, z);
        if (y > 0) {
          p.pos.set(x + 0.5, y, z + 0.5);
          p.vel.set(0, 0, 0);
          p.fallStart = y;
          this.ui.toast("Moved to a safe spot");
          return;
        }
      }
    }
    // last resort: nudge straight up until free
    let tries = 0;
    while (p.collides(p.pos.x, p.pos.y, p.pos.z) && tries++ < 80) p.pos.y += 1;
    p.vel.set(0, 0, 0);
    p.fallStart = p.pos.y;
  }

  openChat(prefill = "") {
    this.chatOpen = true;
    this.player.keys = {};
    document.exitPointerLock();
    this.ui.openChat(prefill);
  }

  closeChat() {
    this.chatOpen = false;
    this.ui.closeChat();
    if (!this.ui.pause && !this.player.dead) this.canvas.requestPointerLock();
  }

  submitChat(text) {
    this.closeChat();
    if (!text.trim()) return;
    if (text.startsWith("/")) {
      this.runCommand(text.slice(1));
      return;
    }
    if (this.net) this.net.send({ t: "chat", text: text.trim() });
    else this.ui.chat(`<You> ${text.trim()}`);
  }

  runCommand(cmd) {
    const parts = cmd.trim().split(/\s+/);
    const c = (parts[0] || "").toLowerCase();
    const needs = () => {
      if (!this.cheats) {
        this.ui.chat("Cheats are off for this world (enable them when creating it).");
        return true;
      }
      return false;
    };
    switch (c) {
      case "help":
        this.ui.chat("Commands: /time day|night|noon|midnight /gamemode c|s /give <item> [n] /tp x y z /heal /feed /spawn /fly /kill /seed /mods /clear (most need cheats)");
        break;
      case "time": {
        if (needs()) break;
        const map = { day: 0.08, noon: 0.25, sunset: 0.48, night: 0.76, midnight: 0.75 };
        const v = map[parts[1]] ?? parseFloat(parts[1]);
        if (Number.isFinite(v)) {
          this.time = Math.floor(this.time / 480) * 480 + Math.max(0, Math.min(1, v)) * 480;
          this.ui.chat(`Time set to ${parts[1]}`);
        } else this.ui.chat("Usage: /time day|night|noon|midnight");
        break;
      }
      case "gamemode": {
        if (needs()) break;
        const m = (parts[1] || "").toLowerCase();
        if (m === "creative" || m === "c") {
          this.mode = "creative";
          this.player.mode = "creative";
          this.ui.chat("Gamemode: Creative");
        } else if (m === "survival" || m === "s") {
          this.mode = "survival";
          this.player.mode = "survival";
          this.player.flying = false;
          this.ui.chat("Gamemode: Survival");
        } else this.ui.chat("Usage: /gamemode creative|survival");
        break;
      }
      case "give": {
        if (needs()) break;
        let count = 1;
        const args = parts.slice(1);
        if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) count = Math.max(1, Math.min(999, +args.pop()));
        const q = args.join(" ").replace(/_/g, " ").toLowerCase();
        const d = DEFS.find((x) => x && x.name === q) || DEFS.find((x) => x && x.name.startsWith(q) && q);
        if (d) {
          this.player.inv.add(d.id, count);
          this.ui.chat(`Gave ${count} x ${d.name}`);
        } else this.ui.chat(`Unknown item: ${q}`);
        break;
      }
      case "tp": {
        if (needs()) break;
        const [x, y, z] = parts.slice(1).map(Number);
        if ([x, y, z].every(Number.isFinite)) {
          this.player.pos.set(x, y, z);
          this.player.vel.set(0, 0, 0);
          this.player.fallStart = y;
          this.ui.chat(`Teleported to ${x} ${y} ${z}`);
        } else this.ui.chat("Usage: /tp x y z");
        break;
      }
      case "heal":
        if (!needs()) {
          this.player.health = 20;
          this.player.air = 10;
          this.ui.chat("Healed");
        }
        break;
      case "feed":
        if (!needs()) {
          this.player.hunger = 20;
          this.player.sat = 5;
          this.ui.chat("Fed");
        }
        break;
      case "spawn": {
        const s = this.world.spawnPos();
        this.player.pos.set(s.x, s.y, s.z);
        this.player.vel.set(0, 0, 0);
        this.player.fallStart = s.y;
        this.ui.chat("Warped to world spawn");
        break;
      }
      case "fly":
        if (!needs()) {
          this.player.flying = !this.player.flying;
          this.ui.chat(`Flying ${this.player.flying ? "enabled" : "disabled"}`);
        }
        break;
      case "kill":
        this.player.hurt(1000, "command");
        break;
      case "seed":
        this.ui.chat(`Seed: ${this.seed}`);
        break;
      case "mods":
        this.ui.chat(`Installed mods: ${[...this.mods].join(", ") || "none"} (install more from the title screen)`);
        break;
      case "clear":
        this.ui.clearChat();
        break;
      default:
        this.ui.chat(`Unknown command: /${c} - try /help`);
    }
  }

  enterSculpt(look) {
    const key = `${look.x},${look.y},${look.z}`;
    if (!this.world.minis.has(key)) this.world.minis.set(key, new Uint8Array(64));
    this.sculpt = { key, x: look.x, y: look.y, z: look.z, cell: null, face: null, placeCell: null };
    // you shrink to mini size so you can build the small blocks yourself -
    // your model stays visible from the outside, O gets you back out
    this.player.setSmall(true);
    this.player.vel.set(0, 0, 0);
    this.ui.showSculpt(true);
    this.ui.toast("Mini mode - you are tiny now. Press O to exit.");
    this.audio.click();
  }

  exitSculpt() {
    if (!this.sculpt) return;
    this.sculpt = null;
    this.player.setSmall(false);
    this.ui.showSculpt(false);
    this.sculptHl.visible = false;
  }

  hideInSculpt() {
    const s = this.sculpt;
    this.exitSculpt();
    this.player.hide(new THREE.Vector3(s.x + 0.5, s.y + 0.2, s.z + 0.5));
    this.ui.toast("Hiding inside your build - H to come out");
  }

  sleep() {
    const frac = (this.time % 480) / 480;
    if (frac > 0.5 && frac < 0.98) {
      this.time = (Math.floor(this.time / 480) + 1) * 480 + 0.03 * 480;
      this.ui.toast("Slept until dawn");
      this.audio.portal();
    } else {
      this.ui.toast("You can only sleep at night");
    }
  }

  updateSculpt(dt) {
    const s = this.sculpt;
    const eye = this.player.eyePos();
    const dir = this.player.lookDir();
    const step = 0.04;
    let last = null;
    let lastAny = null;
    let hit = null;
    for (let t = 0.05; t < 6; t += step) {
      const lx = eye.x + dir.x * t - s.x;
      const ly = eye.y + dir.y * t - s.y;
      const lz = eye.z + dir.z * t - s.z;
      if (lx < 0 || ly < 0 || lz < 0 || lx >= 1 || ly >= 1 || lz >= 1) {
        if (hit) break;
        continue;
      }
      const cell = [Math.min(3, Math.floor(lx / 0.25)), Math.min(3, Math.floor(ly / 0.25)), Math.min(3, Math.floor(lz / 0.25))];
      const data = this.world.minis.get(s.key);
      if (data && data[this.world.miniIndex(cell[0], cell[1], cell[2])]) {
        hit = { cell, face: last ? [cell[0] - last[0], cell[1] - last[1], cell[2] - last[2]] : [0, 1, 0] };
        break;
      }
      last = cell;
      lastAny = cell;
    }
    if (hit) {
      s.cell = hit.cell;
      s.face = hit.face;
      s.placeCell = [hit.cell[0] + hit.face[0], hit.cell[1] + hit.face[1], hit.cell[2] + hit.face[2]];
      this.sculptHl.visible = true;
      this.sculptHl.position.set(s.x + hit.cell[0] * 0.25 + 0.125, s.y + hit.cell[1] * 0.25 + 0.125, s.z + hit.cell[2] * 0.25 + 0.125);
    } else {
      // nothing built yet: aiming into the empty block places the first mini block
      s.cell = null;
      s.face = null;
      s.placeCell = lastAny;
      this.sculptHl.visible = false;
    }
    this.sculptCd = Math.max(0, (this.sculptCd || 0) - dt);
    if (this.sculptCd <= 0 && (s.cell || s.placeCell)) {
      if (this.mb.l && s.cell) {
        this.world.setMini(s.x, s.y, s.z, s.cell[0], s.cell[1], s.cell[2], 0);
        this.refreshMiniMesh(s.x, s.y, s.z);
        this.audio.dig("stone");
        this.hand.mineSwing();
        this.sculptCd = 0.16;
      } else if (this.mb.r && s.placeCell) {
        const [px, py, pz] = s.placeCell;
        if (px >= 0 && px <= 3 && py >= 0 && py <= 3 && pz >= 0 && pz <= 3) {
          const data = this.world.minis.get(s.key);
          if (!data || !data[this.world.miniIndex(px, py, pz)]) {
            const held = this.player.inv.held();
            const hd = def(held.id);
            const place = placeId(held.id) || (!hd.item ? held.id : 0);
            if (place && !def(place).item) {
              this.world.setMini(s.x, s.y, s.z, px, py, pz, place);
              this.refreshMiniMesh(s.x, s.y, s.z);
              this.audio.place();
              this.hand.swing();
              if (this.mode !== "creative") this.player.inv.consumeHeld();
              this.sculptCd = 0.16;
            }
          }
        }
      }
    }
  }

  refreshMiniMesh(x, y, z) {
    const key = `${x},${y},${z}`;
    const old = this.miniMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.miniMeshes.delete(key);
    }
    const data = this.world.minis.get(key);
    if (!data) return;
    let any = false;
    for (const v of data) {
      if (v) {
        any = true;
        break;
      }
    }
    if (!any) {
      this.world.minis.delete(key);
      return;
    }
    const buf = { p: [], n: [], u: [], c: [], i: [] };
    for (let sy = 0; sy < 4; sy++) {
      for (let sz = 0; sz < 4; sz++) {
        for (let sx = 0; sx < 4; sx++) {
          const id = data[sy * 16 + sz * 4 + sx];
          if (!id) continue;
          addMiniCube(buf, x + sx * 0.25, y + sy * 0.25, z + sz * 0.25, 0.25, tilesFor(id)[2]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.u, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(buf.c, 3));
    g.setIndex(buf.i);
    const mesh = new THREE.Mesh(g, this.world.mats.opaque);
    this.scene.add(mesh);
    this.miniMeshes.set(key, mesh);
  }

  clearMini(x, y, z) {
    const key = `${x},${y},${z}`;
    if (!this.world.minis.has(key)) return;
    this.world.minis.delete(key);
    const m = this.miniMeshes.get(key);
    if (m) {
      this.scene.remove(m);
      m.geometry.dispose();
      this.miniMeshes.delete(key);
    }
  }

  restoreMinis() {
    this.clearMiniMeshes();
    for (const key of this.world.minis.keys()) {
      const [x, y, z] = key.split(",").map(Number);
      this.refreshMiniMesh(x, y, z);
    }
  }

  equipBackpack(id) {
    const size = id === I.backpack ? 18 : id === I.bigBackpack ? 27 : 36;
    const cur = this.player.inv.extra || [];
    if (cur.length >= size) {
      this.ui.toast("Your backpack is already this big or bigger");
      return;
    }
    const next = cur.slice();
    while (next.length < size) next.push({ id: 0, count: 0 });
    this.player.inv.extra = next;
    if (this.mode !== "creative") this.player.inv.consumeHeld();
    this.ui.toast(`Backpack equipped: ${size} extra slots (open with E)`);
    this.audio.pop();
  }

  teleportStaff() {
    const eye = this.player.eyePos();
    const dir = this.player.lookDir();
    let dest = null;
    for (let t = 2; t < 18; t += 0.5) {
      const p = eye.clone().addScaledVector(dir, t);
      const bx = Math.floor(p.x);
      const by = Math.floor(p.y);
      const bz = Math.floor(p.z);
      if (isSolid(this.world.getBlock(bx, by, bz)) && isSolid(this.world.getBlock(bx, by + 1, bz))) break;
      dest = p.clone();
    }
    if (!dest) {
      this.ui.toast("No space to warp to");
      return;
    }
    this.particles.burst(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, 40, 12, { speed: 3 });
    this.player.pos.set(dest.x, dest.y - this.player.eye, dest.z);
    let tries = 0;
    while (this.player.collides(this.player.pos.x, this.player.pos.y, this.player.pos.z) && tries++ < 6) this.player.pos.y += 1;
    this.player.vel.set(0, 0, 0);
    this.player.fallStart = this.player.pos.y;
    this.particles.burst(dest.x, dest.y, dest.z, 40, 12, { speed: 3 });
    this.audio.portal();
    this.hand.swing();
    this.ui.chat("Warped.");
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
    const day = (this.time / 480) % 1; // full day-night cycle
    const bright = this.sky(day);
    this.player._night = this.world.dim === "overworld" && bright < 0.35;
    this.world.tickAnim(dt);
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
    if (this.sculpt) this.updateSculpt(dt);
    if (this.mb.l && this.locked && !this.sculpt) this.mine(dt);
    else if (!this.sculpt) this.crack.visible = false;
    this.placeCd = Math.max(0, (this.placeCd || 0) - dt);
    this._creativeCd = Math.max(0, (this._creativeCd || 0) - dt);
    // hold right-click to keep placing (like Minecraft), but not on interactive blocks
    if (this.mb.r && this.locked && this.placeCd <= 0 && !this.ui.invOpen && !this.ui.creativeOpen && !this.player.dead && !this.sculpt) {
      const lookId = this.look?.id;
      const interactive = lookId === B.table || lookId === B.chest || lookId === B.furnace || lookId === B.endFrame || lookId === B.lever || lookId === B.button;
      const hd0 = def(this.player.inv.held()?.id || 0);
      if ((!hd0.item || hd0.place) && !interactive) {
        this.use();
        this.placeCd = 0.24;
      }
    }
    this.lightT += dt;
    if (this.lightT > 0.4) {
      this.lightT = 0;
      this.scanLights();
    }
    this.particles.update(dt, this.world);
    const heldId = this.player.inv.held().id;
    if (heldId !== this.hand.id) this.hand.setId(heldId);
    this.hand.update(dt, this.player, this.player.camMode === 0 && !this.player.dead);
    if (this.net) {
      this.netT += dt;
      if (this.netT > 0.15) {
        this.netT = 0;
        const pp = this.player.pos;
        this.net.send({ t: "pos", x: +pp.x.toFixed(2), y: +pp.y.toFixed(2), z: +pp.z.toFixed(2), yaw: +this.player.yaw.toFixed(2), pitch: +this.player.pitch.toFixed(2), dim: this.world.dim });
      }
    }
    this.updateFx(dt);
    this.updateSteps(dt);
    for (let i = this.fuses.length - 1; i >= 0; i--) {
      const f = this.fuses[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.world.setBlock(f.x, f.y, f.z, 0, { record: false });
        this.world.explode(f.x, f.y, f.z, f.r);
        if (this.player.pos.distanceTo(new THREE.Vector3(f.x, f.y, f.z)) < f.r + 1) this.player.hurt(12, "explode");
        this.fuses.splice(i, 1);
      }
    }
    this.portalTravel();
    if (this.player.dead) {
      this.ui.setDead(true);
      document.exitPointerLock();
    }
    this.saveT += dt;
    if (this.saveT > 20) {
      this.saveT = 0;
      this.save();
    }
    this.ui.paintHotbar(this.player.inv);
    this.ui.paintBars(this.player);
    if (this.debug) {
      const p = this.player.pos;
      const bio = this.world.dim;
      this.ui.debug(
        `Mincraft 0101\n${this.worldName} · ${this.mode} ${bio}${this.cheats ? " · cheats" : ""}\nXYZ ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}\nChunk ${Math.floor(p.x / CS)} ${Math.floor(p.z / CS)}\nFacing ${this.player.yaw.toFixed(2)}\nLight day ${(day * 24).toFixed(1)}h\nSeed ${this.seed}\nFPS ${(1 / dt) | 0}`
      );
    } else this.ui.debug("", false);
  }

  sky(day) {
    const dim = this.world.dim;
    if (this.skyObjs) this.skyObjs.g.visible = dim === "overworld";
    if (dim === "nether") {
      this.scene.background = new THREE.Color(0x330808);
      this.scene.fog = new THREE.FogExp2(0x330808, 0.035);
      this.sun.intensity = 0.35;
      this.hemi.color.set(0xff6644);
      return 0.4;
    }
    if (dim === "end") {
      this.scene.background = new THREE.Color(0x100818);
      this.scene.fog = new THREE.FogExp2(0x100818, 0.02);
      this.sun.intensity = 0.45;
      this.hemi.color.set(0x8866aa);
      return 0.35;
    }
    const ang = day * Math.PI * 2;
    const el = Math.sin(ang); // sun elevation: -1 midnight .. 1 noon
    const bright = THREE.MathUtils.smoothstep(el, -0.14, 0.24);
    const horizon = Math.max(0, 1 - Math.abs(el) / 0.2);
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x0b1026), new THREE.Color(0x87c5ff), bright);
    if (horizon > 0 && el > -0.2) sky.lerp(new THREE.Color(0xff8a3c), horizon * 0.45);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 60, 150);
    this.sun.intensity = 0.22 + bright;
    this.sun.color.setRGB(1, 0.94 - horizon * 0.25, 0.82 - horizon * 0.45);
    this.sun.position.set(Math.cos(ang) * 80, el * 80, 24);
    this.hemi.intensity = 0.28 + bright * 0.4;
    const s = this.skyObjs;
    if (s) {
      s.g.position.copy(this.cam.position);
      const dir = new THREE.Vector3(Math.cos(ang), el, 0.28).normalize();
      s.sun.position.copy(dir).multiplyScalar(300);
      s.sun.lookAt(this.cam.position);
      s.moon.position.copy(dir).multiplyScalar(-300);
      s.moon.lookAt(this.cam.position);
      s.stars.material.opacity = (1 - bright) * 0.9;
      s.stars.rotation.y = ang * 0.3;
      const cl = s.clouds.material.map;
      cl.offset.set((this.time * 0.0035) % 1, (this.time * 0.0011) % 1);
      s.clouds.material.opacity = 0.3 + bright * 0.4;
    }
    const eye = this.player.eyePos();
    const eb = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    if (eb === B.water) {
      this.scene.fog = new THREE.FogExp2(0x14406e, 0.055);
      this.scene.background = new THREE.Color(0x14406e);
    } else if (eb === B.lava) {
      this.scene.fog = new THREE.FogExp2(0x93280a, 0.4);
      this.scene.background = new THREE.Color(0x93280a);
    }
    return bright;
  }

  initSky() {
    const g = new THREE.Group();
    const sunTex = new THREE.CanvasTexture(makeSunCanvas());
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    const moonTex = new THREE.CanvasTexture(makeMoonCanvas());
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(320);
      pts.push(v.x, v.y, v.z);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    const cloudTex = new THREE.CanvasTexture(makeCloudCanvas());
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(3, 3);
    cloudTex.magFilter = THREE.NearestFilter;
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.6, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    clouds.rotation.x = -Math.PI / 2;
    clouds.position.y = 108;
    g.add(sun, moon, stars, clouds);
    this.scene.add(g);
    this.skyObjs = { g, sun, moon, stars, clouds };
  }

  initLights() {
    this.plights = [];
    for (let i = 0; i < 6; i++) {
      const L = new THREE.PointLight(0xffb35c, 0, 10, 1.8);
      this.scene.add(L);
      this.plights.push(L);
    }
    this.fill = new THREE.PointLight(0xfff2d9, 0.22, 9, 1.6);
    this.cam.add(this.fill);
    this.scanLights();
  }

  /** assign pooled point lights to the brightest nearby light sources */
  scanLights() {
    const p = this.player.pos;
    const px = Math.floor(p.x);
    const py = Math.floor(p.y + 1);
    const pz = Math.floor(p.z);
    const found = [];
    for (let dy = -6; dy <= 6; dy++) {
      for (let dz = -9; dz <= 9; dz++) {
        for (let dx = -9; dx <= 9; dx++) {
          const x = px + dx;
          const y = py + dy;
          const z = pz + dz;
          const id = this.world.getBlock(x, y, z);
          if (!id || lightValue(id) < 12) continue;
          found.push([x + 0.5, y + 0.55, z + 0.5, dx * dx + dy * dy * 2 + dz * dz, id]);
        }
      }
    }
    found.sort((a, b) => a[3] - b[3]);
    for (let i = 0; i < this.plights.length; i++) {
      const L = this.plights[i];
      if (i < found.length) {
        L.position.set(found[i][0], found[i][1], found[i][2]);
        L.intensity = found[i][4] === B.lava ? 0.9 : 1.15;
      } else {
        L.intensity = 0;
      }
    }
  }

  makeCrack() {
    this.crackTexs = makeCrackCanvases().map((c) => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ map: this.crackTexs[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    this.crack.visible = false;
    this.scene.add(this.crack);
  }

  announceHeld() {
    const s = this.player.inv.held();
    if (s?.id) this.ui.showItemName(def(s.id).name);
  }

  updateFx(dt) {
    const eye = this.player.eyePos();
    const b = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    const u = document.getElementById("fxu");
    if (u) u.className = b === B.water ? "underwater" : b === B.lava ? "underlava" : "hidden";
    const feetIn = this.player.inFluid(B.water);
    if (feetIn && !this._wasInWater && this.player.vel.y < -3) this.audio.splash();
    this._wasInWater = feetIn;
    if (this.player.headInWater) {
      this.bubbleT = (this.bubbleT ?? 1) - dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 1.2 + Math.random() * 2.2;
        this.audio.bubble();
      }
    }
    const h = document.getElementById("fxh");
    if (this.player.health < this._lastHp) {
      if (h) h.style.opacity = "0.85";
      this.audio.hurt();
      this.hand.swing();
    } else if (h && parseFloat(h.style.opacity || "0") > 0) {
      h.style.opacity = String(Math.max(0, parseFloat(h.style.opacity) - 0.045));
    }
    this._lastHp = this.player.health;
  }

  updateSteps(dt) {
    const hv = Math.hypot(this.player.vel.x, this.player.vel.z);
    if (this.player.onGround && hv > 0.6 && !this.player.flying && !this.player.boat) {
      this.stepAcc += hv * dt;
      if (this.stepAcc > 2.3) {
        this.stepAcc = 0;
        this.audio.step(sndMat(this.player.under()));
      }
    } else {
      this.stepAcc = 1.9;
    }
  }

  serialize() {
    const p = this.player;
    const edits = {};
    for (const [dim, w] of Object.entries(this.worlds)) {
      const arr = [];
      for (const [k, v] of Object.entries(w.dumpEdits())) {
        const [x, y, z] = k.split(",").map(Number);
        arr.push([x, y, z, v]);
      }
      if (arr.length) edits[dim] = arr;
    }
    const chests = {};
    for (const [k, v] of this.chests) chests[k] = packSlots(v);
    const minis = {};
    for (const [dim, w] of Object.entries(this.worlds)) {
      if (w.minis.size) minis[dim] = w.dumpMinis();
    }
    return {
      id: this.saveId,
      name: this.worldName,
      cheats: this.cheats,
      mode: this.mode,
      seed: this.seed,
      time: this.time,
      dim: this.world.dim,
      updated: Date.now(),
      player: { pos: [p.pos.x, p.pos.y, p.pos.z], yaw: p.yaw, pitch: p.pitch, health: p.health, hunger: p.hunger, flying: p.flying },
      inv: { hotbar: packSlots(p.inv.hotbar), main: packSlots(p.inv.main), extra: packSlots(p.inv.extra || []), selected: p.inv.selected },
      edits,
      minis,
      chests,
    };
  }

  save() {
    if (this.player.dead) return;
    const data = this.serialize();
    return writeSave(data).catch(() => {});
  }

  applySave(d) {
    if (!d) return;
    this.time = d.time || 0;
    this.savedMinis = d.minis || null;
    if (d.name) this.worldName = d.name;
    this.cheats = !!d.cheats;
    if (d.inv) {
      this.player.inv.hotbar = unpackSlots(d.inv.hotbar, this.player.inv.hotbar);
      this.player.inv.main = unpackSlots(d.inv.main, this.player.inv.main);
      this.player.inv.extra = d.inv.extra ? unpackSlots(d.inv.extra, []) : this.player.inv.extra || [];
      this.player.inv.selected = d.inv.selected || 0;
    }
    if (d.player) {
      this.player.health = d.player.health ?? 20;
      this.player.hunger = d.player.hunger ?? 20;
      this.player.yaw = d.player.yaw || 0;
      this.player.pitch = d.player.pitch || 0;
      this.player.flying = !!d.player.flying && this.mode === "creative";
    }
    this.world.loadEdits(d.edits?.overworld);
    this.world.loadMinis(this.savedMinis?.overworld);
    if (d.dim && d.dim !== "overworld") {
      this.goto(d.dim);
      this.world.loadEdits(d.edits?.[d.dim]);
      this.world.loadMinis(this.savedMinis?.[d.dim]);
    }
    if (d.player?.pos) this.player.pos.set(d.player.pos[0], d.player.pos[1], d.player.pos[2]);
    this.restoreMinis();
    if (d.chests) {
      this.chests = new Map(Object.entries(d.chests).map(([k, v]) => [k, unpackSlots(v, [])]));
    }
    this._lastHp = this.player.health;
  }

  mine(dt) {
    if (this.sculpt) return;
    const hit = this.ents.closest(this.player.eyePos(), 4, (e) => e.type !== "arrow" && e.type !== "boat" && e.type !== "car" && e.type !== "wyvern" && e.type !== "fireball" && e.type !== "pearl" && e.type !== "shuriken" && e.type !== "dynamite" && e.type !== "item" && e.type !== "remote");
    if (hit && this.player.attackCd <= 0) {
      const held = this.player.inv.held();
      const dmg = def(held.id).damage || 1;
      this.ents.hit(hit, dmg, this.player);
      if (def(held.id).aoe) {
        for (const o of this.ents.list) {
          if (o === hit || o.type === "item" || o.type === "arrow" || o.type === "fireball" || o.type === "pearl" || o.type === "shuriken" || o.type === "dynamite" || o.type === "boat" || o.type === "car" || o.type === "wyvern") continue;
          if (o.pos.distanceTo(hit.pos) < 2.8) this.ents.hit(o, Math.ceil(dmg / 2), this.player);
        }
        this.particles.burst(hit.pos.x, hit.pos.y + 1, hit.pos.z, 3, 10, { speed: 4, size: 0.1 });
      }
      this.player.attackCd = 0.55;
      this.audio.break();
      this.hand.swing();
      this.particles.burst(hit.pos.x, hit.pos.y + 1, hit.pos.z, 46, 6, { speed: 2, up: 1.5, size: 0.09 });
      return;
    }
    if (!this.look) {
      this.crack.visible = false;
      return;
    }
    const { x, y, z, id } = this.look;
    const d = def(id);
    if (d.hardness < 0) {
      this.crack.visible = false;
      return;
    }
    this.hand.mineSwing();
    this._digT = (this._digT || 0) + dt;
    if (this._digT > 0.22) {
      this._digT = 0;
      this.audio.dig(sndMat(id));
    }
    if (this.mode === "creative") {
      if ((this._creativeCd || 0) > 0) return; // continuous breaking while held
      this.world.setBlock(x, y, z, 0);
      this.clearMini(x, y, z);
      this.audio.break();
      this.particles.burst(x + 0.5, y + 0.5, z + 0.5, tilesFor(id)[2], 10);
      this._creativeCd = 0.18;
      this.crack.visible = false;
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
    const hardness = d.hardness || 0.5;
    const st = Math.min(3, Math.floor((this.player.breakT / hardness) * 4));
    if (this.player.breakT > 0) {
      this.crack.visible = true;
      this.crack.position.set(x + 0.5, y + 0.5, z + 0.5);
      if (this.crack.material.map !== this.crackTexs[st]) this.crack.material.map = this.crackTexs[st];
    }
    if (this.player.breakT >= hardness) {
      const drop = d.drop === undefined ? id : d.drop;
      this.world.setBlock(x, y, z, 0);
      this.crack.visible = false;
      this.particles.burst(x + 0.5, y + 0.5, z + 0.5, tilesFor(id)[2], 14);
      // broken blocks fall as collectible item drops
      if (drop) this.ents.spawnDrop(x + 0.5, y + 0.5, z + 0.5, drop, drop === I.redstone ? 4 : 1);
      if (id === B.gravel && Math.random() < 0.1) this.ents.spawnDrop(x + 0.5, y + 0.5, z + 0.5, I.flint, 1);
      if (id === B.leaves && Math.random() < 0.12) this.ents.spawnDrop(x + 0.5, y + 0.5, z + 0.5, I.apple, 1);
      if (id === B.leaves && Math.random() < 0.2) this.ents.spawnDrop(x + 0.5, y + 0.5, z + 0.5, I.seeds, 1);
      if (id === B.lucky && this.modsOn("lucky")) {
        if (Math.random() < 0.15) {
          this.world.explode(x, y, z, 2);
          this.player.hurt(6, "explode");
          this.ui.chat("The lucky block was not lucky...");
        } else {
          const prizes = [[I.diamond, 3], [I.gold, 5], [I.iron, 8], [I.apple, 3], [I.goldenApple, 1], [I.pizza, 2], [I.katana, 1], [I.enderStaff, 1], [I.dynamite, 4], [B.tnt, 2]];
          const picks = 3 + ((Math.random() * 4) | 0);
          for (let i = 0; i < picks; i++) {
            const [pid, pn] = prizes[(Math.random() * prizes.length) | 0];
            this.ents.spawnDrop(x + 0.5, y + 0.6, z + 0.5, pid, pn);
          }
          this.ui.chat("Lucky!");
        }
      }
      this.player.breakT = 0;
      this.audio.break();
    }
  }

  use() {
    // sneak + right-click a block: enter/exit mini-block sculpting (Mini Blocks mod)
    if (this.modsOn("minis") && this.player.sneak) {
      if (this.sculpt) this.exitSculpt();
      else if (this.look && isSolid(this.look.id)) this.enterSculpt(this.look);
      return;
    }
    const held = this.player.inv.held();
    const hd = def(held.id);
    if (hd.food && (this.player.eat(hd.food) || hd.buff)) {
      if (hd.buff === "regen") {
        this.player.regenT = 10;
        this.ui.toast("Regeneration!");
      }
      this.player.inv.consumeHeld();
      this.audio.eat();
      return;
    }
    if (held.id === I.shuriken || held.id === I.dynamite) {
      const dir = this.player.lookDir();
      const e = this.ents.spawn(held.id === I.shuriken ? "shuriken" : "dynamite", this.player.eyePos().x, this.player.eyePos().y, this.player.eyePos().z, {
        vel: dir.clone().multiplyScalar(def(held.id).throw || 20),
        owner: "player",
        hp: 1,
      });
      if (held.id === I.dynamite) e.fuse = 1.6;
      this.player.inv.consumeHeld();
      this.hand.swing();
      this.audio.pop();
      return;
    }
    if (held.id === I.enderStaff && this.modsOn("teleport")) {
      this.teleportStaff();
      return;
    }
    if (held.id === I.car && this.modsOn("vehicles")) {
      const p = this.player.pos.clone().add(this.player.lookDir().setY(0).normalize().multiplyScalar(3));
      this.ents.spawn("car", p.x, this.world.surfaceY(Math.floor(p.x), Math.floor(p.z)) + 0.2, p.z);
      if (this.mode !== "creative") this.player.inv.consumeHeld();
      this.audio.place();
      this.ui.toast("Car placed - right-click it to drive");
      return;
    }
    if (held.id === I.dragonWhistle && this.modsOn("dragons")) {
      const own = this.ents.list.find((e) => e.type === "wyvern" && e.pos.distanceTo(this.player.pos) < 60);
      if (own) {
        this.player.vehicle = own;
        this.ui.toast("Mounted your dragon");
      } else {
        const p = this.player.pos.clone().add(new THREE.Vector3(0, 2.5, 0));
        this.ents.spawn("wyvern", p.x, p.y, p.z);
        this.ui.toast("A dragon answers your whistle - right-click it to ride");
      }
      this.audio.pop();
      return;
    }
    if (held.id === I.energyDrink && this.modsOn("food")) {
      this.player.boostT = def(held.id).boost || 45;
      this.player.inv.consumeHeld();
      this.audio.eat();
      this.ui.toast("Speed boost!");
      return;
    }
    if (hd.mod === "backpack" && this.modsOn("backpack")) {
      this.equipBackpack(held.id);
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
    const ride = this.ents.closest(this.player.pos, 2.6, (e) => e.type === "boat" || e.type === "car" || e.type === "wyvern");
    if (ride) {
      if (ride.type === "boat" && !this.player.boat) {
        this.player.boat = ride;
        this.ui.toast("Sailing · Space to leave");
        return;
      }
      if ((ride.type === "car" || ride.type === "wyvern") && !this.player.vehicle) {
        this.player.vehicle = ride;
        this.ui.toast(ride.type === "car" ? "Driving · WASD, Space to exit" : "Flying · W + Space to boost, Shift to dismount");
        return;
      }
    }
    if (!this.look) return;
    const { x, y, z, id, face } = this.look;
    if ((id === B.chair || id === B.sofa) && this.modsOn("furniture")) {
      this.player.sit(x + 0.5, y + 0.45, z + 0.5);
      this.ui.toast("Sitting · Space to stand · Z to sleep");
      return;
    }
    if ((id === B.tnt || id === B.megaTnt) && held.id === I.flintSteel) {
      this.fuses.push({ x, y, z, t: id === B.megaTnt ? 2.5 : 1.5, r: id === B.megaTnt ? 5.5 : 3 });
      this.audio.click();
      this.ui.toast(id === B.megaTnt ? "Mega TNT lit!" : "TNT lit!");
      return;
    }
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
    this.hand.swing();
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
    if (!s?.id) return;
    const dropCount = Math.max(1, s.count || 1);
    const dir = this.player.lookDir().normalize();
    const start = this.player.eyePos().addScaledVector(dir, 0.7);
    this.player.inv.consumeHeld();
    const e = this.ents.spawnDrop(start.x, start.y, start.z, s.id, dropCount);
    if (e) {
      e.vel.copy(dir).multiplyScalar(4.2);
      e.vel.y = 2.8;
    }
    this.audio.pop();
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
    if (!this.worlds[dim]) {
      this.worlds[dim] = new World(this.scene, this.seed, dim);
      this.worlds[dim].loadMinis(this.savedMinis?.[dim]);
      this.attachNet(this.worlds[dim]);
    }
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
    this.restoreMinis();
    this.ensureSafeSpawn();
  }

  respawn() {
    this.player.dead = false;
    this.player.health = 20;
    this.player.hunger = 20;
    const s = this.worlds.overworld.spawnPos();
    if (this.world.dim !== "overworld") this.goto("overworld");
    this.player.pos.set(s.x, s.y, s.z);
    this.ensureSafeSpawn();
    this.ui.setDead(false);
    this.canvas.requestPointerLock();
  }

  dispose() {
    this.running = false;
    this.detachEvents();
    if (this.net) {
      this.net.close();
      this.net = null;
    }
    try { this.save(); } catch {}
    this.clearMiniMeshes();
    for (const w of Object.values(this.worlds || {})) {
      if (w?.group) this.scene.remove(w.group);
    }
    if (this.crack) {
      this.scene.remove(this.crack);
      this.crack.geometry?.dispose();
      this.crack.material?.dispose?.();
    }
    if (this.hl) {
      this.scene.remove(this.hl);
      this.hl.geometry?.dispose();
      this.hl.material?.dispose?.();
    }
    if (this.sculptHl) {
      this.scene.remove(this.sculptHl);
      this.sculptHl.geometry?.dispose();
      this.sculptHl.material?.dispose?.();
    }
    this.particles?.dispose?.();
    this.audio?.dispose?.();
    this.renderer.dispose();
    this.renderer = null;
  }
}

function makeNameSprite(name) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(0, 8, 256, 48);
  g.font = "bold 30px Consolas, monospace";
  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  spr.scale.set(1.7, 0.42, 1);
  return spr;
}

function sndMat(id) {
  const d = def(id);
  if (!d) return "stone";
  if (d.tool === "pickaxe") return "stone";
  if (d.tool === "shovel") return id === B.sand || id === B.gravel ? "sand" : "dirt";
  if (d.tool === "axe") return "wood";
  if (id === B.glass || id === B.ice) return "glass";
  if (id === B.snow) return "snow";
  if (id === B.water || id === B.lava) return "stone";
  return "dirt";
}
