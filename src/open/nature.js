// A Conqueror's nature bends the skills everyone shares, and gives each one a discipline only it
// can earn. Twists open when the shared skill reaches `at`; read them with nature.has(id).
// Disciplines are skills like any other, trained by the deed in `taught`, never by being picked.
// `boughs` renames a shared skill on this Conqueror's tree: [name, ...a title for each level].
import { height } from './terrain.js';

const RANKS = [10, 30, 70, 150, 320];
const TRAIL_EVERY = 0.22, TRAIL_REACH = 3, TRAIL_FORCE = 0.25;
const RAM_EVERY = 0.4, RAM_FORCE = 0.6, RAM_REACH = 3;
const QUAKE_REACH = 7, QUAKE_FORCE = 1.2;
const LANDING_FROM = 2;       // a fall of this many tiles counts as a landing
const RIME_REACH = 8, FLARE_REACH = 5;
const GALE_RISE = 0.85, BLINK = 11, BLINK_RISE = 0.55;
const SKATE = 1.3;
const LAND_FORCE = 0.6;      // the second five's landing twists

export const NATURES = {
  titan: {
    boughs: {
      running: ['Stampede', 'Heavy Step', 'Trampler', 'Stampede', 'Siege Run', 'Unstoppable'],
      jumping: ['Quakeleaping', 'Stomper', 'Quakefall', 'Groundbreaker', 'Falling Mountain', 'Meteor Born'],
      swimming: ['Bedrock Wading', 'Sinker', 'Riverbed Walker', 'Deep Strider', 'Drowned Giant', 'Sea Floor King'],
      climbing: ['Cliff Breaking', 'Gripper', 'Stonefist', 'Wall Tearer', 'Cliffbreaker', 'Mountain Mover'],
    },
    discipline: { id: 'titan.demolition', name: 'Demolition', icon: 'crack', taught: 'Bring down enemy works', per: 0.12, text: 'Your blows do more to anything built.' },
    twists: [
      { id: 'trample', skill: 'running', at: 2, name: 'Trample', text: 'Sprinting through enemies batters them aside, and shakes what stands nearby.' },
      { id: 'quakefall', skill: 'jumping', at: 2, name: 'Quakefall', text: 'Every landing throws a shockwave, whatever you weigh.' },
      { id: 'bedrock', skill: 'swimming', at: 2, name: 'Bedrock Lungs', text: 'You sink and walk it off: breath lasts three times as long.', breath: 1 / 3 },
      { id: 'handholds', skill: 'climbing', at: 2, name: 'Handholds', text: 'You punch your own grips into the slope. Far steeper ground is walkable.', climb: 1.2 },
    ],
  },
  storm: {
    boughs: {
      running: ['Stormrunning', 'Static', 'Charged Stride', 'Thunderfoot', 'Squall', 'Living Front'],
      jumping: ['Windleaping', 'Gust', 'Gale Leap', 'Stormhopper', 'Stormrider', 'Eye of the Sky'],
      swimming: ['Eelcraft', 'Ripple', 'Eel Stroke', 'Current', 'Riptide', 'Tempest Tide'],
      climbing: ['Windclimbing', 'Breeze', 'Updraft', 'Cliff Wind', 'Summit Gale', 'Skyward'],
    },
    discipline: { id: 'storm.conductance', name: 'Conductance', icon: 'bolt', taught: 'Shock your enemies', per: 0.08, chains: true, text: 'Stunned enemies take more, and bolts leap further.' },
    twists: [
      { id: 'stride', skill: 'running', at: 2, name: 'Charged Stride', text: 'Your sprint leaves crackling ground behind you.', trail: 'storm' },
      { id: 'gale', skill: 'jumping', at: 2, name: 'Gale Leap', text: 'Jump again in midair, off the wind itself.' },
      { id: 'eel', skill: 'swimming', at: 2, name: 'Eel Stroke', text: 'You swim half again as fast.', swim: 1.5 },
      { id: 'updraft', skill: 'climbing', at: 2, name: 'Updraft', text: 'The wind lifts you up slopes that stop others.', climb: 0.8 },
    ],
  },
  void: {
    boughs: {
      running: ['Shadewalking', 'Dim Step', 'Shade Step', 'Rotwalker', 'Hollow Stride', 'Unseen'],
      jumping: ['Blinking', 'Flicker', 'Blink', 'Slip', 'Rift Hopper', 'Nowhere'],
      swimming: ['Drowning', 'Still Lungs', 'Nothing to Breathe', 'Deep Shade', 'Abyss Walker', 'Drowned God'],
      climbing: ['Phasing', 'Cold Grip', 'Phase Grip', 'Stone Ghost', 'Wallwalker', 'Through All'],
      superspeed: ['Shade Run', 'Quick Shade', 'Shade Glide', 'Shade on Water', 'Shade Storm', 'Gone Before Seen'],
    },
    discipline: { id: 'void.harvest', name: 'Harvest', icon: 'skull', taught: 'Take lives', per: 0.015, text: 'Every kill gives some of its life to you.' },
    twists: [
      { id: 'shade', skill: 'running', at: 2, name: 'Shade Step', text: 'Your sprint leaves rot in the ground behind you.', trail: 'void' },
      { id: 'blink', skill: 'jumping', at: 2, name: 'Blink', text: 'Jump again in midair to vanish and reappear ahead.' },
      { id: 'drowned', skill: 'swimming', at: 2, name: 'Nothing to Breathe', text: 'You no longer need air.', breath: 0 },
      { id: 'phase', skill: 'climbing', at: 2, name: 'Phase Grip', text: 'Your hands pass into the rock. Almost nothing is too steep.', climb: 2 },
    ],
  },
  ember: {
    boughs: {
      running: ['Wildfire Run', 'Smoulder', 'Cinder Trail', 'Firebrand', 'Grassfire', 'Wildfire'],
      jumping: ['Flaring', 'Spark', 'Flare Leap', 'Updraught', 'Fire Fountain', 'Eruption'],
      swimming: ['Boiling', 'Warm Blood', 'Boiling Blood', 'Steamer', 'Scald', 'Sea of Steam'],
      woodcutting: ['Kindling', 'Tinder', 'Kindler', 'Firefeller', 'Burner of Groves', 'Ash Maker'],
    },
    discipline: { id: 'ember.pyromancy', name: 'Pyromancy', icon: 'flame', taught: 'Set enemies ablaze', per: 0.12, text: 'Everything you burn, burns harder: enemies, ground and works.' },
    twists: [
      { id: 'cinder', skill: 'running', at: 2, name: 'Cinder Trail', text: 'Your sprint sets the ground alight behind you.', trail: 'fire' },
      { id: 'flare', skill: 'jumping', at: 2, name: 'Flare Leap', text: 'Fire bursts from under you as you jump.' },
      { id: 'boiling', skill: 'swimming', at: 2, name: 'Boiling Blood', text: 'Heat carries you: breath lasts twice as long.', breath: 0.5 },
      { id: 'kindle', skill: 'woodcutting', at: 2, name: 'Kindling', text: 'Trees you fell go up in flames where they land.' },
    ],
  },
  frost: {
    boughs: {
      swimming: ['Rimewalking', 'Cold Water', 'Rimewalk', 'Icebreaker', 'Floe Walker', 'Frozen Sea'],
      running: ['Skating', 'Slipfoot', 'Skater', 'Black Ice', 'Glacier Run', 'Whiteout'],
      jumping: ['Rimefalling', 'Hoar', 'Rimefall', 'Hailstone', 'Avalanche', 'Winter Falling'],
      climbing: ['Ice Stairs', 'Frostgrip', 'Ice Steps', 'Stairmaker', 'Icefall Climber', 'Glacier Crown'],
    },
    discipline: { id: 'frost.stillness', name: 'Stillness', icon: 'crystal', taught: 'Freeze your enemies', per: 0.1, text: 'Frozen and stunned enemies take more from everything you do.' },
    twists: [
      { id: 'rimewalk', skill: 'swimming', at: 2, name: 'Rimewalk', text: 'Water freezes under your feet. You walk across lakes.' },
      { id: 'skate', skill: 'running', at: 2, name: 'Skater', text: 'You sprint faster on frost, and your sprint spreads it.', trail: 'ice' },
      { id: 'rimefall', skill: 'jumping', at: 2, name: 'Rimefall', text: 'Landing freezes the ground around you.' },
      { id: 'icesteps', skill: 'climbing', at: 2, name: 'Ice Steps', text: 'You freeze your own stairs into a slope.', climb: 1 },
    ],
  },
  // The second five (v0.54.0). `land`: an element every landing throws out around you.
  time: {
    boughs: {
      running: ['Fading', 'Blur', 'Afterimage', 'Fading Step', 'Lost Hour', 'Timeless'],
      jumping: ['Hanging', 'Pause', 'Held Breath', 'Hang Time', 'Stopped Sky', 'Eternity'],
      swimming: ['Still Water', 'Calm', 'Stillwater', 'Deep Hour', 'Tideless', 'Ageless Sea'],
      climbing: ['Worn Steps', 'Foothold', 'Worn Stone', 'Stairs of Years', 'Old Mountain', 'Dust of Ages'],
    },
    discipline: { id: 'time.chronomancy', name: 'Chronomancy', icon: 'drop', taught: 'Stop, slow or turn back time in a fight', per: 0.1, text: 'Dilated and frozen foes take more from everything you do.' },
    twists: [
      { id: 'agestep', skill: 'running', at: 2, name: 'Fading Step', text: 'Your sprint ages the ground behind you to dust.', trail: 'time' },
      { id: 'hangtime', skill: 'jumping', at: 2, name: 'Hang Time', text: 'Every landing Dilates everything around you.', land: 'time' },
      { id: 'stillbreath', skill: 'swimming', at: 2, name: 'Still Breath', text: 'Time stops in your lungs: breath lasts three times as long.', breath: 1 / 3 },
      { id: 'yearsteps', skill: 'climbing', at: 2, name: 'Stairs of Years', text: 'Slopes wear into steps under you. Steeper ground is walkable.', climb: 1 },
    ],
  },
  tide: {
    boughs: {
      running: ['Surging', 'Rush', 'Surge', 'Riptide', 'Spring Tide', 'Torrent'],
      jumping: ['Spouting', 'Spray', 'Spout', 'Waterspout', 'Breaching', 'Leviathan'],
      swimming: ['Deepswimming', 'Gills', 'Undertow', 'Deep Diver', 'Abyss Born', 'Sea King'],
      climbing: ['Cascading', 'Trickle', 'Cascade', 'Falls Climber', 'Upriver', 'Mountain Spring'],
    },
    discipline: { id: 'tide.tidecraft', name: 'Tidecraft', icon: 'drop', taught: 'Soak your enemies', per: 0.1, text: 'Soaked foes take more from everything you do.' },
    twists: [
      { id: 'wake', skill: 'running', at: 2, name: 'Wake', text: 'Your sprint leaves the ground Soaked behind you.', trail: 'water' },
      { id: 'splash', skill: 'jumping', at: 2, name: 'Breach', text: 'Every landing bursts a wave out around you.', land: 'water' },
      { id: 'gills', skill: 'swimming', at: 2, name: 'Gills', text: 'You breathe water, nearly: breath lasts four times as long.', breath: 1 / 4 },
      { id: 'cascade', skill: 'climbing', at: 2, name: 'Cascade', text: 'Water carries you up slopes. Steeper ground is walkable.', climb: 1 },
    ],
  },
  blight: {
    boughs: {
      running: ['Creeping', 'Shamble', 'Creep', 'Rotstep', 'Plague Walk', 'Black Death'],
      jumping: ['Bursting', 'Pop', 'Sporefall', 'Burst Pod', 'Spore Rain', 'Bloom Fall'],
      swimming: ['Bog Wading', 'Murk', 'Bogwalker', 'Fen Haunt', 'Drowned Rot', 'Mire Queen'],
      climbing: ['Vining', 'Tendril', 'Vine', 'Creeper', 'Overgrowth', 'Strangler'],
    },
    discipline: { id: 'blight.pestilence', name: 'Pestilence', icon: 'drop', taught: 'Infect your enemies', per: 0.12, text: 'Infected foes take more from everything you do.' },
    twists: [
      { id: 'rotstep', skill: 'running', at: 2, name: 'Rotstep', text: 'Your sprint leaves a trail of rot that sickens what walks it.', trail: 'blight' },
      { id: 'sporefall', skill: 'jumping', at: 2, name: 'Sporefall', text: 'Every landing throws spores out around you.', land: 'blight' },
      { id: 'bog', skill: 'swimming', at: 2, name: 'Bog Lungs', text: 'Breath lasts twice as long.', breath: 1 / 2 },
      { id: 'vine', skill: 'climbing', at: 2, name: 'Creeper', text: 'Vines pull you up. Steeper ground is walkable.', climb: 1 },
    ],
  },
  mind: {
    boughs: {
      running: ['Gliding', 'Drift', 'Glide', 'Levitate', 'Hover', 'Ascendant'],
      jumping: ['Lifting', 'Lift', 'Thrust', 'Psychic Leap', 'Skywalk', 'Weightless'],
      swimming: ['Parting', 'Calm', 'Parting', 'Still Sea', 'Dry Path', 'Sea Parted'],
      climbing: ['Rising', 'Rise', 'Ascend', 'Mind Over Stone', 'Unbound', 'Above All'],
    },
    discipline: { id: 'mind.dominion', name: 'Dominion', icon: 'drop', taught: 'Turn, break or terrify your enemies', per: 0.1, text: 'Turned, kneeling and Dazed foes take more from everything you do.' },
    twists: [
      { id: 'glide', skill: 'running', at: 2, name: 'Levitate', text: 'You float over rough ground. Steeper slopes are walkable.', climb: 1.2 },
      { id: 'thrust', skill: 'jumping', at: 2, name: 'Thrust', text: 'Every landing throws everything around you away with your mind.', land: 'mind' },
      { id: 'calm', skill: 'swimming', at: 2, name: 'Calm Mind', text: 'Breath lasts twice as long.', breath: 1 / 2 },
      { id: 'unbound', skill: 'climbing', at: 2, name: 'Unbound', text: 'You lift yourself up. Steeper ground is walkable.', climb: 1 },
    ],
  },
  night: {
    boughs: {
      running: ['Shadowrunning', 'Hush', 'Silent', 'Shadowrun', 'Nightwind', 'Unseen'],
      jumping: ['Dropping', 'Drop', 'Pounce', 'Night Drop', 'Moonfall', 'Black Star'],
      swimming: ['Dark Water', 'Murk', 'Blackwater', 'Deepdark', 'Sunless Sea', 'Abyss'],
      climbing: ['Clinging', 'Cling', 'Shadowclimb', 'Wallwalker', 'Spider', 'Night Spire'],
    },
    discipline: { id: 'night.shadowcraft', name: 'Shadowcraft', icon: 'drop', taught: 'Strike from the dark', per: 0.12, text: 'Ambushes and marked foes take more from everything you do.' },
    twists: [
      { id: 'silent', skill: 'running', at: 2, name: 'Silent', text: 'Your sprint makes no sound: in the dark, foes must be closer still to find you.' },
      { id: 'pounce', skill: 'jumping', at: 2, name: 'Pounce', text: 'Every landing throws a burst of shadow around you.', land: 'night' },
      { id: 'deepdark', skill: 'swimming', at: 2, name: 'Deepdark', text: 'Breath lasts twice as long.', breath: 1 / 2 },
      { id: 'cling', skill: 'climbing', at: 2, name: 'Cling', text: 'You climb like a spider. Far steeper ground is walkable.', climb: 1.2 },
    ],
  },
};

export const DISCIPLINE_SKILLS = Object.fromEntries(Object.values(NATURES).map(({ discipline: d }) => [d.id, {
  name: d.name, color: '#f3ead8', discipline: true, trains: { strength: 0.02, endurance: 0.02 },
  levels: RANKS.map((at, i) => ({ at, title: `${d.name} ${i + 1}`, icon: d.icon })),
}]));

export default class Nature {
  constructor(player) {
    Object.assign(this, { player, trailIn: 0, ramIn: 0, jumped: false });
  }

  get own() {
    return NATURES[this.player.powers.id] ?? null;
  }

  has(id) {
    const twist = this.own?.twists.find((t) => t.id === id);
    return !!twist && this.player.skills.level(twist.skill) >= twist.at;
  }

  // The twists this hero has, by what they change.
  sum(key, none = null) {
    const found = this.own?.twists.find((t) => t[key] !== undefined && this.has(t.id));
    return found ? found[key] : none;
  }

  // A skill as this Conqueror knows it, with its own name and titles.
  named(skill) {
    const [name, ...titles] = this.own?.boughs[skill.id] ?? [];
    return name ? { ...skill, name, levels: skill.levels.map((l, i) => ({ ...l, title: titles[i] })) } : skill;
  }

  // The twist that opens on this node of the tree, if there is one.
  twistAt(id, node) {
    return this.own?.twists.find((t) => t.skill === id && t.at === node + 1);
  }

  get climb() { return this.sum('climb', 0); }
  get breath() { return this.sum('breath', 1); }
  get swim() { return this.sum('swim', 1); }

  // How far along the discipline is: 0 until earned, then one step a level.
  get depth() {
    const d = this.own?.discipline;
    return d ? this.player.skills.level(d.id) * d.per : 0;
  }

  // The one deed that trains this hero's discipline. Anyone else's does nothing.
  deed(kind, amount = 1) {
    const d = this.own?.discipline;
    if (d?.id === `${this.player.powers.id}.${kind}`) this.player.skills.add(d.id, amount);
  }

  // Blows on works, and bites of fire: 1 unless this hero's nature says more.
  get demolition() { return this.isA('demolition') ? 1 + this.depth : 1; }
  get pyromancy() { return this.isA('pyromancy') ? 1 + this.depth : 1; }
  get chains() { return this.isA('conductance') ? Math.floor(this.player.skills.level('storm.conductance') / 2) : 0; }

  isA(kind) {
    return this.own?.discipline.id === `${this.player.powers.id}.${kind}`;
  }

  // Extra force on this enemy.
  edge(e) {
    if ((this.isA('conductance') || this.isA('stillness')) && e.mode === 'reeling') return 1 + this.depth;
    // The second five: their own afflictions (set by kits/*.js) are what the discipline feeds on.
    const t = this.player.melee.monsters.time;
    if (this.isA('chronomancy') && (e.dilatedUntil > t || e.frozenUntil > t)) return 1 + this.depth;
    if (this.isA('tidecraft') && e.soakedUntil > t) return 1 + this.depth;
    if (this.isA('pestilence') && e.infect > 0) return 1 + this.depth;
    if (this.isA('dominion') && (e.lured?.foe || e.kneelUntil > t || e.dazedUntil > t)) return 1 + this.depth;
    if (this.isA('shadowcraft') && e.markedUntil > t) return 1 + this.depth;
    return 1;
  }

  killed() {
    this.deed('harvest');
    if (this.isA('harvest') && this.depth) this.player.powers.heal(this.player.body.maxHealth * this.depth);
  }

  // Pace on the ground under the hero.
  stride() {
    const { state, world } = this.player;
    return this.has('skate') && state.sprinting && (world.scars.at(state.x, state.z)?.frost ?? 0) > 0.2 ? SKATE : 1;
  }

  // A second jump, for those who have one. True if it was used.
  airJump() {
    const { state, body, world } = this.player;
    if (this.jumped || state.flying) return false;
    const gale = this.has('gale'), blink = this.has('blink');
    if (!gale && !blink) return false;
    this.jumped = true;
    const { fx } = world;
    if (gale) {
      state.rise = body.jumpSpeed * GALE_RISE;
      fx.impact('storm', state.x, state.y + state.air, state.z, 2);
    } else {
      const d = Math.hypot(...state.dir) || 1;
      fx.impact('void', state.x, state.y + state.air, state.z, 2);
      state.x += (state.dir[0] / d) * BLINK;
      state.z += (state.dir[1] / d) * BLINK;
      state.rise = body.jumpSpeed * BLINK_RISE;
      fx.impact('void', state.x, state.y + state.air, state.z, 2);
    }
    return true;
  }

  jumpedOff() {
    const { state, world } = this.player;
    if (this.has('flare')) {
      world.scars.mark('fire', state.x, state.z, FLARE_REACH, this.player, 1);
      world.fx.impact('fire', state.x, state.y, state.z, 2);
    }
  }

  landed(fell) {
    this.jumped = false;
    const { state, world, melee, body } = this.player;
    if (fell < LANDING_FROM) return;
    if (this.has('quakefall')) {
      world.work.actor = this.player;
      melee.blast(state.x, state.z, body.might * QUAKE_FORCE, QUAKE_REACH, 0, '#ff8a4c', null);
    }
    if (this.has('rimefall')) {
      world.scars.mark('ice', state.x, state.z, RIME_REACH, this.player, 1);
      world.fx.impact('ice', state.x, state.y, state.z, RIME_REACH * 0.6);
    }
    const land = this.sum('land');
    if (land) {
      world.scars.mark(land, state.x, state.z, RIME_REACH, this.player, 1);
      world.fx.impact(land, state.x, state.y, state.z, RIME_REACH * 0.6);
      world.work.actor = this.player;
      const hit = melee.blast(state.x, state.z, body.might * LAND_FORCE, RIME_REACH * 0.8, 0, this.player.powers.def?.color ?? '#ffffff', null);
      this.player.powers.kitDef?.landedNear?.(this.player.powers, state.x, state.z, RIME_REACH, hit);
    }
  }

  // One frame of what the hero's nature does to the ground under them.
  update(dt) {
    const { state, world, swim, rooms, melee, body } = this.player;
    if (rooms.house || !this.own) return;
    if (this.has('rimewalk') && !state.air && state.moving) {
      const d = Math.hypot(...state.dir) || 1, ax = state.x + (state.dir[0] / d) * 2, az = state.z + (state.dir[1] / d) * 2;
      if (height(ax, az) < 0) world.scars.mark('ice', ax, az, 4, this.player, 0);
    }
    const running = state.moving && state.sprinting && !state.air && !swim.inWater;
    if (!running) return;
    const trail = this.sum('trail');
    if (trail && (this.trailIn -= dt) <= 0) {
      this.trailIn = TRAIL_EVERY;
      world.scars.mark(trail, state.x, state.z, TRAIL_REACH, this.player, 1, TRAIL_FORCE);
    }
    if (this.has('trample') && (this.ramIn -= dt) <= 0) {
      this.ramIn = RAM_EVERY;
      world.work.actor = this.player;
      melee.blast(state.x, state.z, body.might * RAM_FORCE, RAM_REACH, 0, '#ff8a4c', null);
    }
  }
}
