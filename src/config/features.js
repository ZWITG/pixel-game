// Feature switches. Turn a feature off here to remove it from the game
// without deleting its code. New features get a switch when they are added.
export const FEATURES = {
  enemies: true,        // slimes spawn and roam
  combat: true,         // sword attack (Space / J / Square or R1)
  spinSlash: true,      // heavier attack that hits all around (F / R2 or Triangle)
  lockOn: true,         // lock onto an enemy (Q / Tab / L2 or R3), switch with Z X / right-stick flick
  swimming: true,
  jump: true,            // open world: jump, height grows with Strength and Speed
  punching: true,        // open world: Square punches, stages grow with practice and Strength
  monsters: true,        // open world: monsters and hero health
  coop: true,            // open world: a second player joins on a second controller
  crafting: true,        // open world: the Satchel, gear, potions and recipes
  friendlyFire: true,    // open world: heroes' blows hurt each other
  evolution: true,       // open world: monsters change form as the heroes level
  sites: true,           // open world: places with their own goals and rewards
  dayCycle: true,        // open world: the sky turns from night through day to dusk, 16 minutes a day
  compass: true,         // open world: compass strip with the next goal and nearby towns, names when you arrive
  flight: true,          // open world: maxing Jumping opens Flight, hold X in the air
  superspeed: true,      // open world: maxing Running opens Superspeed, press sprint again
  blow: true,            // open world: maxing Punching opens Destructive Blow, hold and release Square
  worldWork: true,       // open world: solid trees and rocks, chopping, mining, house interiors       // open world: learn to swim by trying; shows on the Skills page
  dodgeRoll: true,      // roll with brief invincibility (Shift / K / Circle)
  topDownCamera: false, // angled top-down view you can switch to (C / Create); off = behind-the-hero camera only
  leveling: true,       // XP, levels, stat growth
  coins: true,          // enemies drop coins
  monsterDrops: true,   // enemies drop materials (gel, ember cores, pearls) to sell to Mina
  lootDrop: true,       // falling drops your coins and drops in a satchel; walk back to get them
  damageNumbers: true,  // floating numbers on hits
  village: true,        // Lumen Hollow: houses, villagers, safe zone
  dialogue: true,       // talk to villagers (E / Cross)
  shop: true,           // Mina's shop: spend coins on gear
  gamepad: true,        // controller support (PS5 layout; any standard pad works)
  retroPixels: false,   // chunky low-res pixel look instead of HD rendering
  grassBlades: true,    // thousands of small grass blades (turn off on slow machines)
  dayNight: true,       // day/night cycle (8 minutes a day): sunsets, stars, lit windows, fireflies
  ambientLife: true,    // butterflies, birds, fish, fireflies, chimney smoke, windmill, wind in grass and trees
  digs: true,           // open world: heavy blows and punches into hillsides dig the ground as voxels (digs.js); needs voxels
  atmosphere: true,     // open world: smoke and dust clouds, fire through timber, fire light, glass shards (smoke.js)
  voxelWorld: true,     // open world: the land, trees, rocks and grass are cubes (half a tile); off = the smooth land
  voxels: true,         // open world: raze works and kingdom buildings are breakable voxels (voxels.js); off = the painted models fall whole
  wanderingVillagers: true, // villagers stroll and patrol instead of standing still
};
