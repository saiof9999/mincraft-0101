import { B } from "../core/blocks.js";

const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, 1, 0],
  [0, -1, 0],
];

export class Redstone {
  constructor(world) {
    this.world = world;
    this.power = new Map();
    this.buttons = new Map();
  }

  key(x, y, z) {
    return `${x},${y},${z}`;
  }

  getP(x, y, z) {
    return this.power.get(this.key(x, y, z)) || 0;
  }

  tick() {
    const w = this.world;
    const sources = [];
    for (const ch of w.chunks.values()) {
      const ox = ch.cx * 16;
      const oz = ch.cz * 16;
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          for (let y = 0; y < 80; y++) {
            const id = ch.get(lx, y, lz);
            const x = ox + lx;
            const z = oz + lz;
            if (id === B.lever || id === B.rsTorch || id === B.button) {
              const on = id === B.rsTorch ? !this.poweredBlock(x, y - 1, z) : this.metaOn(x, y, z);
              if (id === B.button) {
                const t = this.buttons.get(this.key(x, y, z)) || 0;
                if (t > 0) {
                  this.buttons.set(this.key(x, y, z), t - 1);
                  sources.push([x, y, z, 15]);
                }
              } else if (on) sources.push([x, y, z, 15]);
            }
          }
        }
      }
    }
    const next = new Map();
    const q = [];
    for (const s of sources) {
      next.set(this.key(s[0], s[1], s[2]), s[3]);
      q.push(s);
    }
    while (q.length) {
      const [x, y, z, p] = q.pop();
      if (p <= 1) continue;
      const id = w.getBlock(x, y, z);
      const np = id === B.repeater ? 15 : p - 1;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        const nid = w.getBlock(nx, ny, nz);
        if (nid === B.redstone || nid === B.rsLamp || nid === B.lampOn || nid === B.piston || nid === B.repeater || nid === B.tnt) {
          const k = this.key(nx, ny, nz);
          if ((next.get(k) || 0) < np) {
            next.set(k, np);
            if (nid === B.redstone || nid === B.repeater) q.push([nx, ny, nz, nid === B.repeater ? 15 : np]);
          }
        }
      }
    }
    this.power = next;
    for (const [k, p] of next) {
      const [x, y, z] = k.split(",").map(Number);
      const id = w.getBlock(x, y, z);
      if (id === B.rsLamp && p > 0) w.setBlock(x, y, z, B.lampOn);
      if (id === B.lampOn && p <= 0) w.setBlock(x, y, z, B.rsLamp);
      if (id === B.tnt && p > 0) {
        w.setBlock(x, y, z, 0);
        w.explode(x, y, z, 3);
      }
      if (id === B.piston && p > 0) this.extendPiston(x, y, z);
    }
  }

  metaOn(x, y, z) {
    return this.world.meta.get(this.key(x, y, z)) === 1;
  }

  toggle(x, y, z) {
    const k = this.key(x, y, z);
    const id = this.world.getBlock(x, y, z);
    if (id === B.lever) {
      this.world.meta.set(k, this.world.meta.get(k) === 1 ? 0 : 1);
      return true;
    }
    if (id === B.button) {
      this.buttons.set(k, 10);
      return true;
    }
    return false;
  }

  poweredBlock(x, y, z) {
    return this.getP(x, y, z) > 0;
  }

  extendPiston(x, y, z) {
    const front = [x, y + 1, z];
    const dest = [x, y + 2, z];
    const moving = this.world.getBlock(...front);
    if (moving === B.bedrock || moving === B.obsidian) return;
    if (this.world.getBlock(...dest) && this.world.getBlock(...dest) !== B.pistonHead) return;
    this.world.setBlock(...dest, moving);
    this.world.setBlock(...front, B.pistonHead);
  }
}
