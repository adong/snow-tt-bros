/* Snow TT Bros: the game's own sounds, made with Kit.sound.tone / hiss (no audio files). Exposes ST.sfx. */
(function () {
  'use strict';
  const ST = (window.ST = window.ST || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  let lastRoll = 0;

  ST.sfx = {
    throwT() { hiss({ f: 1800, to: 3800, dur: 0.12, vol: 0.09, q: 1.5 }); tone({ type: 'triangle', f: 500, to: 760, dur: 0.08, vol: 0.05 }); },
    throwM() { hiss({ f: 2200, to: 4200, dur: 0.1, vol: 0.09, q: 1.5 }); tone({ type: 'triangle', f: 700, to: 1050, dur: 0.07, vol: 0.05 }); },
    // a soft snow "poof" when a shot hits
    poof(big) { hiss({ filter: 'lowpass', f: big ? 1800 : 2600, to: 400, dur: big ? 0.22 : 0.15, vol: big ? 0.3 : 0.22 }); },
    snowHit(level) { this.poof(); tone({ type: 'triangle', f: 520 + level * 130, dur: 0.07, vol: 0.06, at: 0.02 }); },
    encase() {
      hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.25, vol: 0.3 });
      [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: 0.05 + i * 0.05, dur: 0.12, vol: 0.07 }));
    },
    kick() { S.punch(); hiss({ filter: 'lowpass', f: 900, to: 300, dur: 0.3, vol: 0.18 }); },
    // the rumble of a rolling snowball (called every frame while one rolls; it re-triggers itself)
    roll(t) { if (t - lastRoll > 0.14) { lastRoll = t; hiss({ filter: 'lowpass', f: 380, to: 260, dur: 0.18, vol: 0.12, attack: 0.03 }); } },
    bounce() { tone({ f: 160, to: 90, dur: 0.12, vol: 0.28 }); hiss({ filter: 'lowpass', f: 900, dur: 0.08, vol: 0.12 }); },
    ko(n) {
      S.punch();
      const k = Math.pow(2, Math.min(n - 1, 8) / 6);
      tone({ type: 'square', f: 330 * k, to: 660 * k, dur: 0.18, vol: 0.05, lp: 2400, at: 0.03 });
    },
    combo(n) { [523, 659, 784, 1047, 1319, 1568].slice(0, Math.min(6, n + 2)).forEach((f, i) => tone({ type: 'triangle', f, at: 0.08 + i * 0.06, dur: 0.16, vol: 0.1 })); },
    shatter() { hiss({ filter: 'highpass', f: 1500, to: 600, dur: 0.3, vol: 0.25 }); tone({ type: 'square', f: 420, to: 120, dur: 0.25, vol: 0.05 }); },
    pickup(streak) { S.coin(streak || 0); },
    potion() { S.powerup(); },
    dizzy() {
      tone({ f: 200, to: 70, dur: 0.25, vol: 0.32 });
      [660, 622, 587, 554].forEach((f, i) => tone({ type: 'triangle', f, to: f * 0.94, at: 0.15 + i * 0.16, dur: 0.15, vol: 0.08 }));
      [2400, 2900, 2400, 2900].forEach((f, i) => tone({ f, at: 0.9 + i * 0.09, dur: 0.05, vol: 0.03 }));
    },
    saved() { [880, 1109, 1319, 1760].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.05, dur: 0.2, vol: 0.1 })); hiss({ filter: 'highpass', f: 5000, dur: 0.3, vol: 0.06 }); },
    hurry() { for (let i = 0; i < 3; i++) { tone({ type: 'square', f: 880, at: i * 0.3, dur: 0.12, vol: 0.05, lp: 3000 }); tone({ type: 'square', f: 660, at: i * 0.3 + 0.14, dur: 0.12, vol: 0.05, lp: 3000 }); } },
    ghost() { tone({ f: 420, to: 620, dur: 0.6, vol: 0.12, attack: 0.1 }); tone({ f: 620, to: 400, dur: 0.7, vol: 0.12, at: 0.6, attack: 0.1 }); },
    tickle() { [900, 1100, 950, 1200, 1000].forEach((f, i) => tone({ type: 'triangle', f, to: f * 1.15, at: i * 0.09, dur: 0.07, vol: 0.06 })); },
    thump() { tone({ f: 90, to: 40, dur: 0.35, vol: 0.5 }); hiss({ filter: 'lowpass', f: 500, to: 100, dur: 0.3, vol: 0.25 }); },
    bossHit() { S.punch(); tone({ f: 140, to: 50, dur: 0.4, vol: 0.4 }); hiss({ filter: 'lowpass', f: 3000, to: 200, dur: 0.4, vol: 0.3 }); },
    bossDown() { S.crash(); this.fanfare(0.5); },
    fanfare(at = 0) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: i < 4 ? 'triangle' : 'square', f, at: at + i * 0.11, dur: i === 6 ? 0.5 : 0.14, vol: i < 4 ? 0.12 : 0.05, lp: 3000 })); },
    clear() { this.fanfare(); },
    balloon() { tone({ type: 'triangle', f: 300, to: 900, dur: 0.5, vol: 0.08 }); },
    pop() { hiss({ filter: 'highpass', f: 2000, dur: 0.08, vol: 0.3 }); tone({ f: 600, to: 200, dur: 0.1, vol: 0.12 }); },
    hi5() {
      hiss({ f: 1600, q: 0.8, dur: 0.06, vol: 0.4 });
      hiss({ f: 2400, q: 0.8, dur: 0.05, vol: 0.25, at: 0.03 });
      [523, 659, 784, 1047].forEach((f) => tone({ type: 'triangle', f, at: 0.08, dur: 0.4, vol: 0.06 }));
    },
    // the companion's slide-whistle entrance and exit
    whee() { tone({ type: 'sine', f: 400, to: 1400, dur: 0.45, vol: 0.1 }); },
    bye() { tone({ type: 'sine', f: 1200, to: 500, dur: 0.45, vol: 0.08 }); },
    treat() { [988, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.07, dur: 0.18, vol: 0.12 })); },
    oneUp() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.1, vol: 0.05, lp: 3500 })); },
    breakFree() { hiss({ filter: 'lowpass', f: 1600, to: 500, dur: 0.3, vol: 0.25 }); tone({ type: 'sawtooth', f: 160, to: 320, dur: 0.2, vol: 0.05, lp: 900 }); },
    go() { tone({ type: 'square', f: 784, dur: 0.1, vol: 0.05, lp: 3000 }); tone({ type: 'square', f: 1175, at: 0.1, dur: 0.25, vol: 0.06, lp: 3000 }); },
    swish() { S.swish(); },
    jump() { S.jump(); },
    land() { tone({ f: 120, to: 60, dur: 0.06, vol: 0.08 }); },
    click() { S.click(); },
  };
})();
