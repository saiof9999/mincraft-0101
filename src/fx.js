import * as THREE from "three";
import { TILE, COLS, ROWS } from "./core/atlas.js";
import { isSolid } from "./core/blocks.js";

const MAX_PARTICLES = 140;

/** Lightweight sprite particle pool for block debris and effects. */
export class Particles {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.active = [];
    this.variants = new Map();
  }

  texFor(tile) {
    if (!this.variants.has(tile)) {
      const tx = (tile % COLS) * TILE;
      const ty = Math.floor(tile / COLS) * TILE;
      const mats = [];
      for (let i = 0; i < 4; i++) {
        const c = document.createElement("canvas");
        c.width = 8;
        c.height = 8;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        const sx = tx + ((i * 5) % 8);
        const sy = ty + ((i * 3) % 8);
        g.drawImage(this.atlas, sx, sy, 8, 8, 0, 0, 8, 8);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.colorSpace = THREE.SRGBColorSpace;
        mats.push(new THREE.SpriteMaterial({ map: t }));
      }
      this.variants.set(tile, mats);
    }
    return this.variants.get(tile);
  }

  burst(x, y, z, tile, n = 12, opts = {}) {
    if (this.active.length > MAX_PARTICLES) return;
    const mats = this.texFor(tile);
    const spread = opts.spread ?? 0.6;
    const speed = opts.speed ?? 3.2;
    const up = opts.up ?? 2.6;
    const size = opts.size ?? 0.12;
    for (let i = 0; i < n; i++) {
      const mat = mats[(Math.random() * mats.length) | 0];
      const s = new THREE.Sprite(mat);
      s.position.set(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread);
      const life = 0.45 + Math.random() * 0.45;
      this.active.push({
        s,
        vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * up, (Math.random() - 0.5) * speed),
        life,
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.7),
        gravity: opts.gravity ?? 20,
      });
      this.scene.add(s);
    }
  }

  update(dt, world) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.s);
        this.active.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      const pos = p.s.position;
      const nx = pos.x + p.vel.x * dt;
      const ny = pos.y + p.vel.y * dt;
      const nz = pos.z + p.vel.z * dt;
      if (isSolid(world.getBlock(Math.floor(nx), Math.floor(pos.y), Math.floor(nz)))) {
        p.vel.x *= -0.3;
        p.vel.z *= -0.3;
      } else {
        pos.x = nx;
        pos.z = nz;
      }
      if (p.vel.y < 0 && isSolid(world.getBlock(Math.floor(pos.x), Math.floor(ny), Math.floor(pos.z)))) {
        p.vel.y = 0;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      } else {
        pos.y = ny;
      }
      const k = Math.min(1, p.life / p.maxLife * 1.6);
      p.s.scale.setScalar(p.size * k);
    }
  }

  dispose() {
    for (const p of this.active) this.scene.remove(p.s);
    this.active.length = 0;
    for (const mats of this.variants.values()) for (const m of mats) m.dispose();
    this.variants.clear();
  }
}
