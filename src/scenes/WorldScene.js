import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';
import { resetStats, addXp } from '../config/stats.js';
import { ENEMIES } from '../data/enemies.js';
import { NPCS } from '../data/npcs.js';
import { generateWorld, SOLID_TILES } from '../world/generateWorld.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Npc from '../entities/Npc.js';
import Controls from '../systems/controls.js';
import { floatText } from '../ui/floatText.js';

const MAX_ENEMIES = 14;
const WORLD_SEED = 1337;
const TALK_RANGE = 26;

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    resetStats(this.registry);
    this.locked = false;
    this.inputCooldown = 0;
    this.controls = new Controls(this);

    const { data, spawn, village } = generateWorld(WORLD_SEED, { village: FEATURES.village });
    this.village = village;
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const tiles = map.addTilesetImage('tiles');
    this.layer = map.createLayer(0, tiles, 0, 0);
    this.layer.setCollision(SOLID_TILES);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.layer);
    this.cameras.main
      .setBounds(0, 0, map.widthInPixels, map.heightInPixels)
      .startFollow(this.player, true, 0.15, 0.15)
      .setRoundPixels(true);

    this.solids = this.physics.add.staticGroup();
    this.npcs = this.add.group();
    if (village) this.buildVillage(village);

    this.enemies = this.add.group();
    this.coins = this.add.group();
    for (const blocker of [this.layer, this.solids, this.npcs]) {
      if (blocker !== this.layer) this.physics.add.collider(this.player, blocker);
      this.physics.add.collider(this.enemies, blocker);
    }
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      if (!enemy.dying) player.hurt(enemy.def.damage, enemy);
    });
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => this.collectCoin(coin));

    if (FEATURES.enemies) {
      for (let i = 0; i < MAX_ENEMIES; i++) this.spawnEnemy();
      this.time.addEvent({ delay: 4000, loop: true, callback: () => this.spawnEnemy() });
    }
    this.events.on('enemy-killed', (enemy) => this.onEnemyKilled(enemy));

    this.prompt = this.add.text(0, 0, 'E', {
      fontFamily: 'monospace', fontSize: '9px', color: '#1a1c2c', backgroundColor: '#f4f4f4',
      padding: { x: 2, y: 0 }, resolution: 4,
    }).setOrigin(0.5).setDepth(100000).setVisible(false);
    this.wasInVillage = false;

    this.scene.launch('UI');
  }

  update(time, delta) {
    this.controls.update();
    // The UI scene updates before this one, so the press that closes a menu
    // would otherwise reach the world in the same frame.
    this.inputCooldown = Math.max(0, this.inputCooldown - delta);
    const just = this.inputCooldown > 0 ? {} : this.controls.just;

    if (this.registry.get('dead')) {
      if (just.restart) this.scene.restart();
      return;
    }

    const npc = this.locked || !FEATURES.dialogue ? null : this.nearestNpc();
    this.player.update(time, {
      move: this.controls.move(),
      attack: just.attack || (just.padA && !npc),
    });
    for (const enemy of this.enemies.getChildren().slice()) enemy.update(time, this.player);

    this.prompt.setVisible(!!npc);
    if (npc) {
      this.prompt.setPosition(npc.x, npc.y - 15);
      if (just.interact || just.padA) this.talkTo(npc);
    }

    if (this.village) {
      const inside = this.inVillage(this.player.x, this.player.y);
      if (inside && !this.wasInVillage) this.scene.get('UI').showBanner(this.village.name);
      this.wasInVillage = inside;
    }
  }

  buildVillage(v) {
    for (const h of v.houses) {
      const house = this.solids.create(h.tx * 16 + 16, h.ty * 16 + 16, `house_${h.roof}`);
      house.body.setSize(26, 16, false).setOffset(3, 16);
      house.setDepth(house.y + 8);
    }
    const stall = this.solids.create(v.stall.x, v.stall.y, 'stall');
    stall.body.setSize(32, 8, false).setOffset(0, 12);
    stall.setDepth(stall.y + 6);

    for (const def of NPCS) {
      const spot = v.spots[def.spot];
      if (spot) this.npcs.add(new Npc(this, spot.tx * 16 + 8, spot.ty * 16 + 8, def));
    }
  }

  inVillage(x, y, margin = 0) {
    if (!this.village) return false;
    const r = this.village.rect;
    return x >= r.x * 16 - margin && x < (r.x + r.w) * 16 + margin && y >= r.y * 16 - margin && y < (r.y + r.h) * 16 + margin;
  }

  villageCenter() {
    const r = this.village.rect;
    return { x: (r.x + r.w / 2) * 16, y: (r.y + r.h / 2) * 16 };
  }

  nearestNpc() {
    let best = null, bestDist = TALK_RANGE;
    for (const npc of this.npcs.getChildren()) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (d < bestDist) {
        best = npc;
        bestDist = d;
      }
    }
    return best;
  }

  // Freezes the world while a dialogue or menu is open.
  lock() {
    this.locked = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.player.setTexture('hero_0');
    this.prompt.setVisible(false);
    this.physics.pause();
  }

  unlock() {
    this.locked = false;
    this.inputCooldown = 150;
    this.physics.resume();
  }

  talkTo(npc) {
    npc.face(this.player);
    this.lock();
    const ui = this.scene.get('UI');
    ui.openDialogue(npc.def.name, npc.def.lines, () => {
      if (npc.def.shop && FEATURES.shop) ui.openShop(npc.def.shop, () => this.unlock());
      else this.unlock();
    });
  }

  spawnEnemy() {
    if (this.enemies.countActive() >= MAX_ENEMIES) return;
    const level = this.registry.get('level');
    const types = Object.values(ENEMIES).filter((d) => level >= d.minLevel);
    const def = Phaser.Utils.Array.GetRandom(types);

    for (let tries = 0; tries < 30; tries++) {
      const tx = Phaser.Math.Between(2, this.layer.layer.width - 3);
      const ty = Phaser.Math.Between(2, this.layer.layer.height - 3);
      if (SOLID_TILES.includes(this.layer.getTileAt(tx, ty).index)) continue;
      const x = tx * 16 + 8, y = ty * 16 + 8;
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 140) continue;
      if (this.inVillage(x, y, 32)) continue;
      this.enemies.add(new Enemy(this, x, y, def));
      return;
    }
  }

  onEnemyKilled(enemy) {
    if (FEATURES.coins && Math.random() < 0.7) this.dropCoin(enemy.x, enemy.y);
    if (FEATURES.leveling) {
      const gained = addXp(this.registry, enemy.def.xp);
      if (gained) {
        floatText(this, this.player.x, this.player.y - 16, `LEVEL ${this.registry.get('level')}!`, '#ffcd75');
        this.cameras.main.flash(150, 255, 230, 160);
      }
    }
  }

  dropCoin(x, y) {
    const coin = this.physics.add.image(x, y, 'coin').setDepth(y - 1);
    coin.body.setSize(8, 8);
    this.coins.add(coin);
    this.tweens.add({ targets: coin, y: y - 3, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  collectCoin(coin) {
    this.registry.set('coins', this.registry.get('coins') + 1);
    floatText(this, coin.x, coin.y - 6, '+1', '#ffcd75');
    coin.destroy();
  }
}
