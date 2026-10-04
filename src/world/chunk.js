import * as THREE from "three";
import { def, isOpaque, isFluid, B } from "../core/blocks.js";
import { tilesFor, tileUV } from "../core/atlas.js";
import { hash2 } from "../core/noise.js";

export const CS = 16;
export const CH = 80;

// brightness per AO level (0 = fully occluded corner, 3 = open)
const AOL = [0.44, 0.63, 0.82, 1.0];

const FACES = [
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], dir: "top", shade: 1.0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], dir: "bot", shade: 0.55 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], dir: "side", shade: 0.74 },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], dir: "side", shade: 0.74 },
  { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], dir: "side", shade: 0.84 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], dir: "side", shade: 0.84 },
];

// precompute each face vertex's (du, dv) position on the face plane, used for AO sampling
for (const f of FACES) {
  f.corners = f.verts.map(([vx, vy, vz]) => {
    const cx = vx * 2 - 1;
    const cy = vy * 2 - 1;
    const cz = vz * 2 - 1;
    return [cx * f.u[0] + cy * f.u[1] + cz * f.u[2], cx * f.v[0] + cy * f.v[1] + cz * f.v[2]];
  });
}

const AO_SAMPLES = new Uint8Array(9);

function sampleAO(world, x, y, z, f) {
  const bx = x + f.n[0];
  const by = y + f.n[1];
  const bz = z + f.n[2];
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      const i = (a + 1) * 3 + (b + 1);
      if (a === 0 && b === 0) {
        AO_SAMPLES[i] = 0;
        continue;
      }
      AO_SAMPLES[i] = isOpaque(world.getBlock(bx + f.u[0] * a + f.v[0] * b, by + f.u[1] * a + f.v[1] * b, bz + f.u[2] * a + f.v[2] * b)) ? 1 : 0;
    }
  }
}

function vertAO(du, dv) {
  const s1 = AO_SAMPLES[(du + 1) * 3 + 1];
  const s2 = AO_SAMPLES[4 + dv];
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + AO_SAMPLES[(du + 1) * 3 + (dv + 1)]);
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CS * CH * CS);
    this.dirty = true;
    this.mesh = null;
    this.tmesh = null;
    this.wmesh = null;
    this.lmesh = null;
    this.group = new THREE.Group();
    this.generated = false;
  }

  idx(x, y, z) {
    return y + x * CH + z * CH * CS;
  }

  get(lx, y, lz) {
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= CH) return 0;
    return this.blocks[this.idx(lx, y, lz)];
  }

  set(lx, y, lz, id) {
    if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= CH) return;
    this.blocks[this.idx(lx, y, lz)] = id;
    this.dirty = true;
  }

  removeMesh(key) {
    if (this[key]) {
      this.group.remove(this[key]);
      this[key].geometry.dispose();
      this[key] = null;
    }
  }

  rebuild(world, mats) {
    this.removeMesh("mesh");
    this.removeMesh("tmesh");
    this.removeMesh("wmesh");
    this.removeMesh("lmesh");
    const solid = { p: [], n: [], u: [], c: [], i: [] };
    const trans = { p: [], n: [], u: [], c: [], i: [] };
    const water = { p: [], n: [], u: [], c: [], i: [] };
    const lava = { p: [], n: [], u: [], c: [], i: [] };
    const ox = this.cx * CS;
    const oz = this.cz * CS;
    // cache the 3x3 neighbouring chunks: meshing does hundreds of thousands of
    // lookups and building "cx,cz" strings for each one causes GC lag spikes
    const ring = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        ring.push(world.chunks.get(world.key(this.cx + dx, this.cz + dz)) || null);
      }
    }
    const getW = (x, y, z) => {
      if (y < 0 || y >= CH) return 0;
      const gx = Math.floor(x / CS) - this.cx + 1;
      const gz = Math.floor(z / CS) - this.cz + 1;
      if (gx < 0 || gx > 2 || gz < 0 || gz > 2) return world.getBlock(x, y, z);
      const ch = ring[gx * 3 + gz];
      if (!ch) return 0;
      return ch.get(((x % CS) + CS) % CS, y, ((z % CS) + CS) % CS);
    };

    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        for (let y = 0; y < CH; y++) {
          const id = this.get(lx, y, lz);
          if (!id) continue;
          const d = def(id);
          if (d.item) continue;
          const wx = ox + lx;
          const wz = oz + lz;
          let dest;
          if (id === B.water) dest = water;
          else if (id === B.lava) dest = lava;
          else if (!isOpaque(id)) dest = trans;
          else dest = solid;
          const [top, bot, side] = tilesFor(id);
          const vary = 0.94 + hash2(wx * 3 + y * 7, wz * 5 - y * 11, 777) * 0.09;
          for (const f of FACES) {
            const nx = wx + f.n[0];
            const ny = y + f.n[1];
            const nz = wz + f.n[2];
            const nb = getW(nx, ny, nz);
            if (!shouldFace(id, nb)) continue;
            const tile = f.dir === "top" ? top : f.dir === "bot" ? bot : side;
            addFace(dest, wx, y, wz, f, tile, id, world, vary, getW);
          }
        }
      }
    }
    this.mesh = makeMesh(solid, mats.opaque);
    this.tmesh = makeMesh(trans, mats.trans);
    this.wmesh = makeMesh(water, mats.water || mats.trans);
    this.lmesh = makeMesh(lava, mats.lava || mats.opaque);
    if (this.mesh) this.group.add(this.mesh);
    if (this.tmesh) this.group.add(this.tmesh);
    if (this.wmesh) this.group.add(this.wmesh);
    if (this.lmesh) this.group.add(this.lmesh);
    this.dirty = false;
  }
}

function shouldFace(id, nb) {
  if (!nb) return true;
  if (id === nb && isFluid(id)) return false;
  if (isOpaque(nb)) return false;
  if (isFluid(id) && isFluid(nb)) return false;
  return true;
}

function addFace(buf, x, y, z, f, tile, id, world, vary, getW) {
  const fluid = id === B.water || id === B.lava;
  let uvs;
  if (fluid) {
    // dedicated scrolling fluid textures cover the whole tile
    uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  } else {
    const [u0, v0, u1, v1] = tileUV(tile);
    uvs = [u0, v0, u1, v0, u1, v1, u0, v1];
  }
  // lower the top of fluids (and flat blocks) so their surface sits below the block top
  let topDrop = 0;
  if (id === B.water && getW(x, y + 1, z) !== B.water) topDrop = -0.12;
  if (id === B.redstone && f.dir === "top") topDrop = -0.92;
  const bi = buf.p.length / 3;
  const doAO = !fluid;
  if (doAO) sampleAO(world, x, y, z, f);
  for (let i = 0; i < 4; i++) {
    const v = f.verts[i];
    const yy = v[1] === 1 ? y + 1 + topDrop : y;
    buf.p.push(x + v[0], yy, z + v[2]);
    buf.n.push(f.n[0], f.n[1], f.n[2]);
    buf.u.push(uvs[i * 2], uvs[i * 2 + 1]);
    let light = f.shade * vary;
    if (doAO) light *= AOL[vertAO(f.corners[i][0], f.corners[i][1])];
    buf.c.push(light, light, light);
  }
  buf.i.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
}

function makeMesh(buf, mat) {
  if (!buf.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(buf.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.u, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(buf.c, 3));
  g.setIndex(buf.i);
  return new THREE.Mesh(g, mat);
}
