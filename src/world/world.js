import * as THREE from "three";
import { Chunk, CS, CH } from "./chunk.js";
import { generateChunk, heightAt, biomeAt, strongholdHere, carveStronghold, SEA } from "./gen.js";
import { B, isSolid } from "../core/blocks.js";
import { hash2 } from "../core/noise.js";
import { createAtlas } from "../core/atlas.js";
import { makeWaterCanvas, makeLavaCanvas } from "../core/textures.js";

function fluidTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene, seed, dim = "overworld") {
    this.scene = scene;
    this.seed = seed;
    this.dim = dim;
    this.chunks = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.atlas = createAtlas();
    const tex = new THREE.CanvasTexture(this.atlas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mats = {
      opaque: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }),
      trans: new THREE.MeshLambertMaterial({
        map: tex,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.1,
        depthWrite: false,
      }),
      water: new THREE.MeshLambertMaterial({
        map: fluidTexture(makeWaterCanvas()),
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
      lava: new THREE.MeshBasicMaterial({ map: fluidTexture(makeLavaCanvas()), vertexColors: true }),
    };
    this.meta = new Map();
    this.view = 4;
    this.extras = {};
    this.edits = new Map();
    this.minis = new Map(); // "x,y,z" -> Uint8Array(4*4*4) of sub-block ids
    this.onChange = null;
    this.onExplode = null;
    this.animT = 0;
  }

  miniIndex(sx, sy, sz) {
    return sy * 16 + sz * 4 + sx;
  }

  getMini(x, y, z) {
    return this.minis.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) || null;
  }

  setMini(x, y, z, sx, sy, sz, id) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    let data = this.minis.get(key);
    if (!data) {
      data = new Uint8Array(64);
      this.minis.set(key, data);
    }
    data[this.miniIndex(sx, sy, sz)] = id;
  }

  removeMini(x, y, z) {
    this.minis.delete(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
  }

  dumpMinis() {
    const arr = [];
    for (const [k, data] of this.minis) arr.push([k, Array.from(data)]);
    return arr;
  }

  loadMinis(list) {
    if (!list) return;
    for (const [k, data] of list) this.minis.set(k, Uint8Array.from(data));
  }

  /** scroll the animated fluid textures */
  tickAnim(dt) {
    this.animT += dt;
    const w = this.mats.water.map;
    w.offset.set((this.animT * 0.03) % 1, (this.animT * 0.021) % 1);
    const l = this.mats.lava.map;
    l.offset.set((this.animT * 0.006) % 1, (this.animT * 0.004) % 1);
  }

  key(cx, cz) {
    return `${cx},${cz}`;
  }

  chunkAt(wx, wz) {
    const cx = Math.floor(wx / CS);
    const cz = Math.floor(wz / CS);
    return this.chunks.get(this.key(cx, cz));
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    // one-entry memo: consecutive lookups usually land in the same chunk,
    // this avoids allocating a key string for every single block query
    let ch = this._lc;
    if (!ch || this._lcx !== cx || this._lcz !== cz) {
      ch = this.chunks.get(this.key(cx, cz));
      this._lc = ch;
      this._lcx = cx;
      this._lcz = cz;
    }
    if (!ch) return 0;
    return ch.get(((x % CS) + CS) % CS, y, ((z % CS) + CS) % CS);
  }

  setBlock(x, y, z, id, opts = {}) {
    if (y < 0 || y >= CH) return;
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    this.ensureChunk(cx, cz);
    const ch = this.chunks.get(this.key(cx, cz));
    ch.set(((x % CS) + CS) % CS, y, ((z % CS) + CS) % CS, id);
    ch.dirty = true;
    this.markNeighbor(x, z);
    if (opts.record !== false) this.edits.set(`${x},${y},${z}`, id);
    if (opts.silent !== true) this.onChange?.(x, y, z, id, this.dim);
  }

  markNeighbor(x, z) {
    const lx = ((x % CS) + CS) % CS;
    const lz = ((z % CS) + CS) % CS;
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    if (lx === 0) this.dirtyChunk(cx - 1, cz);
    if (lx === 15) this.dirtyChunk(cx + 1, cz);
    if (lz === 0) this.dirtyChunk(cx, cz - 1);
    if (lz === 15) this.dirtyChunk(cx, cz + 1);
  }

  dirtyChunk(cx, cz) {
    const ch = this.chunks.get(this.key(cx, cz));
    if (ch) ch.dirty = true;
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return this.chunks.get(k);
    const ch = new Chunk(cx, cz);
    const set = (x, y, z, id) => {
      const ccx = Math.floor(x / CS);
      const ccz = Math.floor(z / CS);
      if (ccx !== cx || ccz !== cz) return;
      ch.set(((x % CS) + CS) % CS, y, ((z % CS) + CS) % CS, id);
    };
    generateChunk(cx, cz, this.dim, this.seed, set, this.extras);
    if (this.dim === "overworld" && strongholdHere(cx, cz, this.seed)) carveStronghold(cx, cz, set);
    this.applyEditsToChunk(ch);
    ch.generated = true;
    this.chunks.set(k, ch);
    this.group.add(ch.group);
    return ch;
  }

  applyEditsToChunk(ch) {
    const ox = ch.cx * CS;
    const oz = ch.cz * CS;
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(",").map(Number);
      if (Math.floor(x / CS) !== ch.cx || Math.floor(z / CS) !== ch.cz) continue;
      if (y < 0 || y >= CH) continue;
      ch.set(((x % CS) + CS) % CS, y, ((z % CS) + CS) % CS, id);
    }
  }

  loadEdits(list) {
    if (!list) return;
    if (Array.isArray(list)) {
      for (const [x, y, z, id] of list) this.edits.set(`${x},${y},${z}`, id);
    } else {
      for (const [key, id] of Object.entries(list)) this.edits.set(key, id);
    }
    for (const ch of this.chunks.values()) {
      this.applyEditsToChunk(ch);
      ch.dirty = true;
    }
  }

  dumpEdits() {
    const o = {};
    for (const [k, v] of this.edits) o[k] = v;
    return o;
  }

  stream(px, pz) {
    const pcx = Math.floor(px / CS);
    const pcz = Math.floor(pz / CS);
    const v = this.view;
    for (let dz = -v; dz <= v; dz++) {
      for (let dx = -v; dx <= v; dx++) {
        if (dx * dx + dz * dz > v * v) continue;
        this.ensureChunk(pcx + dx, pcz + dz);
      }
    }
    let rebuilt = 0;
    for (const ch of this.chunks.values()) {
      const dx = ch.cx - pcx;
      const dz = ch.cz - pcz;
      if (dx * dx + dz * dz > (v + 2) * (v + 2)) {
        this.group.remove(ch.group);
        this.chunks.delete(this.key(ch.cx, ch.cz));
        this._lc = null;
        continue;
      }
      if (ch.dirty && rebuilt < 6) {
        ch.rebuild(this, this.mats);
        rebuilt++;
      }
    }
  }

  spawnPos() {
    if (this.dim === "nether") return { x: 8, y: 48, z: 8 };
    if (this.dim === "end") return { x: 0, y: 64, z: 0 };
    // same hashes world generation uses, so we can predict trees/cacti before chunks exist
    const treeAt = (bx, bz) => {
      const b = biomeAt(bx, bz, this.seed);
      if (heightAt(bx, bz, this.seed) <= SEA + 1) return false;
      if (b === "forest" && hash2(bx, bz, this.seed + 40) > 0.94) return true;
      if (b === "plains" && hash2(bx, bz, this.seed + 41) > 0.985) return true;
      if (b === "desert" && hash2(bx, bz, this.seed + 42) > 0.97) return true;
      return false;
    };
    // spiral outward until we find dry, tree-free land (rarely spawn in water)
    for (let r = 0; r < 40; r++) {
      const rad = r * 6;
      const steps = Math.max(1, r * 8);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * rad);
        const z = Math.round(Math.sin(a) * rad);
        const bio = biomeAt(x, z, this.seed);
        if (bio === "ocean" || bio === "beach") continue;
        // avoid the spot itself AND nearby columns: tree canopies are solid and
        // reach 2 blocks sideways, so a neighbouring tree could trap the player
        let nearTree = false;
        for (let dz = -2; dz <= 2 && !nearTree; dz++) {
          for (let dx = -2; dx <= 2 && !nearTree; dx++) {
            if (treeAt(x + dx, z + dz)) nearTree = true;
          }
        }
        if (nearTree) continue;
        // require the spot and its 4 neighbours to be dry land (no 1-block sand spits)
        let dry = true;
        for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (heightAt(x + dx, z + dz, this.seed) <= SEA + 1) {
            dry = false;
            break;
          }
        }
        if (!dry) continue;
        const h = heightAt(x, z, this.seed);
        return { x: x + 0.5, y: h + 2, z: z + 0.5 };
      }
    }
    const h = heightAt(0, 0, this.seed);
    return { x: 0.5, y: h + 3, z: 0.5 };
  }

  surfaceY(x, z) {
    for (let y = CH - 2; y > 0; y--) {
      if (isSolid(this.getBlock(x, y, z))) return y + 1;
    }
    return SEA + 2;
  }

  explode(x, y, z, r) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy + dz * dz > r * r) continue;
          const id = this.getBlock(x + dx, y + dy, z + dz);
          if (id === B.bedrock || id === B.obsidian) continue;
          this.setBlock(x + dx, y + dy, z + dz, 0);
        }
      }
    }
    for (const key of [...this.minis.keys()]) {
      const [mx, my, mz] = key.split(",").map(Number);
      if (Math.abs(mx - x) <= r && Math.abs(my - y) <= r && Math.abs(mz - z) <= r) this.minis.delete(key);
    }
    this.onExplode?.(x + 0.5, y + 0.5, z + 0.5, r);
  }

  findPortal(kind, fromX, fromZ) {
    const scale = kind === B.netherPortal ? (this.dim === "nether" ? 8 : 0.125) : 1;
    const tx = Math.floor(fromX * scale);
    const tz = Math.floor(fromZ * scale);
    for (let r = 0; r < 32; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          for (let y = 4; y < 70; y++) {
            if (this.getBlock(tx + dx, y, tz + dz) === kind) {
              return { x: tx + dx + 0.5, y: y, z: tz + dz + 0.5 };
            }
          }
        }
      }
    }
    return null;
  }

  buildNetherPortal(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        const edge = dx === 0 || dx === 3 || dy === 0 || dy === 4;
        this.setBlock(x + dx, y + dy, z, edge ? B.obsidian : B.netherPortal);
      }
    }
  }

  tryLightPortal(x, y, z) {
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (this.getBlock(x + dx, y, z + dz) === B.obsidian || this.getBlock(x, y, z) === B.obsidian) {
        if (this.scanFrame(x, y, z)) return true;
      }
    }
    return this.scanFrame(x, y, z);
  }

  scanFrame(x, y, z) {
    for (let ox = -3; ox <= 3; ox++) {
      for (let oy = -4; oy <= 1; oy++) {
        if (this.innerPortal(x + ox, y + oy, z, 1, 0)) return true;
        if (this.innerPortal(x + ox, y + oy, z, 0, 1)) return true;
      }
    }
    return false;
  }

  innerPortal(x, y, z, ax, az) {
    const w = 2;
    const h = 3;
    for (let i = -1; i <= w; i++) {
      if (this.getBlock(x + ax * i, y - 1, z + az * i) !== B.obsidian) return false;
      if (this.getBlock(x + ax * i, y + h, z + az * i) !== B.obsidian) return false;
    }
    for (let j = 0; j < h; j++) {
      if (this.getBlock(x - ax, y + j, z - az) !== B.obsidian) return false;
      if (this.getBlock(x + ax * w, y + j, z + az * w) !== B.obsidian) return false;
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        this.setBlock(x + ax * i, y + j, z + az * i, B.netherPortal);
      }
    }
    return true;
  }

  fillEndPortal(x, y, z) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (Math.abs(dx) < 2 && Math.abs(dz) < 2) this.setBlock(x + dx, y, z + dz, B.endPortal);
      }
    }
  }
}
