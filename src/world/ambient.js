import * as THREE from 'three';
import { TILE } from './generateWorld.js';
import { VoxelBuilder, vmat } from '../render/voxel.js';
import { windTime } from '../render/wind.js';

// Small life that makes the world feel lived in: butterflies, birds that take off when
// you come close, fireflies and Spirit Tree motes at night, jumping fish, chimney smoke,
// the turning windmill. All of it is decoration: nothing here touches gameplay.
const BUTTERFLIES = 26;
const FLOCKS = 4, BIRDS_PER_FLOCK = 4;
const FIREFLIES = 140;
const MOTES = 40;
const SMOKE_PER_CHIMNEY = 6;
const BIRD_SCARE = 3.5;   // tiles: birds take off when the hero gets this close
const BUTTERFLY_COLORS = ['#ffcd75', '#ff8fb1', '#73eff7', '#f4f4f4', '#b48cff'];

let softTexture = null;
function softDot() {
  if (softTexture) return softTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  softTexture = new THREE.CanvasTexture(c);
  return softTexture;
}

export default class Ambient {
  // gen: generateWorld() output; built: buildWorld() output.
  constructor(game, gen, built) {
    this.game = game;
    this.built = built;
    this.dummy = new THREE.Object3D();
    const { data, region, bridges } = gen;
    const tiles = (test) => {
      const list = [];
      for (let z = 0; z < data.length; z++) for (let x = 0; x < data[0].length; x++) if (test(data[z][x], region[z][x], x, z)) list.push([x + 0.5, z + 0.5]);
      return list;
    };
    this.flowerTiles = tiles((t, r) => t === TILE.FLOWERS && r !== 'dimwood');
    this.groundTiles = tiles((t, r) => t === TILE.GRASS && (r === 'meadow' || r === 'moors' || r === 'lake'));
    this.waterTiles = tiles((t, r, x, z) => t === TILE.WATER && !bridges.has(`${x},${z}`) && x > 1 && z > 1 && z < data.length - 2);
    this.forestTiles = tiles((t, r) => t !== TILE.TREE && t !== TILE.WATER && (r === 'dimwood' || r === 'spirit' || r === 'lake'));
    this.rand = (list) => list[Math.floor(Math.random() * list.length)];

    this.makeButterflies(game.scene);
    this.makeBirds(game.scene);
    this.makeFireflies(game.scene, gen.landmarks.spiritTree);
    this.makeSmoke(game.scene);
    this.fish = { mesh: this.makeFishMesh(game.scene), active: false, next: 2 };
  }

  update(dt) {
    const t = this.game.time, night = this.game.dayNight.night;
    windTime.value = t;
    this.built.windmill.blades.rotation.z -= dt * 0.9;
    this.built.spiritTree.crystals.material.opacity = 0.55 + 0.3 * Math.sin(t * 1.4) + 0.15 * night;
    this.updateButterflies(dt, t, night);
    this.updateBirds(dt, t);
    this.updateFireflies(t, night);
    this.updateSmoke(dt, night);
    this.updateFish(dt);
  }

  // ---- Butterflies: flutter around flowers by day, hide at night ----

  makeButterflies(scene) {
    const wing = new THREE.PlaneGeometry(0.13, 0.1).translate(0.065, 0, 0).rotateX(-Math.PI / 2);
    this.wings = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), BUTTERFLIES * 2);
    this.butterflies = [];
    const color = new THREE.Color();
    for (let i = 0; i < BUTTERFLIES && this.flowerTiles.length; i++) {
      const [x, z] = this.rand(this.flowerTiles);
      this.butterflies.push({ home: new THREE.Vector2(x, z), phase: Math.random() * 10 });
      color.set(this.rand(BUTTERFLY_COLORS));
      this.wings.setColorAt(i * 2, color);
      this.wings.setColorAt(i * 2 + 1, color);
    }
    this.wings.frustumCulled = false;
    scene.add(this.wings);
  }

  updateButterflies(dt, t, night) {
    const d = this.dummy, p = this.game.player, show = night < 0.6;
    this.butterflies.forEach((b, i) => {
      const x = b.home.x + Math.sin(t * 0.4 + b.phase) * 1.2;
      const z = b.home.y + Math.cos(t * 0.33 + b.phase * 1.7) * 1.2;
      const y = 0.55 + Math.sin(t * 1.3 + b.phase) * 0.18;
      // Drift away from the hero.
      const dx = x - p.x, dz = z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 1.6) b.home.add(new THREE.Vector2(dx / dist, dz / dist).multiplyScalar(dt * 3));
      const heading = Math.atan2(Math.cos(t * 0.4 + b.phase), -Math.sin(t * 0.33 + b.phase * 1.7));
      const flap = Math.sin(t * 16 + b.phase * 3) * 1.1;
      for (const side of [0, 1]) {
        d.position.set(x, y, z);
        d.rotation.set(0, heading + (side ? Math.PI : 0), side ? -flap : flap);
        d.scale.setScalar(show ? 1 : 0);
        d.updateMatrix();
        this.wings.setMatrixAt(i * 2 + side, d.matrix);
      }
    });
    this.wings.instanceMatrix.needsUpdate = true;
  }

  // ---- Birds: peck on the ground, take off when the hero comes close, land somewhere else ----

  makeBirds(scene) {
    const body = new VoxelBuilder()
      .box(0, 0.08, 0, 0.1, 0.09, 0.16, '#5a5a6a', 0)
      .box(0, 0.14, 0.07, 0.08, 0.08, 0.08, '#6a6a7a', 0)
      .box(0, 0.13, 0.125, 0.03, 0.025, 0.04, '#ffcd75', 0)
      .box(0, 0.09, -0.11, 0.06, 0.03, 0.08, '#3d3d4a', 0)
      .build();
    const wing = new THREE.PlaneGeometry(0.16, 0.1).translate(0.08, 0, 0).rotateX(-Math.PI / 2);
    const count = FLOCKS * BIRDS_PER_FLOCK;
    this.birdBodies = new THREE.InstancedMesh(body, vmat(), count);
    this.birdWings = new THREE.InstancedMesh(wing, new THREE.MeshLambertMaterial({ color: '#4a4a5a', side: THREE.DoubleSide }), count * 2);
    this.birdBodies.castShadow = true;
    this.birdBodies.frustumCulled = this.birdWings.frustumCulled = false;
    scene.add(this.birdBodies, this.birdWings);
    this.flocks = [];
    for (let f = 0; f < FLOCKS; f++) this.flocks.push(this.landFlock({ birds: [] }));
  }

  // Puts a flock down on open ground away from the hero.
  landFlock(flock) {
    const p = this.game.player;
    let spot = this.rand(this.groundTiles);
    for (let tries = 0; tries < 20 && p && Math.hypot(spot[0] - p.x, spot[1] - p.z) < 12; tries++) spot = this.rand(this.groundTiles);
    flock.flying = false;
    flock.timer = 0;
    flock.birds = Array.from({ length: BIRDS_PER_FLOCK }, () => ({
      pos: new THREE.Vector3(spot[0] + (Math.random() - 0.5) * 1.6, 0, spot[1] + (Math.random() - 0.5) * 1.6),
      vel: new THREE.Vector3(),
      heading: Math.random() * Math.PI * 2,
      phase: Math.random() * 10,
    }));
    return flock;
  }

  updateBirds(dt, t) {
    const p = this.game.player, d = this.dummy;
    this.flocks.forEach((flock, f) => {
      if (!flock.flying && flock.birds.some((b) => Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < BIRD_SCARE)) {
        flock.flying = true;
        for (const b of flock.birds) {
          const away = Math.atan2(b.pos.x - p.x, b.pos.z - p.z) + (Math.random() - 0.5) * 0.8;
          b.vel.set(Math.sin(away) * 4, 2.2 + Math.random(), Math.cos(away) * 4);
          b.heading = away;
        }
      }
      if (flock.flying && (flock.timer += dt) > 7) this.landFlock(flock);
      flock.birds.forEach((b, i) => {
        const n = f * BIRDS_PER_FLOCK + i;
        let flap = 0;
        if (flock.flying) {
          b.vel.y = Math.max(0.3, b.vel.y - dt * 0.4);
          b.pos.addScaledVector(b.vel, dt);
          flap = Math.sin(t * 22 + b.phase) * 0.9;
        } else if (Math.sin(t * 0.7 + b.phase) > 0.6) {
          b.heading += dt * 2; // hop around
        }
        const peck = flock.flying ? 0 : Math.max(0, Math.sin(t * 6 + b.phase)) * 0.25;
        d.position.copy(b.pos);
        d.rotation.set(peck, b.heading, 0);
        d.scale.setScalar(1);
        d.updateMatrix();
        this.birdBodies.setMatrixAt(n, d.matrix);
        // Wings only show in flight; on the ground the body's own shape is enough.
        for (const side of [0, 1]) {
          d.position.set(b.pos.x, b.pos.y + 0.12, b.pos.z);
          d.rotation.set(0, b.heading + (side ? Math.PI : 0), (side ? -1 : 1) * flap);
          d.scale.setScalar(flock.flying ? 1 : 0);
          d.updateMatrix();
          this.birdWings.setMatrixAt(n * 2 + side, d.matrix);
        }
      });
    });
    this.birdBodies.instanceMatrix.needsUpdate = true;
    this.birdWings.instanceMatrix.needsUpdate = true;
  }

  // ---- Fireflies (woods, Spirit Hill and the lake shore, mostly at night) and Spirit Tree motes ----

  makeFireflies(scene, tree) {
    const count = Math.min(FIREFLIES, this.forestTiles.length);
    this.flies = Array.from({ length: count }, () => {
      const [x, z] = this.rand(this.forestTiles);
      return { x, z, phase: Math.random() * 20, speed: 0.3 + Math.random() * 0.5 };
    });
    this.flyGeo = new THREE.BufferGeometry();
    this.flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.fireflies = new THREE.Points(this.flyGeo, new THREE.PointsMaterial({
      color: '#d8ff7a', size: 0.22, map: softDot(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);

    this.motesAt = { x: tree.tx + 1, z: tree.ty + 1 };
    this.moteData = Array.from({ length: MOTES }, () => ({ a: Math.random() * Math.PI * 2, r: 0.8 + Math.random() * 3, y: Math.random() * 7, speed: 0.3 + Math.random() * 0.5 }));
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
    this.motes = new THREE.Points(this.moteGeo, new THREE.PointsMaterial({
      color: '#9fe8ff', size: 0.2, map: softDot(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.motes.frustumCulled = false;
    scene.add(this.motes);
  }

  updateFireflies(t, night) {
    const pos = this.flyGeo.attributes.position.array;
    this.flies.forEach((f, i) => {
      const s = t * f.speed + f.phase;
      pos[i * 3] = f.x + Math.sin(s) * 0.8 + Math.sin(s * 2.3) * 0.2;
      pos[i * 3 + 1] = 0.5 + Math.sin(s * 1.7) * 0.3 + 0.3;
      pos[i * 3 + 2] = f.z + Math.cos(s * 0.8) * 0.8;
    });
    this.flyGeo.attributes.position.needsUpdate = true;
    // Blink: a quick pulse on top of the night fade.
    this.fireflies.material.opacity = (0.1 + 0.9 * night) * (0.75 + 0.25 * Math.sin(t * 5));

    const mp = this.moteGeo.attributes.position.array;
    this.moteData.forEach((m, i) => {
      m.y += m.speed * 0.016;
      if (m.y > 8) m.y = 0;
      const a = m.a + t * 0.15;
      mp[i * 3] = this.motesAt.x + Math.cos(a) * m.r;
      mp[i * 3 + 1] = m.y;
      mp[i * 3 + 2] = this.motesAt.z + Math.sin(a) * m.r;
    });
    this.moteGeo.attributes.position.needsUpdate = true;
  }

  // ---- Chimney smoke ----

  makeSmoke(scene) {
    this.puffs = [];
    for (const c of this.built.chimneys) {
      for (let i = 0; i < SMOKE_PER_CHIMNEY; i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softDot(), color: c.dark ? '#6a6a72' : '#d8d8de', transparent: true, opacity: 0, depthWrite: false,
        }));
        scene.add(sprite);
        this.puffs.push({ sprite, c, age: (i / SMOKE_PER_CHIMNEY) * 3, life: 3 });
      }
    }
  }

  // Smoke isn't lit by the scene, so it is darkened by hand after sunset.
  updateSmoke(dt, night) {
    const light = 1 - 0.7 * night;
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age > p.life) p.age -= p.life;
      const k = p.age / p.life;
      p.sprite.position.set(p.c.x + k * 1.1 + Math.sin(k * 5 + p.c.x) * 0.12, p.c.y + k * 1.4, p.c.z - k * 0.3);
      p.sprite.scale.setScalar(0.35 + k * 1.1);
      p.sprite.material.opacity = Math.sin(k * Math.PI) * 0.4;
      p.sprite.material.color.set(p.c.dark ? '#6a6a72' : '#d8d8de').multiplyScalar(light);
    }
  }

  // ---- A fish jumps out of nearby water now and then ----

  makeFishMesh(scene) {
    const mesh = new THREE.Mesh(new VoxelBuilder()
      .box(0, 0, 0, 0.08, 0.1, 0.24, '#c9ccd4', 0)
      .box(0, 0.03, 0.02, 0.06, 0.03, 0.16, '#73c4f0', 0)
      .box(0, 0, -0.15, 0.03, 0.1, 0.06, '#94b0c2', 0)
      .box(0.041, 0.02, 0.08, 0.01, 0.025, 0.025, '#1a1c2c', 0)
      .build(), vmat());
    mesh.visible = false;
    scene.add(mesh);
    this.splashGeo = new THREE.RingGeometry(0.1, 0.18, 16).rotateX(-Math.PI / 2);
    return mesh;
  }

  splash(x, z) {
    const ring = new THREE.Mesh(this.splashGeo, new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.9, depthWrite: false }));
    ring.position.set(x, -0.11, z);
    this.game.addEffect(ring, 0.7, { grow: 4 });
  }

  updateFish(dt) {
    const fish = this.fish, p = this.game.player;
    if (!fish.active) {
      if ((fish.next -= dt) > 0 || !this.waterTiles.length) return;
      const near = this.waterTiles.filter(([x, z]) => Math.hypot(x - p.x, z - p.z) < 14);
      if (!near.length) {
        fish.next = 2;
        return;
      }
      const [x, z] = this.rand(near), a = Math.random() * Math.PI * 2;
      Object.assign(fish, { active: true, t: 0, x, z, dx: Math.sin(a), dz: Math.cos(a) });
      fish.mesh.visible = true;
      this.splash(x, z);
    }
    fish.t += dt / 0.8;
    const k = Math.min(1, fish.t), m = fish.mesh;
    m.position.set(fish.x + fish.dx * k * 0.9, -0.15 + Math.sin(Math.PI * k) * 0.75, fish.z + fish.dz * k * 0.9);
    m.rotation.set(-Math.cos(Math.PI * k) * 1.1, Math.atan2(fish.dx, fish.dz), 0);
    if (k >= 1) {
      fish.active = false;
      fish.next = 2 + Math.random() * 4;
      m.visible = false;
      this.splash(m.position.x, m.position.z);
    }
  }
}
