// Feature switches. Turn a feature off here to remove it from the game
// without deleting its code. New features get a switch when they are added.
export const FEATURES = {
  enemies: true,        // slimes spawn and roam
  combat: true,         // sword attack (Space / J / gamepad X or A)
  cameraToggle: true,   // switch top-down / behind-the-hero camera (V / Select / R3)
  leveling: true,       // XP, levels, stat growth
  coins: true,          // enemies drop coins
  damageNumbers: true,  // floating numbers on hits
  village: true,        // Lumen Hollow: houses, villagers, safe zone
  dialogue: true,       // talk to villagers (E / gamepad A or Y)
  shop: true,           // Mina's shop: spend coins on gear
  gamepad: true,        // controller support
};
