import './ui/hud.css';
import Game from './core/Game.js';

const game = new Game(document.getElementById('game'));
game.start();

// Handy for debugging in the browser console and for automated checks:
// __game.step(1 / 60) advances one frame by hand.
window.__game = game;
