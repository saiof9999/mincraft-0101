import * as THREE from "three";
import { B, I, def } from "../core/blocks.js";
import { isSolid } from "../core/blocks.js";

export class EntityManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spawnT = 0;
    this.itemMats = new Map();
  }

  itemSprite(tile) {
    let mat = this.itemMats.get(tile);
    if (!mat) {
      const c = document.createElement("canvas");
      c.width = 12;
      c.height = 12;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      const tx = (tile % 16) * 16;
      const ty = Math.floor(tile / 16) * 16;
      g.drawImage(this.world.atlas, tx + 2, ty + 2, 12, 12, 0, 0, 12, 12);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.SpriteMaterial({ map: t });
      this.itemMats.set(tile, mat);
    }
    return new THREE.Sprite(mat);
  }

  /** spawn a collectible item drop that falls and can be picked up */
  spawnDrop(x, y, z, id, count = 1) {
    if (!id) return null;
    const d = def(id);
    const e = makeMob("item", x, y, z);
    e.item = id;
    e.count = count;
    e.tile = Array.isArray(d?.tile) ? d.tile[2] : d?.tile ?? 80;
    e.mesh = this.itemSprite(e.tile);
    e.mesh.scale.setScalar(0.35);
    e.vel.set((Math.random() - 0.5) * 2.4, 2.6, (Math.random() - 0.5) * 2.4);
    this.group.add(e.mesh);
    this.list.push(e);
    return e;
  }

  spawn(type, x, y, z, extra = {}) {
    const e = makeMob(type, x, y, z);
    Object.assign(e, extra);
    this.group.add(e.mesh);
    this.list.push(e);
    return e;
  }

  spawnBoat(x, y, z) {
    return this.spawn("boat", x, y, z, { hp: 10, speed: 6 });
  }

  update(dt, player, game) {
    this.spawnT += dt;
    if (this.spawnT > 4) {
      this.spawnT = 0;
      this.autoSpawn(player);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      this.tick(e, dt, player, game);
      if (e.dead || e.hp <= 0) {
        this.loot(e, player);
        this.group.remove(e.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  autoSpawn(player) {
    if (this.list.length > 28) return;
    const dim = this.world.dim;
    const a = Math.random() * Math.PI * 2;
    const r = 18 + Math.random() * 22;
    const x = player.pos.x + Math.cos(a) * r;
    const z = player.pos.z + Math.sin(a) * r;
    const y = this.world.surfaceY(Math.floor(x), Math.floor(z));
    const night = gameTimeIsNight(player);
    if (dim === "overworld") {
      if (night && Math.random() < 0.7) {
        const types = ["zombie", "skeleton", "creeper", "spider"];
        this.spawn(types[(Math.random() * types.length) | 0], x, y, z);
      } else if (Math.random() < 0.5) {
        this.spawn(Math.random() < 0.5 ? "pig" : "cow", x, y, z);
      }
    } else if (dim === "nether") {
      this.spawn(Math.random() < 0.5 ? "piglin" : "ghast", x, y + (Math.random() < 0.5 ? 8 : 0), z);
    } else if (dim === "end") {
      if (Math.random() < 0.6) this.spawn("enderman", x, y, z);
    }
  }

  tick(e, dt, player, game) {
    e.age += dt;
    if (e.type === "remote") {
      // other players in multiplayer: interpolate toward their latest position
      if (e.target) e.pos.lerp(e.target, Math.min(1, dt * 8));
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.targetYaw || 0;
      e.mesh.visible = !e.rdim || e.rdim === this.world.dim;
      return;
    }
    if (e.type === "item") {
      e.vel.y -= 18 * dt;
      e.pos.addScaledVector(e.vel, dt);
      const below = this.world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y - 0.05), Math.floor(e.pos.z));
      if (isSolid(below)) {
        e.pos.y = Math.floor(e.pos.y - 0.05) + 1.02;
        e.vel.set(0, 0, 0);
      }
      if (isSolid(this.world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y), Math.floor(e.pos.z)))) e.pos.y += dt * 2.5;
      e.mesh.position.set(e.pos.x, e.pos.y + Math.sin(e.age * 3) * 0.05 + 0.18, e.pos.z);
      e.mesh.rotation.y += dt * 2;
      if (e.age > 300) {
        e.dead = true;
        return;
      }
      if (e.age > 0.4 && !player.dead && e.pos.distanceTo(player.pos) < 1.6) {
        const left = player.inv.add(e.item, e.count);
        if (!left) {
          e.dead = true;
          game.audio?.pop?.();
        } else {
          e.count = left;
        }
      }
      return;
    }
    if (e.type === "boat") {
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = player.boat === e ? player.yaw : e.mesh.rotation.y;
      return;
    }
    if (e.type === "car") {
      if (player.vehicle === e) {
        const k = player.keys;
        const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const r = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        const wish = new THREE.Vector3();
        if (k.KeyW) wish.add(f);
        if (k.KeyS) wish.sub(f);
        if (k.KeyA) wish.sub(r);
        if (k.KeyD) wish.add(r);
        if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(15);
        e.vel.x += (wish.x - e.vel.x) * Math.min(1, dt * 2.5);
        e.vel.z += (wish.z - e.vel.z) * Math.min(1, dt * 2.5);
        e.vel.multiplyScalar(0.985);
        if (k.Space) {
          player.vehicle = null;
          e.vel.set(0, 0, 0);
          game.ui.toast("Left the car");
        }
      } else {
        e.vel.multiplyScalar(0.9);
      }
      this.move(e, dt);
      const sy = this.world.surfaceY(Math.floor(e.pos.x), Math.floor(e.pos.z));
      e.pos.y += (sy - e.pos.y) * Math.min(1, dt * 6);
      e.mesh.position.copy(e.pos);
      if (e.vel.x || e.vel.z) e.mesh.rotation.y = Math.atan2(-e.vel.x, -e.vel.z);
      if (player.vehicle === e) {
        player.pos.copy(e.pos);
        player.pos.y += 0.95;
        player.vel.set(0, 0, 0);
        player.fallStart = player.pos.y;
      }
      return;
    }
    if (e.type === "wyvern") {
      if (player.vehicle === e) {
        const k = player.keys;
        if (k.KeyA) player.yaw += 1.8 * dt;
        if (k.KeyD) player.yaw -= 1.8 * dt;
        const dir = player.lookDir();
        const spd = k.KeyW ? (k.Space ? 16 : 9) : k.KeyS ? -5 : 0;
        e.vel.copy(dir).multiplyScalar(spd);
        this.move(e, dt);
        if (k.ShiftLeft || k.ShiftRight) {
          player.vehicle = null;
          e.vel.set(0, 0, 0);
          player.pos.y += 1.2;
          game.ui.toast("Dismounted");
        }
      } else {
        e.vel.set(0, Math.sin(e.age * 2) * 0.35, 0);
        this.move(e, dt);
      }
      e.mesh.position.copy(e.pos);
      if (player.vehicle === e) e.mesh.rotation.y = player.yaw;
      if (player.vehicle === e) {
        player.pos.copy(e.pos);
        player.pos.y += 1.35;
        player.vel.set(0, 0, 0);
        player.fallStart = player.pos.y;
      }
      return;
    }
    if (e.type === "dragon") {
      e.t += dt;
      const r = 28;
      e.pos.set(Math.cos(e.t * 0.25) * r, 62 + Math.sin(e.t * 0.4) * 4, Math.sin(e.t * 0.25) * r);
      e.mesh.position.copy(e.pos);
      e.mesh.lookAt(0, 56, 0);
      if (e.pos.distanceTo(player.pos) < 6) player.hurt(6, "dragon");
      if (e.age % 6 < dt) game.shootFire(e.pos.clone(), player.pos.clone().sub(e.pos).normalize());
      return;
    }
    if (e.type === "arrow" || e.type === "fireball" || e.type === "pearl" || e.type === "shuriken" || e.type === "dynamite") {
      e.pos.addScaledVector(e.vel, dt);
      e.vel.y -= (e.type === "fireball" ? 0 : e.type === "shuriken" ? 4 : e.type === "dynamite" ? 16 : 18) * dt;
      e.mesh.position.copy(e.pos);
      if (e.type === "dynamite") {
        e.fuse = (e.fuse ?? 1.6) - dt;
        e.mesh.scale.setScalar(1 + Math.sin(e.age * 20) * 0.15);
        if (e.fuse <= 0) {
          this.world.explode(e.pos.x, e.pos.y, e.pos.z, 2.6);
          if (e.pos.distanceTo(player.pos) < 4) player.hurt(9, "explode");
          e.dead = true;
          return;
        }
      }
      const b = this.world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y), Math.floor(e.pos.z));
      if (isSolid(b) || e.age > 6) {
        if (e.type === "fireball") this.world.explode(e.pos.x, e.pos.y, e.pos.z, 2);
        if (e.type === "pearl") {
          player.pos.copy(e.pos);
          player.hurt(5, "pearl");
        }
        e.dead = true;
        return;
      }
      if (e.pos.distanceTo(player.eyePos()) < 0.8 && e.owner !== "player") {
        player.hurt(e.type === "fireball" ? 7 : 3, e.type);
        e.dead = true;
      }
      for (const o of this.list) {
        if (o === e || o.item) continue;
        if (e.owner === "player" && o.pos.distanceTo(e.pos) < 0.9 && e.type !== "dynamite") {
          o.hp -= 6;
          e.dead = true;
        }
      }
      return;
    }

    const toP = player.pos.clone().sub(e.pos);
    const dist = toP.length();
    e.onGround = isSolid(this.world.getBlock(Math.floor(e.pos.x), Math.floor(e.pos.y - 0.1), Math.floor(e.pos.z)));
    if (!e.onGround) e.vel.y -= 22 * dt;
    else if (e.vel.y < 0) e.vel.y = 0;

    const hostile = ["zombie", "skeleton", "creeper", "spider", "enderman", "piglin", "ghast"].includes(e.type);
    const passive = ["pig", "cow"].includes(e.type);
    if (hostile && dist < 24 && !player.hidden) {
      if (e.type === "enderman" && lookingAt(player, e) && dist < 16) e.angry = true;
      if (e.type === "ghast" && dist < 40) {
        if (e.age % 3 < dt) {
          const dir = player.eyePos().sub(e.pos).normalize();
          this.spawn("fireball", e.pos.x, e.pos.y, e.pos.z, { vel: dir.multiplyScalar(12), owner: "ghast", hp: 1 });
        }
      } else if (e.type === "skeleton" && dist < 14 && dist > 4) {
        if (e.age % 2 < dt) {
          const dir = player.eyePos().sub(e.pos).normalize();
          this.spawn("arrow", e.pos.x, e.pos.y + 1.2, e.pos.z, { vel: dir.multiplyScalar(22), owner: "mob", hp: 1 });
        }
      } else if (e.type === "creeper") {
        if (dist < 3) {
          e.fuse = (e.fuse || 0) + dt;
          e.mesh.scale.setScalar(1 + e.fuse * 0.3);
          if (e.fuse > 1.5) {
            this.world.explode(e.pos.x, e.pos.y, e.pos.z, 3);
            player.hurt(12, "explode");
            e.dead = true;
          }
        } else e.fuse = 0;
        this.chase(e, player, dt, 3.2);
      } else if (e.angry !== false && (e.type !== "enderman" || e.angry)) {
        this.chase(e, player, dt, e.type === "spider" ? 5 : 3.4);
        if (dist < 1.5 && e.atkCd <= 0) {
          player.hurt(e.type === "enderman" ? 5 : 3, e.type);
          e.atkCd = 1;
        }
      }
      if (e.type === "enderman" && e.angry && Math.random() < dt * 0.4) {
        e.pos.set(player.pos.x + (Math.random() - 0.5) * 8, player.pos.y, player.pos.z + (Math.random() - 0.5) * 8);
      }
    } else if (passive) {
      if (e.wanderT <= 0) {
        e.wander = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        e.wanderT = 2 + Math.random() * 3;
      }
      e.wanderT -= dt;
      e.vel.x = e.wander.x * 1.4;
      e.vel.z = e.wander.z * 1.4;
    }

    e.atkCd = Math.max(0, (e.atkCd || 0) - dt);
    this.move(e, dt);
    e.mesh.position.copy(e.pos);
    if (e.vel.x || e.vel.z) e.mesh.rotation.y = Math.atan2(-e.vel.x, -e.vel.z);
  }

  chase(e, player, dt, spd) {
    const dir = player.pos.clone().sub(e.pos);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) return;
    dir.normalize();
    e.vel.x = dir.x * spd;
    e.vel.z = dir.z * spd;
    if (e.onGround && (this.blocked(e) || player.pos.y > e.pos.y + 0.4)) e.vel.y = 7;
  }

  blocked(e) {
    const n = e.pos.clone();
    n.x += Math.sign(e.vel.x);
    n.z += Math.sign(e.vel.z);
    return isSolid(this.world.getBlock(Math.floor(n.x), Math.floor(e.pos.y + 0.5), Math.floor(n.z)));
  }

  move(e, dt) {
    e.pos.x += e.vel.x * dt;
    if (solidBox(this.world, e)) e.pos.x -= e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    if (solidBox(this.world, e)) e.pos.z -= e.vel.z * dt;
    e.pos.y += e.vel.y * dt;
    if (solidBox(this.world, e)) {
      e.pos.y -= e.vel.y * dt;
      e.vel.y = 0;
    }
  }

  hit(e, dmg, player) {
    e.hp -= dmg;
    const away = e.pos.clone().sub(player.pos).normalize();
    e.vel.addScaledVector(away, 6);
    e.vel.y = 5;
    e.angry = true;
  }

  loot(e, player) {
    const table = {
      zombie: [[I.rotten, 1]],
      skeleton: [[I.bone, 1], [I.arrow, 2]],
      creeper: [[I.gunpowder, 2]],
      spider: [[I.string, 2]],
      pig: [[I.rawPork, 2]],
      cow: [[I.rawBeef, 2], [I.leather, 1]],
      enderman: [[I.pearl, 1]],
      ghast: [[I.gunpowder, 2], [I.pearlShard, 1]],
      piglin: [[I.gold, 1]],
      dragon: [[B.dragonEgg, 1]],
      wyvern: [[I.pearl, 2], [I.diamond, 1]],
    };
    for (const [id, n] of table[e.type] || []) {
      this.spawnDrop(e.pos.x, e.pos.y + 0.6, e.pos.z, id, n);
    }
  }

  closest(origin, max, pred) {
    let best = null;
    let bd = max;
    for (const e of this.list) {
      if (pred && !pred(e)) continue;
      const d = e.pos.distanceTo(origin);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }
}

function lookingAt(player, e) {
  const dir = player.lookDir();
  const to = e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(player.eyePos()).normalize();
  return dir.dot(to) > 0.92;
}

function solidBox(world, e) {
  const w = e.w || 0.6;
  const h = e.h || 1.8;
  const x0 = Math.floor(e.pos.x - w / 2);
  const x1 = Math.floor(e.pos.x + w / 2);
  const y0 = Math.floor(e.pos.y);
  const y1 = Math.floor(e.pos.y + h);
  const z0 = Math.floor(e.pos.z - w / 2);
  const z1 = Math.floor(e.pos.z + w / 2);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) if (isSolid(world.getBlock(x, y, z))) return true;
  return false;
}

function makeMob(type, x, y, z) {
  const col = {
    zombie: 0x3a7a3a,
    skeleton: 0xe8e0c8,
    creeper: 0x3d8c3d,
    spider: 0x2a1010,
    pig: 0xf0a0a8,
    cow: 0x6a4a32,
    enderman: 0x101018,
    piglin: 0xd09070,
    ghast: 0xf0f0f0,
    remote: 0x4a7bd0,
    dragon: 0x1a0a28,
    boat: 0x8b5a2b,
    car: 0xd23a34,
    wyvern: 0x7a3fd4,
    arrow: 0xdddddd,
    fireball: 0xff6622,
    pearl: 0x1a8a6a,
  }[type] || 0xffffff;
  let mesh;
  if (type === "item") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  } else if (type === "shuriken") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0xd8dce4 }));
  } else if (type === "dynamite") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.22), new THREE.MeshLambertMaterial({ color: 0xd63c34, emissive: 0x661111 }));
  } else if (type === "car") {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.2), m);
    body.position.y = 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 1.0), new THREE.MeshLambertMaterial({ color: 0x9ed1e8 }));
    cab.position.set(0, 1.0, -0.2);
    const wm = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.4), wm);
    w1.position.set(-0.6, 0.2, 0.7);
    const w2 = w1.clone();
    w2.position.z = -0.7;
    const w3 = w1.clone();
    w3.position.x = 0.6;
    const w4 = w1.clone();
    w4.position.set(0.6, 0.2, -0.7);
    g.add(body, cab, w1, w2, w3, w4);
    mesh = g;
  } else if (type === "wyvern") {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 2.2), m);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), m);
    head.position.z = 1.4;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.4), m);
    wing.position.y = 0.35;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), m);
    tail.position.z = -1.8;
    g.add(body, head, wing, tail);
    mesh = g;
  } else if (type === "boat") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 2.1), new THREE.MeshLambertMaterial({ color: col }));
  } else if (type === "dragon") {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), m);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 2), m);
    wing.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), m);
    head.position.z = 2.4;
    g.add(body, wing, head);
    mesh = g;
  } else if (type === "ghast") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: col }));
  } else if (type === "spider") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.4), new THREE.MeshLambertMaterial({ color: col }));
  } else if (type === "arrow" || type === "fireball" || type === "pearl") {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(type === "fireball" ? 0.35 : 0.12), new THREE.MeshLambertMaterial({ color: col, emissive: type === "fireball" ? 0xff3300 : 0x000 }));
  } else {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), m);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), m);
    head.position.y = 1.55;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), m);
    const l1 = leg.clone();
    l1.position.set(-0.14, 0.35, 0);
    const l2 = leg.clone();
    l2.position.set(0.14, 0.35, 0);
    g.add(body, head, l1, l2);
    mesh = g;
  }
  const hp = { dragon: 200, wyvern: 60, ghast: 10, enderman: 40, creeper: 20, zombie: 20, skeleton: 20, spider: 16, piglin: 16, pig: 10, cow: 10, boat: 10, car: 40 }[type] || 10;
  return {
    type,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    mesh,
    hp,
    age: 0,
    w: type === "dragon" ? 2 : type === "boat" ? 1.2 : type === "car" ? 1.3 : type === "wyvern" ? 1.4 : type === "item" || type === "shuriken" || type === "dynamite" ? 0.25 : 0.6,
    h: type === "ghast" ? 2.4 : type === "boat" ? 0.5 : type === "car" ? 1.3 : type === "wyvern" ? 1.1 : type === "item" || type === "shuriken" || type === "dynamite" ? 0.3 : 1.8,
    atkCd: 0,
    t: 0,
    target: new THREE.Vector3(x, y, z),
    targetYaw: 0,
    wanderT: 0,
    wander: new THREE.Vector3(),
  };
}

function gameTimeIsNight(player) {
  return player._night;
}
