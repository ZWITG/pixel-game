// Feature switches. Turn a feature off here to remove it from the game
// without deleting its code. New features get a switch when they are added.
export const FEATURES = {
  enemies: true,        // slimes spawn and roam
  combat: true,         // sword attack (Space / J / Square or R1)
  spinSlash: true,      // heavier attack that hits all around (F / R2 or Triangle)
  lockOn: true,         // lock onto an enemy (Q / Tab / L2 or R3), switch with Z X / right-stick flick
  swimming: true,       // open world: learn to swim by trying; shows on the Skills page
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
  wanderingVillagers: true, // villagers stroll and patrol instead of standing still
};
