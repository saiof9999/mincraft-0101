import * as THREE from "three";
import { def } from "../core/blocks.js";
import { tilesFor, tileUV } from "../core/atlas.js";

function mapUV(attr, i, tile) {
  const [u0, v0, u1, v1] = tileUV(tile);
  attr.setXY(i, u0 + attr.getX(i) * (u1 - u0), v0 + attr.getY(i) * (v1 - v0));
}

function remapBoxUVs(geo, tiles) {
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  const faceTiles = [tiles[2], tiles[2], tiles[0], tiles[1], tiles[2], tiles[2]];
  const attr = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) mapUV(attr, f * 4 + i, faceTiles[f]);
  }
  attr.needsUpdate = true;
}

function remapPlaneUVs(geo, tile) {
  const attr = geo.attributes.uv;
  for (let i = 0; i < 4; i++) mapUV(attr, i, tile);
  attr.needsUpdate = true;
}

/** First-person held item with swing / bob animation. Attached to the camera. */
export class Hand {
  constructor(camera, baseMat, atlasTex) {
    this.id = -1;
    this.swingT = 1;
    this.dipT = 1;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.blockMat = baseMat.clone();
    this.blockMat.vertexColors = false;
    this.itemMat = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide });
    this.mesh = null;
  }

  setId(id) {
    this.id = id;
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    const d = def(id);
    if (!id || !d) return;
    if (d.item) {
      const geo = new THREE.PlaneGeometry(0.6, 0.6);
      remapPlaneUVs(geo, Array.isArray(d.tile) ? d.tile[2] : d.tile ?? 80);
      this.mesh = new THREE.Mesh(geo, this.itemMat);
      this.mesh.rotation.set(0.1, -0.55, -0.75);
      this.mesh.position.set(0.02, 0.05, 0.12);
    } else {
      const geo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      remapBoxUVs(geo, tilesFor(id));
      this.mesh = new THREE.Mesh(geo, this.blockMat);
      this.mesh.rotation.set(0.34, -0.72, 0.1);
    }
    this.group.add(this.mesh);
    this.dipT = 0;
  }

  swing() {
    this.swingT = 0;
  }

  /** repeated swing while mining */
  mineSwing() {
    if (this.swingT >= 0.55) this.swingT = 0;
  }

  update(dt, player, visible) {
    this.group.visible = !!visible;
    if (!visible) return;
    if (this.swingT < 1) this.swingT = Math.min(1, this.swingT + dt / 0.26);
    if (this.dipT < 1) this.dipT = Math.min(1, this.dipT + dt / 0.24);
    const s = Math.sin(Math.min(1, this.swingT) * Math.PI);
    const amp = player.bobAmp || 0;
    const w = player.walk || 0;
    this.group.position.set(
      0.52 + Math.sin(w * 1.6) * 0.018 * amp,
      -0.44 - Math.abs(Math.sin(w * 1.6)) * 0.03 * amp - s * 0.13 - (1 - this.dipT) * 0.4,
      -0.78 - s * 0.18
    );
    this.group.rotation.set(-s * 0.95, s * 0.4, -s * 0.25);
  }
}
