import Phaser from 'phaser';
import { FEATURES } from '../config/features.js';
import { resetStats, addXp } from '../config/stats.js';
import { ENEMIES } from '../data/enemies.js';
import { generateWorld, SOLID_TILES } from '../world/generateWorld.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import { floatText } from '../ui/floatText.js';

const MAX_ENEMIES = 14;
const WORLD_SEED = 1337;

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    resetStats(this.registry);

    const { data, spawn } = generateWorld(WORLD_SEED);
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

    this.enemies = this.add.group();
    this.coins = this.add.group();
    this.physics.add.collider(this.enemies, this.layer);
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

    this.input.keyboard.on('keydown-R', () => {
      if (this.registry.get('dead')) this.scene.restart();
    });

    this.scene.launch('UI');
  }

  update(time) {
    this.player.update(time);
    for (const enemy of this.enemies.getChildren().slice()) enemy.update(time, this.player);
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
