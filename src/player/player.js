import * as THREE from "three";
import { isSolid, isFluid, B, I, def } from "../core/blocks.js";
import { Inventory } from "./inventory.js";

export class Player {
  constructor(world, mode) {
    this.world = world;
    this.mode = mode;
    this.inv = new Inventory();
    const s = world.spawnPos();
    this.pos = new THREE.Vector3(s.x, s.y, s.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = mode === "creative";
    this.sprint = false;
    this.sneak = false;
    this.swim = false;
    this.health = 20;
    this.hunger = 20;
    this.sat = 5;
    this.xp = 0;
    this.hurtCd = 0;
    this.w = 0.6;
    this.h = 1.8;
    this.eye = 1.62;
    this.camMode = 0;
    this.sens = 0.0035;
    this.fov = 75;
    this.thirdDist = 4.2;
    this.invertY = false;
    this.keys = {};
    this.model = makeBody();
    this.walk = 0;
    this.bob = 0;
    this.attackCd = 0;
    this.breakT = 0;
    this.breakPos = null;
    this.portalT = 0;
    this.boat = null;
    this.dim = world.dim;
    this.dead = false;
    this.fallStart = s.y;
    if (mode === "creative") this.fillCreative();
    else this.fillSurvival();
  }

  fillSurvival() {
    this.inv.add(B.planks, 16);
    this.inv.add(B.torch, 8);
    this.inv.add(I.wPick, 1);
  }

  fillCreative() {
    const start = [B.grass, B.dirt, B.stone, B.cobble, B.log, B.planks, B.glass, B.torch, B.tnt];
    start.forEach((id, i) => {
      this.inv.hotbar[i] = { id, count: 64 };
    });
  }

  eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  rightDir() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  look(dx, dy) {
    this.yaw -= dx * this.sens;
    const s = this.invertY ? -1 : 1;
    this.pitch -= dy * this.sens * s;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  aabb(px = this.pos.x, py = this.pos.y, pz = this.pos.z) {
    const hw = this.w / 2;
    return { x0: px - hw, x1: px + hw, y0: py, y1: py + this.h, z0: pz - hw, z1: pz + hw };
  }

  collides(px, py, pz) {
    const b = this.aabb(px, py, pz);
    const x0 = Math.floor(b.x0);
    const x1 = Math.floor(b.x1);
    const y0 = Math.floor(b.y0);
    const y1 = Math.floor(b.y1);
    const z0 = Math.floor(b.z0);
    const z1 = Math.floor(b.z1);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const id = this.world.getBlock(x, y, z);
          if (isSolid(id) && id !== B.netherPortal && id !== B.endPortal) return true;
        }
      }
    }
    return false;
  }

  inFluid(kind) {
    const e = this.eyePos();
    const feet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const head = this.world.getBlock(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    if (kind) return feet === kind || head === kind;
    return isFluid(feet) || isFluid(head);
  }

  update(dt, camera) {
    if (this.dead) return;
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    const k = this.keys;
    if (k.ArrowLeft) this.yaw += 2.4 * dt;
    if (k.ArrowRight) this.yaw -= 2.4 * dt;
    if (k.ArrowUp) this.pitch = Math.min(Math.PI / 2 - 0.01, this.pitch + 1.8 * dt);
    if (k.ArrowDown) this.pitch = Math.max(-Math.PI / 2 + 0.01, this.pitch - 1.8 * dt);
    this.sprint = !!(k.ControlLeft || k.ControlRight);
    this.sneak = !!(k.ShiftLeft || k.ShiftRight);
    if (this.boat) {
      this.updateBoat(dt);
      this.applyCamera(camera);
      this.syncModel(dt);
      return;
    }

    let speed = this.flying ? 12 : this.sprint ? 5.6 : 4.3;
    if (this.sneak && !this.flying) speed = 1.3;
    if (this.inFluid(B.water) && !this.flying) speed = 2.2;
    if (this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)) === B.soulSand) speed *= 0.4;

    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = this.rightDir();
    const wish = new THREE.Vector3();
    if (k.KeyW) wish.add(f);
    if (k.KeyS) wish.sub(f);
    if (k.KeyA) wish.sub(r);
    if (k.KeyD) wish.add(r);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    if (this.flying) {
      this.vel.x = wish.x;
      this.vel.z = wish.z;
      this.vel.y = 0;
      if (k.Space) this.vel.y += speed;
      if (this.sneak) this.vel.y -= speed;
    } else {
      this.vel.x = wish.x;
      this.vel.z = wish.z;
      const water = this.inFluid(B.water);
      const lava = this.inFluid(B.lava);
      if (water || lava) {
        this.vel.y += (k.Space ? 8 : -3) * dt;
        this.vel.y *= 0.9;
        if (lava && this.mode === "survival") this.hurt(4 * dt, "lava");
      } else {
        this.vel.y -= 28 * dt;
        if (k.Space && this.onGround) this.vel.y = 8.4;
      }
    }

    this.moveAxis("x", this.vel.x * dt);
    this.moveAxis("z", this.vel.z * dt);
    this.onGround = false;
    const before = this.pos.y;
    this.moveAxis("y", this.vel.y * dt);
    if (this.pos.y === before && this.vel.y < 0) {
      this.onGround = true;
      if (this.mode === "survival" && this.fallStart - this.pos.y > 4) {
        const dmg = Math.floor(this.fallStart - this.pos.y - 3);
        if (dmg > 0) this.hurt(dmg, "fall");
      }
      this.vel.y = 0;
      this.fallStart = this.pos.y;
    }
    if (!this.onGround && this.vel.y > 0) this.fallStart = this.pos.y;
    if (this.pos.y < -4 && this.mode === "survival") this.hurt(20, "void");

    if (wish.lengthSq() > 0 && this.onGround) this.walk += dt * speed;
    this.bob += dt * (this.onGround && wish.lengthSq() ? speed : 0);

    this.portalLogic(dt);
    this.applyCamera(camera);
    this.syncModel(dt);
  }

  updateBoat(dt) {
    const b = this.boat;
    const k = this.keys;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (k.KeyW) b.vel.addScaledVector(f, 14 * dt);
    if (k.KeyS) b.vel.addScaledVector(f, -8 * dt);
    if (k.KeyA) this.yaw += 1.6 * dt;
    if (k.KeyD) this.yaw -= 1.6 * dt;
    b.vel.multiplyScalar(0.96);
    b.pos.addScaledVector(b.vel, dt);
    const y = this.world.surfaceY(Math.floor(b.pos.x), Math.floor(b.pos.z));
    const id = this.world.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z));
    if (id === B.water) b.pos.y += (Math.floor(b.pos.y) + 0.7 - b.pos.y) * 0.2;
    else b.pos.y += (y + 0.2 - b.pos.y) * 0.15;
    this.pos.copy(b.pos);
    this.pos.y += 0.4;
    if (k.Space) {
      this.boat = null;
      this.pos.y += 0.8;
    }
  }

  moveAxis(axis, delta) {
    this.pos[axis] += delta;
    if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos[axis] -= delta;
      this.vel[axis] = 0;
    }
  }

  applyCamera(camera) {
    const eye = this.eyePos();
    const dir = this.lookDir();
    camera.fov = this.fov;
    camera.updateProjectionMatrix();
    if (this.camMode === 0) {
      camera.position.copy(eye);
      camera.rotation.order = "YXZ";
      camera.rotation.y = this.yaw;
      camera.rotation.x = -this.pitch;
      this.model.visible = false;
    } else {
      this.model.visible = true;
      const back = this.camMode === 1 ? -this.thirdDist : this.thirdDist;
      let pos = eye.clone().addScaledVector(dir, back);
      pos = this.clipCam(eye, pos);
      camera.position.copy(pos);
      camera.lookAt(eye);
    }
  }

  clipCam(from, to) {
    const d = to.clone().sub(from);
    const len = d.length();
    if (!len) return to;
    d.normalize();
    const step = 0.2;
    let dist = 0.4;
    while (dist < len) {
      const p = from.clone().addScaledVector(d, dist);
      if (isSolid(this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) {
        return from.clone().addScaledVector(d, Math.max(0.4, dist - step));
      }
      dist += step;
    }
    return to;
  }

  syncModel(dt) {
    this.model.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.model.rotation.y = this.yaw;
    const legs = this.model.getObjectByName("legs");
    if (legs) legs.rotation.x = Math.sin(this.walk * 4) * 0.5;
    const arms = this.model.getObjectByName("arms");
    if (arms) arms.rotation.x = Math.sin(this.walk * 4) * 0.4;
  }

  portalLogic(dt) {
    const id = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1), Math.floor(this.pos.z));
    if (id === B.netherPortal || id === B.endPortal) this.portalT += dt;
    else this.portalT = 0;
  }

  hurt(n, src) {
    if (this.mode === "creative" || this.hurtCd > 0 || this.dead) return;
    this.health -= n;
    this.hurtCd = 0.5;
    this.vel.y = Math.max(this.vel.y, 4);
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(n) {
    this.health = Math.min(20, this.health + n);
  }

  eat(food) {
    if (this.hunger >= 20) return false;
    this.hunger = Math.min(20, this.hunger + food);
    return true;
  }

  tickHunger(dt) {
    if (this.mode !== "survival") return;
    this.sat -= dt * (this.sprint ? 0.35 : 0.08);
    if (this.sat <= 0) {
      this.sat = 1;
      this.hunger = Math.max(0, this.hunger - 1);
    }
    if (this.hunger <= 0) this.hurt(1 * dt, "starve");
    if (this.hunger >= 18 && this.health < 20) this.health = Math.min(20, this.health + dt * 0.4);
  }
}

function makeBody() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3a6ea5 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3d4a8a });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.55;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirt);
  body.position.y = 0.95;
  const legs = new THREE.Group();
  legs.name = "legs";
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  l1.position.set(-0.12, 0.35, 0);
  const l2 = l1.clone();
  l2.position.x = 0.12;
  legs.add(l1, l2);
  const arms = new THREE.Group();
  arms.name = "arms";
  const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), shirt);
  a1.position.set(-0.38, 0.95, 0);
  const a2 = a1.clone();
  a2.position.x = 0.38;
  arms.add(a1, a2);
  g.add(head, body, legs, arms);
  g.visible = false;
  return g;
}

export function rayBlocks(world, origin, dir, max = 6) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(dir.x)) : Infinity;
  let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(dir.y)) : Infinity;
  let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(dir.z)) : Infinity;
  let face = [0, 0, 0];
  let dist = 0;
  while (dist < max) {
    const id = world.getBlock(x, y, z);
    if (id && isSolid(id) && id !== B.netherPortal && id !== B.endPortal && id !== B.fire) {
      return { x, y, z, id, face };
    }
    if (id === B.water && dist > 0.2) {
      /* continue through water */
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        tMaxX += tDeltaX;
        x += stepX;
        face = [-stepX, 0, 0];
      } else {
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        face = [0, 0, -stepZ];
      }
    } else if (tMaxY < tMaxZ) {
      dist = tMaxY;
      tMaxY += tDeltaY;
      y += stepY;
      face = [0, -stepY, 0];
    } else {
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      z += stepZ;
      face = [0, 0, -stepZ];
    }
  }
  return null;
}
