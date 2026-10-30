const $ = (id) => document.getElementById(id);

// World HUD: short messages, the breath bar, and the Skills page.
export default class WorldHud {
  constructor() {
    this.open = false;
    this.timer = null;
  }

  message(text, big = false) {
    const el = $('toast');
    el.textContent = text;
    el.className = big ? 'show big' : 'show';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { el.className = ''; }, big ? 4200 : 2800);
  }

  setBreath(amount) {
    const bar = $('breath');
    bar.hidden = amount === null;
    if (amount !== null) $('breath-fill').style.width = `${Math.max(0, amount) * 100}%`;
  }

  // A quick dark blink while the hero is carried back to shore.
  gasp() {
    const el = $('blink');
    el.className = 'on';
    setTimeout(() => { el.className = ''; }, 90);
  }

  renderSkills(list) {
    $('skill-list').innerHTML = list.length
      ? list.map((s) => `<li>
          <div class="skill-top"><span class="skill-name">${s.name}</span><span class="skill-rank">Level ${s.level}: ${s.title}</span></div>
          <p>${s.desc}</p>
          <p class="skill-perk">${s.perk}</p>
          <div class="skill-bar"><div style="width:${Math.round(s.progress * 100)}%"></div></div>
          <p class="skill-next">${s.next ? `Next: ${s.next}` : 'Mastered'}</p>
        </li>`).join('')
      : '<li class="skill-empty">Nothing learned yet. Skills come from trying things, and from getting them wrong.</li>';
  }

  toggle(list) {
    this.open = !this.open;
    $('skills').hidden = !this.open;
    if (this.open) this.renderSkills(list);
  }
}
