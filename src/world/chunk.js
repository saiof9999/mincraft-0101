import * as THREE from "three";
import { def, isOpaque, isFluid, B } from "../core/blocks.js";
import { tilesFor, tileUV } from "../core/atlas.js";

export const CS = 16;
export const CH = 80;

const FACES = [
  { n: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], dir: "top" },
  { n: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], dir: "bot" },
  { n: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], dir: "side" },
  { n: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], dir: "side" },
  { n: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], dir: "side" },
  { n: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], dir: "side" },
];

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CS * CH * CS);
    this.dirty = true;
    this.mesh = null;
    this.tmesh = null;
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

  rebuild(world, mats) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.tmesh) {
      this.group.remove(this.tmesh);
      this.tmesh.geometry.dispose();
      this.tmesh = null;
    }
    const solid = { p: [], n: [], u: [], i: [] };
    const trans = { p: [], n: [], u: [], i: [] };
    const ox = this.cx * CS;
    const oz = this.cz * CS;
    const getW = (x, y, z) => world.getBlock(x, y, z);

    for (let lz = 0; lz < CS; lz++) {
      for (let lx = 0; lx < CS; lx++) {
        for (let y = 0; y < CH; y++) {
          const id = this.get(lx, y, lz);
          if (!id) continue;
          const d = def(id);
          if (d.item) continue;
          const wx = ox + lx;
          const wz = oz + lz;
          const dest = !isOpaque(id) || isFluid(id) ? trans : solid;
          const [top, bot, side] = tilesFor(id);
          for (const f of FACES) {
            const nx = wx + f.n[0];
            const ny = y + f.n[1];
            const nz = wz + f.n[2];
            const nb = getW(nx, ny, nz);
            const show = shouldFace(id, nb);
            if (!show) continue;
            const tile = f.dir === "top" ? top : f.dir === "bot" ? bot : side;
            addFace(dest, wx, y, wz, f, tile, id);
          }
        }
      }
    }
    this.mesh = makeMesh(solid, mats.opaque);
    this.tmesh = makeMesh(trans, mats.trans);
    if (this.mesh) this.group.add(this.mesh);
    if (this.tmesh) this.group.add(this.tmesh);
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

function addFace(buf, x, y, z, f, tile, id) {
  const [u0, v0, u1, v1] = tileUV(tile);
  const uvs = [u0, v0, u1, v0, u1, v1, u0, v1];
  let yOff = 0;
  if (id === B.water && f.dir === "top") yOff = -0.12;
  if (id === B.redstone && f.dir === "top") yOff = -0.92;
  const bi = buf.p.length / 3;
  for (let i = 0; i < 4; i++) {
    const v = f.verts[i];
    buf.p.push(x + v[0], y + v[1] + yOff, z + v[2]);
    buf.n.push(f.n[0], f.n[1], f.n[2]);
    buf.u.push(uvs[i * 2], uvs[i * 2 + 1]);
  }
  buf.i.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
}

function makeMesh(buf, mat) {
  if (!buf.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(buf.p, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.n, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.u, 2));
  g.setIndex(buf.i);
  return new THREE.Mesh(g, mat);
}
