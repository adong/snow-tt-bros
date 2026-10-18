/* Snow TT Bros: the game shell. Screens (title, play, pause, game over, win), keyboard and touch input, the HUD,
   the call-your-brother button, sounds and banners for the world's events, saving progress, and window.game hooks
   for testing. The rules live in js/sim.js and the drawing in js/view.js. */
(function () {
  'use strict';
  const ST = window.ST;
  const S = Kit.sound;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  document.title = ST.TITLE;

  // ---- saved progress: highest floor reached, easy mode, best score ----
  const SAVE_KEY = 'snowTT.save';
  const save = { best: 1, easy: false, hi: 0 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };

  const view = new ST.View($('#view'));
  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });
  const NAME = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const other = (id) => Kit.roster.buddyFor(id);

  const G = {
    state: 'title', world: null, attract: null, clock: 0, frozen: false, keepAwake: false, touch: false,
    opts: { mode: '1p', hero: 'teddy', floor: 1, easy: !!save.easy }, sel: 0, timers: [], pickStreak: 0, pickT: 0,
  };
  const world = () => G.world || G.attract;
  const after = (sec, fn) => G.timers.push({ t: G.clock + sec, fn });

  // ---- title screen ----
  $('#logo').innerHTML = ST.TITLE.replace('TT', '<span class="t1">T</span><span class="t2">T</span>');
  for (const img of $$('img[data-face]')) img.src = faces[img.dataset.face];
  const cards = $$('#cards .card');
  function select(i) { G.sel = (i + cards.length) % cards.length; cards.forEach((c, k) => c.classList.toggle('sel', k === G.sel)); }
  cards.forEach((c, i) => c.addEventListener('click', () => { select(i); startFromCard(); }));
  function startFromCard() {
    const c = cards[G.sel];
    start({ mode: c.dataset.mode, hero: c.dataset.hero || 'teddy' });
  }
  function refreshOpts() {
    $('#optEasy').classList.toggle('on', G.opts.easy);
    $('#optEasy').textContent = G.opts.easy ? '🐣 EASY: ON' : '🐣 EASY: OFF';
    G.opts.floor = Math.max(1, Math.min(G.opts.floor, save.best, ST.FLOORS.length));
    $('#optFloor span').textContent = `FLOOR ${G.opts.floor}`;
    $('#floorDown').style.visibility = G.opts.floor > 1 ? '' : 'hidden';
    $('#floorUp').style.visibility = G.opts.floor < Math.min(save.best, ST.FLOORS.length) ? '' : 'hidden';
    const icon = S.isMuted() ? '🔇' : '🔊';
    $('#optMute').textContent = icon;
    $('#btnMute').textContent = icon;
  }
  $('#optEasy').addEventListener('click', () => { G.opts.easy = !G.opts.easy; save.easy = G.opts.easy; store(); refreshOpts(); ST.sfx.click(); });
  $('#floorDown').addEventListener('click', (e) => { e.stopPropagation(); G.opts.floor--; refreshOpts(); ST.sfx.click(); });
  $('#floorUp').addEventListener('click', (e) => { e.stopPropagation(); G.opts.floor++; refreshOpts(); ST.sfx.click(); });
  const toggleMute = () => { S.init(); S.toggleMute(); refreshOpts(); };
  $('#optMute').addEventListener('click', toggleMute);
  $('#btnMute').addEventListener('click', toggleMute);
  $('#btnPause').addEventListener('click', () => (G.state === 'play' ? pause() : resume()));
  $('#btnResume').addEventListener('click', () => resume());
  $('#btnQuit').addEventListener('click', () => toTitle());
  $('#btnContinue').addEventListener('click', () => continueGame());
  $('#btnOverQuit').addEventListener('click', () => toTitle());
  $('#btnAgain').addEventListener('click', () => toTitle());

  // ---- screens ----
  function setScreen(s) {
    G.state = s;
    $('#title').classList.toggle('hidden', s !== 'title');
    $('#pause').classList.toggle('hidden', s !== 'paused');
    $('#over').classList.toggle('hidden', s !== 'over');
    $('#win').classList.toggle('hidden', s !== 'win');
    $('#hud').classList.toggle('hidden', s === 'title');
    $('#touch').classList.toggle('hidden', !(G.touch && s === 'play'));
    if (s === 'title') { $('#banner').classList.add('hidden'); for (const t of toasts) t.el.remove(); toasts.length = 0; }
    updateInsets();
  }

  function updateInsets() {
    const short = innerHeight < 520;
    const touch = G.touch && G.state !== 'title';
    view.setInsets({ top: G.state === 'title' ? 0 : short ? 52 : 66, bottom: touch ? (short ? 92 : 122) : 0 });
  }

  function newAttract() {
    const w = new ST.World({ floor: 1 + Math.floor(Math.random() * 4), mode: 'normal', players: [{ id: 'teddy' }, { id: 'tommy' }], god: true });
    for (const p of w.players) p.bot = new ST.Bot(w, p);
    w.attract = true;
    G.attract = w;
    view.buildFloor(w);
  }

  function start(o) {
    S.init();
    Object.assign(G.opts, o);
    const players = G.opts.mode === '2p' ? [{ id: 'teddy' }, { id: 'tommy' }] : [{ id: G.opts.hero }];
    G.world = new ST.World({ floor: G.opts.floor, mode: G.opts.easy ? 'easy' : 'normal', players });
    G.attract = null;
    view.buildFloor(G.world);
    setupHud();
    setScreen('play');
    S.music('play');
    ST.sfx.go();
  }

  function pause() { if (G.state !== 'play') return; setScreen('paused'); S.music('pause'); }
  function resume() { if (G.state !== 'paused') return; setScreen('play'); S.music('play'); }
  function toTitle() {
    G.world = null;
    newAttract();
    setScreen('title');
    refreshOpts();
    S.music('title');
  }
  function continueGame() {
    if (G.state !== 'over' || !G.world) return;
    G.world.continueGame();
    setScreen('play');
    S.music('play');
    banner('KEEP GOING!', 'clear', 1.2);
  }
  function scoresHtml(w) {
    return w.players.map((p) => `<div><img src="${faces[p.id]}" alt="">${NAME[p.id]} <b>${p.score}</b></div>`).join('');
  }

  // ---- banners and toasts (timed in game time, so they behave under game.step) ----
  let bannerT = 0;
  function banner(html, cls = '', dur = 1.6) {
    const b = $('#banner');
    b.innerHTML = html;
    b.className = '';
    void b.offsetWidth;
    b.className = 'pop ' + cls;
    bannerT = dur;
  }
  const toasts = [];
  function toast(html, cls = '', dur = 2.4) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = html;
    $(cls.includes('tip') ? '#tips' : '#toasts').appendChild(el);
    toasts.push({ el, t: dur });
    while (toasts.length > 3) toasts.shift().el.remove();
  }
  function tickUi(dt) {
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('#banner').classList.add('hidden'); }
    for (const t of toasts) {
      t.t -= dt;
      if (t.t <= 0 && !t.bye) { t.bye = true; t.el.classList.add('bye'); }
      if (t.t <= -0.35) { t.el.remove(); t.dead = true; }
    }
    for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].dead) toasts.splice(i, 1);
    const due = G.timers.filter((t) => t.t <= G.clock);
    G.timers = G.timers.filter((t) => t.t > G.clock);
    for (const t of due) t.fn();
  }

  // ---- HUD ----
  const hudCache = {};
  function setupHud() {
    const w = G.world;
    w.players.forEach((p, i) => {
      const card = $(i ? '#p2' : '#p1');
      card.classList.toggle('hidden', false);
      card.classList.toggle('tommy', p.id === 'tommy');
      card.querySelector('.face').src = faces[p.id];
      card.querySelector('.name').textContent = NAME[p.id];
    });
    if (!w.twoP) $('#p2').classList.add('hidden');
    const ring = $('#buddyBtn .ring');
    const cool = ring.querySelector('.cool');
    ring.innerHTML = '';
    if (w.twoP) {
      const two = document.createElement('div');
      two.className = 'two';
      two.innerHTML = `<img src="${faces.teddy}" alt=""><img src="${faces.tommy}" alt="">`;
      ring.appendChild(two);
    } else {
      const img = document.createElement('img');
      img.src = faces[other(w.players[0].id)];
      ring.appendChild(img);
      $('#buddyBar img').src = faces[other(w.players[0].id)];
    }
    ring.appendChild(cool);
    for (const k in hudCache) delete hudCache[k];
  }
  const set = (key, v, fn) => { if (hudCache[key] !== v) { hudCache[key] = v; fn(v); } };
  const POWER_CHIP = { speed: ['#ff4d5e', '⚡'], big: ['#3d8bff', '●'], long: ['#ffd23f', '➜'] };
  function updateHud() {
    const w = G.world;
    if (!w) return;
    w.players.forEach((p, i) => {
      const card = $(i ? '#p2' : '#p1');
      const hearts = p.state === 'out' ? '💤' : '❤️'.repeat(Math.min(p.lives, 5)) + (p.lives > 5 ? `+${p.lives - 5}` : '');
      set('h' + i, hearts, (v) => { card.querySelector('.hearts').textContent = v; });
      set('s' + i, p.score, (v) => { card.querySelector('.score').textContent = v; });
      set('o' + i, p.state === 'out', (v) => card.classList.toggle('out', v));
      const pw = Object.keys(p.powers).filter((k) => p.powers[k]).join(',') + (p.burstT > 0 ? ',burst' : '') + (p.state === 'balloon' ? ',balloon' : '');
      set('p' + i, pw, () => {
        card.querySelector('.powers').innerHTML = Object.keys(POWER_CHIP).filter((k) => p.powers[k]).map((k) => `<i style="background:${POWER_CHIP[k][0]}">${POWER_CHIP[k][1]}</i>`).join('')
          + (p.burstT > 0 ? '<i style="background:#ff8ad8">⭐</i>' : '') + (p.state === 'balloon' ? '<i style="background:#38d27a">🎈</i>' : '');
      });
    });
    set('floor', w.floorN + '|' + w.def.name, () => { $('#floorTag').innerHTML = `<b>${w.floorN}</b><span>${w.def.name}</span>`; });
    const B = w.boss;
    const bossOn = !!(B && !B.gone);
    set('bossOn', bossOn, (v) => $('#bossBar').classList.toggle('hidden', !v));
    if (bossOn) {
      set('bossName', B.name, (v) => { $('#bossBar b').textContent = v; });
      set('bossHp', B.hp, (v) => { $('#bossBar .bar i').style.width = `${(100 * v) / B.maxHp}%`; });
    }
    // the call-your-brother button
    const btn = $('#buddyBtn');
    if (w.twoP) {
      const cd = w.hi5Cd / w.M.hi5Cd;
      set('cd', Math.ceil(w.hi5Cd), (v) => { btn.querySelector('.lbl').innerHTML = v > 0 ? `HIGH FIVE<br>IN ${v}` : 'HIGH<br>FIVE!'; });
      btn.querySelector('.cool').style.setProperty('--cd', `${Math.round(cd * 100)}%`);
      set('here', w.hi5Cd <= 0, (v) => btn.classList.toggle('here', v));
      set('bar', false, () => $('#buddyBar').classList.add('hidden'));
    } else {
      const b = w.buddy, left = w.buddyLeft();
      const name = NAME[other(w.players[0].id)];
      set('lbl', (b ? 'more' : 'call') + name, () => { btn.querySelector('.lbl').innerHTML = b ? 'ANOTHER<br>TREAT!' : `CALL<br>${name}`; });
      btn.querySelector('.cool').style.setProperty('--cd', '0%');
      set('here', !!b && left > 0, (v) => btn.classList.toggle('here', v));
      set('bar', left > 0, (v) => $('#buddyBar').classList.toggle('hidden', !v));
      if (left > 0) $('#buddyBar .track i').style.width = `${Math.round(left * 100)}%`;
    }
  }

  function callBuddy() {
    const w = G.world;
    if (!w || G.state !== 'play') return;
    S.init();
    w.callBuddy();
  }
  $('#buddyBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); callBuddy(); });

  // ---- world events: sounds, banners, toasts ----
  function onEvent(e, w) {
    view.fx(e, w);
    if (w.attract) {
      if (e.t === 'floorDone') { w.loadFloor(e.last ? 1 : (e.n % 4) + 1); view.buildFloor(w); }
      return;
    }
    const sfx = ST.sfx;
    switch (e.t) {
      case 'floor':
        if (e.boss) banner(`${e.boss}<small>FLOOR ${e.n} · roll snowballs into the boss!</small>`, 'boss', 2.4);
        else banner(`FLOOR ${e.n}<small>${w.def.name}</small>`, '', 1.6);
        if (w.def.tip) after(e.boss ? 2.4 : 1.4, () => toast('💡 ' + w.def.tip, 'tip', 3.6));
        save.best = Math.max(save.best, e.n);
        store();
        break;
      case 'go': banner('GO!', 'clear', 0.7); sfx.go(); break;
      case 'throw': (e.p.id === 'tommy' ? sfx.throwM : sfx.throwT).call(sfx); break;
      case 'snowHit': sfx.snowHit(e.level); break;
      case 'poof': sfx.poof(e.s && e.s.big); break;
      case 'encase': sfx.encase(); break;
      case 'kick': sfx.kick(); break;
      case 'bounce': sfx.bounce(); break;
      case 'ko': sfx.ko(e.n); break;
      case 'combo':
        sfx.combo(e.n);
        if (e.super) banner('SUPER COMBO!', 'clear', 1.4);
        else if (e.n >= 3) toast(`${e.n} COMBO! 🍦🍪🍉`, 'big', 1.6);
        break;
      case 'shatter': sfx.shatter(); break;
      case 'pickup':
        G.pickStreak = G.clock - G.pickT < 1.2 ? G.pickStreak + 1 : 0;
        G.pickT = G.clock;
        sfx.pickup(G.pickStreak);
        break;
      case 'potion': sfx.potion(); toast(`🧪 ${e.label}`, 'big', 1.8); break;
      case 'dizzy': sfx.dizzy(); flashCard(e.p); break;
      case 'saved': sfx.saved(); toast(`${NAME[e.by] || 'YOUR BROTHER'} SAVED YOU!`, 'big', 2.2); break;
      case 'hurry': sfx.hurry(); banner('HURRY UP!', 'hurry', 1.6); break;
      case 'ghost': sfx.ghost(); toast('👻 A ghost-snowman! He just wants to tickle.', 'tip', 2.6); break;
      case 'tickle': sfx.tickle(); break;
      case 'thump': sfx.thump(); break;
      case 'bossHit':
        sfx.bossHit();
        $('#bossBar').classList.remove('flash'); void $('#bossBar').offsetWidth; $('#bossBar').classList.add('flash');
        break;
      case 'bossDown': sfx.bossDown(); banner(`YOU BONKED<small>${e.boss.name}</small>`, 'clear', 2.4); break;
      case 'clear': sfx.clear(); if (!w.def.boss) banner('FLOOR CLEAR!', 'clear', 1.8); break;
      case 'celebrate': break;
      case 'floorDone':
        if (e.last) { win(); break; }
        w.loadFloor(e.n + 1);
        view.buildFloor(w);
        break;
      case 'buddyCall':
        if (!e.again) { sfx.whee(); toast(`HERE COMES ${NAME[e.id]}!`, '', 1.4); }
        break;
      case 'treat': sfx.treat(); toast(`${e.emoji} ${e.name} FROM ${NAME[e.from.id]}!`, 'treat', 2.4); break;
      case 'buddyBye': sfx.bye(); break;
      case 'highfive': sfx.hi5(); banner('HIGH FIVE!<small>power burst! ⭐</small>', 'clear', 1.4); break;
      case 'balloonPop': sfx.pop(); break;
      case 'oneUp': sfx.oneUp(); toast(`1UP! ${NAME[e.p.id]} +❤️`, 'big', 1.6); break;
      case 'jump': sfx.jump(); break;
      case 'land': if (e.p) sfx.land(); break;
      case 'breakFree': sfx.breakFree(); break;
      case 'out':
        if (w.twoP && w.players.some((p) => p.state !== 'out')) toast(`${NAME[e.p.id]} is resting! Press ${e.p.slot ? 'L' : 'F'} (or ❄️) to jump back in`, 'tip', 3.5);
        break;
      case 'rejoin': toast(`${NAME[e.p.id]} IS BACK!`, '', 1.4); break;
      case 'gameOver':
        after(1.2, () => {
          if (G.state !== 'play') return;
          $('#overFloor').textContent = w.floorN;
          $('#overScores').innerHTML = scoresHtml(w);
          setScreen('over');
          S.music('over');
        });
        break;
    }
  }
  function flashCard(p) {
    const card = p.slot === 1 ? $('#p2') : $('#p1');
    card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
  }
  function win() {
    const w = G.world;
    save.best = ST.FLOORS.length;
    save.hi = Math.max(save.hi, ...w.players.map((p) => p.score));
    store();
    $('#winScores').innerHTML = scoresHtml(w);
    setScreen('win');
    ST.sfx.fanfare();
  }

  // ---- input ----
  const keys = new Set();
  const touchIn = [{ l: 0, r: 0, d: 0, jump: 0, throw: 0 }, { l: 0, r: 0, d: 0, jump: 0, throw: 0 }];
  const K = {
    teddy: { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW'], throw: ['KeyF', 'KeyG'] },
    tommy: { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp'], throw: ['KeyL', 'KeyK', 'Enter', 'NumpadEnter', 'Numpad0', 'Slash'] },
    solo: { left: [], right: [], down: [], jump: ['Space'], throw: ['KeyJ', 'KeyX', 'KeyZ'] },
  };
  function inputFor(slot, w) {
    const sets = w.twoP ? [slot === 0 ? K.teddy : K.tommy] : [K.teddy, K.tommy, K.solo];
    const any = (what) => sets.some((s) => s[what].some((c) => keys.has(c)));
    const t = touchIn[w.twoP ? slot : 0];
    const L = any('left') || t.l, R = any('right') || t.r;
    return { mx: (R ? 1 : 0) - (L ? 1 : 0), down: !!(any('down') || t.d), jump: !!(any('jump') || t.jump), throw: !!(any('throw') || t.throw) };
  }

  const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
  addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    S.init();
    const c = e.code;
    if (G.state === 'title') {
      if (c === 'ArrowLeft' || c === 'KeyA') { select(G.sel - 1); ST.sfx.click(); }
      else if (c === 'ArrowRight' || c === 'KeyD') { select(G.sel + 1); ST.sfx.click(); }
      else if (c === 'ArrowUp' || c === 'KeyW') { G.opts.floor++; refreshOpts(); }
      else if (c === 'ArrowDown' || c === 'KeyS') { G.opts.floor--; refreshOpts(); }
      else if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3') { select(+c.slice(5) - 1); startFromCard(); }
      else if (c === 'Enter' || c === 'Space') startFromCard();
      else if (c === 'KeyE') $('#optEasy').click();
      else if (c === 'KeyM') toggleMute();
      return;
    }
    if (c === 'KeyM') { toggleMute(); return; }
    if (G.state === 'play') {
      if (c === 'KeyP' || c === 'Escape') pause();
      else if (c === 'KeyT') callBuddy();
    } else if (G.state === 'paused') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') resume();
    } else if (G.state === 'over') {
      if (c === 'Space' || c === 'Enter') continueGame();
      else if (c === 'Escape') toTitle();
    } else if (G.state === 'win') {
      if (c === 'Space' || c === 'Enter' || c === 'Escape') toTitle();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // touch: a slide pad (left / down / right) and jump + throw buttons, one set per player
  function useTouch() {
    if (G.touch) return;
    G.touch = true;
    document.body.classList.add('touch');
    $('#touch').classList.toggle('hidden', G.state !== 'play');
    updateInsets();
  }
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') useTouch(); S.init(); }, true);
  if (matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) { G.touch = true; document.body.classList.add('touch'); }
  for (const setEl of $$('.tset')) {
    const slot = +setEl.dataset.slot;
    const pad = setEl.querySelector('.tpad');
    const held = new Map();
    const updatePad = () => {
      const r = pad.getBoundingClientRect();
      let l = 0, rr = 0, d = 0;
      for (const p of held.values()) {
        const fx = (p.x - r.left) / r.width, fy = (p.y - r.top) / r.height;
        if (fx < 0.38) l = 1; else if (fx > 0.62) rr = 1; else if (fy > 0.4) d = 1;
      }
      Object.assign(touchIn[slot], { l, r: rr, d });
      pad.querySelector('.l').classList.toggle('on', !!l);
      pad.querySelector('.r').classList.toggle('on', !!rr);
      pad.querySelector('.d').classList.toggle('on', !!d);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (_) { /* old browser */ } held.set(e.pointerId, { x: e.clientX, y: e.clientY }); updatePad(); });
    pad.addEventListener('pointermove', (e) => { if (held.has(e.pointerId)) { held.set(e.pointerId, { x: e.clientX, y: e.clientY }); updatePad(); } });
    const up = (e) => { held.delete(e.pointerId); updatePad(); };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    for (const what of ['jump', 'throw']) {
      const b = setEl.querySelector('.tb.' + what);
      const ids = new Set();
      const sync = () => { touchIn[slot][what] = ids.size ? 1 : 0; b.classList.toggle('on', ids.size > 0); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* old browser */ } ids.add(e.pointerId); sync(); });
      b.addEventListener('pointerup', (e) => { ids.delete(e.pointerId); sync(); });
      b.addEventListener('pointercancel', (e) => { ids.delete(e.pointerId); sync(); });
    }
  }
  function layoutTouch() {
    const two = !!(G.world && G.world.twoP);
    $('.tset.s0').classList.toggle('solo', !two);
    $('.tset.s1').classList.toggle('hidden', !two);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!G.keepAwake) { pause(); S.suspend(); } }
    else S.resume();
  });
  addEventListener('resize', () => { view.resize(); updateInsets(); });

  // ---- the loop ----
  let lastW = 0, lastH = 0;
  function tick(dt) {
    G.clock += dt;
    if (innerWidth !== lastW || innerHeight !== lastH) { lastW = innerWidth; lastH = innerHeight; view.resize(); updateInsets(); }
    const w = world();
    if (!w) return;
    if (G.state === 'play' || G.state === 'title') {
      if (G.state === 'play') {
        layoutTouch();
        w.players.forEach((p, i) => { if (!p.bot) p.input = inputFor(i, w); });
      }
      w.step(dt);
      const evs = w.events.splice(0);
      for (const e of evs) onEvent(e, world());
      if (G.state === 'play' && w.enemies.some((e) => e.state === 'rolling')) ST.sfx.roll(G.clock);
    }
    const w2 = world();
    if (w2) view.sync(w2, G.state === 'paused' ? 0 : dt);
    tickUi(dt);
    if (G.state !== 'title') updateHud();
  }
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!G.frozen) tick(dt);
    view.render();
  }

  // ---- test hooks ----
  window.game = {
    get state() { return G.state; },
    get world() { return world(); },
    view,
    // advance the game synchronously and draw (the hidden Browser pane throttles animation frames)
    step(seconds = 1 / 60) {
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) tick(1 / 60);
      view.render();
      const w = world();
      return w ? { state: G.state, floor: w.floorN, phase: w.phase, enemies: w.enemies.length, time: +w.time.toFixed(1), buddy: w.buddy && w.buddy.cstate } : { state: G.state };
    },
    start(o = {}) { start(Object.assign({ mode: '1p', hero: 'teddy', floor: 1, easy: false }, o)); return this.step(0); },
    title() { toTitle(); },
    buddy() { callBuddy(); return world() && world().buddy && world().buddy.cstate; },
    // let the autopilot play the brothers (on), or hand them back to the keys (off)
    auto(on = true) { const w = world(); for (const p of w.players) p.bot = on ? new ST.Bot(w, p) : null; },
    god(on = true) { world().god = on; },
    floor(n) { const w = G.world; if (!w) return; w.loadFloor(n); view.buildFloor(w); return this.step(0); },
    // turn every baddy into a snowball (for combo screenshots)
    snowAll() { const w = world(); for (const e of w.enemies) if (e.state === 'walk' || e.state === 'spawn' || e.state === 'stun') { e.state = 'walk'; w.encase(e, w.players[0]); } },
    check(o) { return ST.check(o); },
    keepAwake(on = true) { G.keepAwake = on; },
    freeze(on = true) { G.frozen = on; },
    calm(on = true) { document.body.classList.toggle('calm', on); },
    peek(on = true) { view.zoomTo = on ? (typeof on === 'object' ? on : world().players[0]) : null; },
    pause, resume, continueGame, toTitle, setTouch(on = true) { G.touch = on; document.body.classList.toggle('touch', on); setScreen(G.state); layoutTouch(); },
  };

  newAttract();
  refreshOpts();
  setScreen('title');
  requestAnimationFrame(frame);
})();
