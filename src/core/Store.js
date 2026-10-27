// Tiny key/value store for player stats. Listeners run on every change,
// which is how the HUD stays in sync.
export default class Store {
  constructor() {
    this.data = {};
    this.listeners = new Set();
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    for (const fn of this.listeners) fn(key, value);
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
