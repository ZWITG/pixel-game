// Small rising text for damage numbers, pickups and level ups.
export function floatText(scene, x, y, text, color = '#ffffff') {
  const label = scene.add.text(x, y, text, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color,
    stroke: '#1a1c2c',
    strokeThickness: 3,
    resolution: 4,
  }).setOrigin(0.5).setDepth(100000);
  scene.tweens.add({
    targets: label,
    y: y - 14,
    alpha: 0,
    duration: 700,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
}
