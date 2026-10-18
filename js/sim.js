/* Snow TT Bros: the rules of the game. No Three.js and no DOM, so the same code runs the browser game, the
   title-screen autopilot, the companion's brain and the headless floor check (node tools/check.js).
   Units are tiles (1 tile = 1 m in the 3D view). y points up and x to the right, and a body's (x, y) is the middle
   of its feet. Floors are 20 x 15 tiles; row 0 of a map is the top. Exposes ST.TUNE, ST.MODES, ST.KINDS, ST.BOSSES,
   ST.World, ST.Bot, ST.parseFloor, ST.navFor, ST.moveBody. */
(function (root) {
  'use strict';
  const ST = (root.ST = root.ST || {});

  // ---- the feel of the game: change these to tune it ----
  const TUNE = {
    W: 20, H: 15,
    gravity: 34, maxFall: 20,
    jump: 15.6,                 // take-off speed: about 3.6 tiles high, so the next platform up (3 rows) is easy
    run: 4.6, fastRun: 6.3,     // tiles per second; fast = red potion or the high-five burst
    pw: 0.7, ph: 1.5,           // a brother's body
    throwCd: 0.3, throwAnim: 0.26, kickAnim: 0.3,
    shotSpeed: 12, longSpeed: 14, shotRange: 4.6, longRange: 7.6,
    snowMax: 4,                 // snow hits to turn an enemy into a snowball (a big shot counts 2)
    roll: 10, push: 2.2, ballSize: 1.5, ballBounces: 4, rollTime: 9,
    dizzy: 1.7, safeAfter: 2.6, // seconds sitting dizzy; seconds of blinking safety after
    visit: 10,                  // seconds the companion stays
    burst: 6,                   // seconds of the 2P high-five power burst
    balloon: 7,                 // seconds of the green balloon potion
    extraLife: 20000,
    intro: 1.6, bossIntro: 2.6, clearWait: 2.2, celebrate: 3.0,
  };

  const MODES = {
    normal: { lives: 3, enemySpeed: 1, snowHold: 3, snowMelt: 1.0, ballTime: 7, hurry: 45, chase: 0.5, bossHp: 0, minionEvery: 1, keepPowers: false, hi5Cd: 20 },
    easy: { lives: 5, enemySpeed: 0.7, snowHold: 4.5, snowMelt: 1.5, ballTime: 10, hurry: 70, chase: 0.15, bossHp: -2, minionEvery: 1.35, keepPowers: true, hi5Cd: 12 },
  };

  // Baddies. hop: seconds between hops up to the platform above; edgeTurn: chance to turn around at a ledge.
  const KINDS = {
    zombie: { w: 0.72, h: 1.4, speed: 1.25, hop: [5, 9], edgeTurn: 0.75, smallHop: false },
    robot: { w: 0.74, h: 1.45, speed: 1.8, hop: [3, 6], edgeTurn: 0.55, smallHop: false },
    gremlin: { w: 0.7, h: 1.0, speed: 2.4, hop: [2, 4], edgeTurn: 0.45, smallHop: true },
  };
  const LETTERS = { z: 'zombie', r: 'robot', g: 'gremlin' };
  const SNOW_SPEED = [1, 0.55, 0.25, 0, 0];

  // Bosses live on the bottom floor of a boss arena and only rolling snowballs hurt them.
  const BOSSES = {
    zombo: { name: 'GIANT ZOMBO', w: 2.4, h: 4.2, hp: 5, speed: 1.1, minion: ['zombie'], every: 5, max: 3, hop: [4, 7], hopV: 7 },
    robo: { name: 'ROBO-RUMBLE', w: 2.6, h: 4.3, hp: 6, speed: 1.5, minion: ['robot'], every: 4.5, max: 3, hop: [3, 5], hopV: 7.5 },
    fluff: { name: 'BIG FLUFF', w: 2.8, h: 3.8, hp: 6, speed: 1.9, minion: ['gremlin'], every: 4, max: 4, hop: [1.6, 3], hopV: 8 },
    castle: { name: 'KING GRUMPCASTLE', w: 4.2, h: 4.6, hp: 8, speed: 0.9, minion: ['zombie', 'robot', 'gremlin'], every: 3.6, max: 4, hop: [5, 8], hopV: 6 },
  };

  const TREATS = [['🍪', 100], ['🍦', 200], ['🍉', 300], ['🍩', 200], ['🍓', 150]];
  const BUDDY_TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const POTIONS = {
    speed: { label: 'ZOOMY SHOES!', color: '#ff4d5e' },
    big: { label: 'BIG SNOW!', color: '#3d8bff' },
    long: { label: 'LONG THROW!', color: '#ffd23f' },
    balloon: { label: 'BALLOON!', color: '#38d27a' },
  };

  const DT = 1 / 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rowOfY = (y) => TUNE.H - 1 - Math.floor(y);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- floors ----
  // Legend: #  solid block   =  snowy ledge (jump up through it; down + jump drops through)   .  air
  //         1 2  Teddy's / Tommy's start   z r g  zombie, robot, gremlin   B  the boss (boss floors)
  function parseFloor(def, index) {
    const { W, H } = TUNE;
    const grid = [];
    const spawns = { players: [], enemies: [], boss: null };
    for (let r = 0; r < H; r++) {
      const line = String((def.map && def.map[r]) || '').padEnd(W, '.');
      const row = [];
      for (let c = 0; c < W; c++) {
        let ch = line[c];
        const x = c + 0.5, y = H - 1 - r;
        if (ch === '1' || ch === '2') { spawns.players[+ch - 1] = { x, y, c, r }; ch = '.'; }
        else if (LETTERS[ch]) { spawns.enemies.push({ type: LETTERS[ch], x, y, c, r }); ch = '.'; }
        else if (ch === 'B') { spawns.boss = { x, y, c, r }; ch = '.'; }
        else if (ch !== '#' && ch !== '=') ch = '.';
        row.push(ch);
      }
      grid.push(row);
    }
    const f = {
      def, index, W, H, grid, spawns,
      tile(c, r) {
        if (c < 0 || c >= W || r >= H) return '#';
        if (r < 0) return '.';
        return grid[r][c];
      },
      solid(c, r) { return f.tile(c, r) === '#'; },
      // a tile you can stand on: solid or ledge, with two free tiles above it, inside the map, not the top row
      standable(c, r) {
        if (c < 0 || c >= W || r < 1 || r >= H) return false;
        const t = grid[r][c];
        return (t === '#' || t === '=') && !f.solid(c, r - 1) && !f.solid(c, r - 2);
      },
    };
    return f;
  }

  // Move a body one step with gravity: walls (#) stop it sideways and from above, ledges (=) only catch it falling.
  // Returns -1 / 1 when it ran into a wall on that side. The players, baddies, snowballs and treats all use this.
  function moveBody(f, b, dt) {
    const H = TUNE.H;
    let wall = 0;
    if (b.dropT > 0) b.dropT = Math.max(0, b.dropT - dt);
    if (b.vx !== 0) {
      b.x += b.vx * dt;
      const rTop = rowOfY(b.y + b.h - 0.02), rBot = rowOfY(b.y + 0.02);
      if (b.vx > 0) {
        const c = Math.floor(b.x + b.w / 2);
        for (let r = rTop; r <= rBot; r++) if (f.solid(c, r)) { b.x = c - b.w / 2 - 0.0005; wall = 1; break; }
      } else {
        const c = Math.floor(b.x - b.w / 2);
        for (let r = rTop; r <= rBot; r++) if (f.solid(c, r)) { b.x = c + 1 + b.w / 2 + 0.0005; wall = -1; break; }
      }
    }
    b.vy = Math.max(b.vy - TUNE.gravity * dt, -TUNE.maxFall);
    const prevY = b.y;
    b.y += b.vy * dt;
    b.onGround = false;
    const c0 = Math.floor(b.x - b.w / 2 + 0.03), c1 = Math.floor(b.x + b.w / 2 - 0.03);
    if (b.vy <= 0) {
      const top = Math.floor(prevY + 1e-6);
      if (b.y <= top) {
        const r = H - top;
        for (let c = c0; c <= c1; c++) {
          const t = f.tile(c, r);
          if (t === '#' || (t === '=' && !(b.dropT > 0))) { b.y = top; b.vy = 0; b.onGround = true; break; }
        }
      }
    } else {
      const r = rowOfY(b.y + b.h);
      for (let c = c0; c <= c1; c++) if (f.solid(c, r)) { b.y = H - 1 - r - b.h - 0.0005; b.vy = 0; break; }
    }
    return wall;
  }

  // Push a body sideways out of any wall it overlaps (after it grows into a snowball, or a spawn).
  function unstick(f, b) {
    for (let i = 0; i < 3; i++) {
      const rTop = rowOfY(b.y + b.h - 0.02), rBot = rowOfY(b.y + 0.02);
      const cl = Math.floor(b.x - b.w / 2), cr = Math.floor(b.x + b.w / 2);
      let hl = false, hr = false;
      for (let r = rTop; r <= rBot; r++) { if (f.solid(cl, r)) hl = true; if (f.solid(cr, r)) hr = true; }
      if (hl && !hr) b.x = cl + 1 + b.w / 2 + 0.001;
      else if (hr && !hl) b.x = cr - b.w / 2 - 0.001;
      else break;
    }
  }

  const overlap = (a, b, shrink = 0) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - shrink && a.y < b.y + b.h - shrink && b.y < a.y + a.h - shrink;

  // ---- navigation: which platform can a brother jump or fall to from where ----
  // A segment is a run of standable tiles on one row. Edges are found by simulating real jumps and falls with the
  // same physics, so the bots (and the floor check) only use moves that actually work.
  const navCache = new Map();
  function navFor(f) {
    const key = f.grid.map((r) => r.join('')).join('|');
    if (navCache.has(key)) return navCache.get(key);
    const nav = buildNav(f);
    navCache.set(key, nav);
    return nav;
  }

  function buildNav(f) {
    const { W, H } = TUNE;
    const segs = [], segAt = [];
    for (let r = 0; r < H; r++) {
      segAt.push(new Array(W).fill(-1));
      let c = 0;
      while (c < W) {
        if (!f.standable(c, r)) { c++; continue; }
        const c0 = c;
        while (c < W && f.standable(c, r)) segAt[r][c++] = segs.length;
        segs.push({ id: segs.length, r, c0, c1: c - 1, y: H - r, edges: [] });
      }
    }
    const segAtX = (r, x, w = 0.6) => {
      if (r < 0 || r >= H) return -1;
      for (const xx of [x, x - w / 2 + 0.05, x + w / 2 - 0.05]) {
        const c = Math.floor(xx);
        if (c >= 0 && c < W && segAt[r][c] >= 0) return segAt[r][c];
      }
      return -1;
    };
    const segOf = (b) => (b.onGround ? segAtX(H - Math.round(b.y), b.x, b.w) : -1);

    // fly one move and see where it lands
    function fly(x0, y0, act, dir) {
      const b = { x: x0, y: y0, w: TUNE.pw, h: TUNE.ph, vx: 0, vy: 0, onGround: true, dropT: 0 };
      if (act === 'jump') b.vy = TUNE.jump;
      if (act === 'drop') { b.dropT = 0.22; b.y -= 0.02; }
      let left = false;
      for (let i = 1; i < 360; i++) {
        b.vx = dir * TUNE.run;
        moveBody(f, b, DT);
        if (!b.onGround) left = true;
        if (left && b.onGround) return { seg: segOf(b), x: b.x, t: i * DT };
        if (!left && i > 60) return null;
      }
      return null;
    }

    for (const s of segs) {
      const oneWay = (c) => f.tile(c, s.r) === '=';
      const tries = [];
      for (let c = s.c0; c <= s.c1; c++) {
        for (const dir of [-1, 0, 1]) tries.push([c + 0.5, 'jump', dir]);
        if (oneWay(c)) for (const dir of [-1, 0, 1]) tries.push([c + 0.5, 'drop', dir]);
      }
      tries.push([s.c0 + 0.5, 'walk', -1], [s.c1 + 0.5, 'walk', 1]);
      for (const [x, act, dir] of tries) {
        const a = fly(x, s.y, act, dir);
        if (!a || a.seg < 0 || a.seg === s.id) continue;
        // robust: a little to either side must land on the same segment (the bots never stand exactly on the spot)
        const lo = fly(x - 0.12, s.y, act, dir), hi = fly(x + 0.12, s.y, act, dir);
        if (act !== 'walk' && (!lo || !hi || lo.seg !== a.seg || hi.seg !== a.seg)) continue;
        s.edges.push({ from: s.id, to: a.seg, x, act, dir, landX: a.x, t: a.t });
      }
    }

    // rough all-pairs cost (seconds), for picking the nearest target
    const n = segs.length;
    const cost = [];
    for (let i = 0; i < n; i++) { cost.push(new Array(n).fill(Infinity)); cost[i][i] = 0; }
    for (const s of segs) for (const e of s.edges) cost[s.id][e.to] = Math.min(cost[s.id][e.to], e.t + 0.6);
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (cost[i][k] + cost[k][j] < cost[i][j]) cost[i][j] = cost[i][k] + cost[k][j];
    }

    // best first move from (seg, x) toward a goal segment (Dijkstra over segments)
    function route(from, x, goal) {
      if (from === goal) return null;
      const best = new Array(n).fill(Infinity), pos = new Array(n).fill(0), first = new Array(n).fill(null), done = new Array(n).fill(false);
      best[from] = 0; pos[from] = x;
      for (;;) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
        if (u < 0 || u === goal) break;
        done[u] = true;
        for (const e of segs[u].edges) {
          const c = best[u] + Math.abs(pos[u] - e.x) / TUNE.run + e.t + 0.15;
          if (c < best[e.to]) { best[e.to] = c; pos[e.to] = e.landX; first[e.to] = u === from ? e : first[u]; }
        }
      }
      return first[goal];
    }

    const reach = (start) => {
      const seen = new Set([start]), q = [start];
      while (q.length) for (const e of segs[q.shift()].edges) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
      return seen;
    };
    const inSeg = (id, x, w = TUNE.pw) => { const s = segs[id]; return x - w / 2 >= s.c0 - 0.05 && x + w / 2 <= s.c1 + 1.05; };
    const clampSeg = (id, x, w = TUNE.pw) => { const s = segs[id]; return clamp(x, s.c0 + w / 2 + 0.02, s.c1 + 1 - w / 2 - 0.02); };
    const segCost = (a, ax, b, bx) => (a < 0 || b < 0 ? Infinity : a === b ? Math.abs(ax - bx) / TUNE.run : cost[a][b] + 1);
    let top = 0;
    for (const s of segs) if (s.y > segs[top].y || (s.y === segs[top].y && s.c1 - s.c0 > segs[top].c1 - segs[top].c0)) top = s.id;
    return { segs, segAt, segAtX, segOf, route, reach, inSeg, clampSeg, cost: segCost, top, fly };
  }

  // ---- a little seeded randomness, so the floor check is repeatable ----
  function Rand(seed) {
    const r = mulberry32(seed);
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  }

  // ---- the world: one floor being played ----
  class World {
    // opts: { floors, floor (1-based), mode: 'normal' | 'easy', players: [{ id, human }], seed, god }
    constructor(opts) {
      this.floors = opts.floors || ST.FLOORS;
      this.mode = opts.mode === 'easy' ? 'easy' : 'normal';
      this.M = MODES[this.mode];
      this.rng = Rand(opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed);
      this.god = !!opts.god;
      this.events = [];
      this.nextId = 1;
      this.t = 0;
      this.players = (opts.players || [{ id: 'teddy' }]).map((o, slot) => this.newPlayer(o.id, slot));
      this.twoP = this.players.length > 1;
      this.hi5Cd = 0;
      this.buddy = null;
      this.loadFloor(opts.floor || 1);
    }

    ev(e) { this.events.push(e); }
    newId() { return this.nextId++; }

    newPlayer(id, slot) {
      return {
        kind: 'player', id, slot, uid: this.newId(), companion: false,
        x: 0, y: 0, w: TUNE.pw, h: TUNE.ph, vx: 0, vy: 0, onGround: false, dropT: 0, face: 1,
        lives: this.M.lives, score: 0, nextLife: TUNE.extraLife,
        state: 'play', t: 0, inv: 0, shotCd: 0, anim: '', animT: 0,
        powers: {}, burstT: 0, balloonT: 0, shield: false, cheer: 'wave',
        input: { mx: 0, down: false, jump: false, throw: false }, prevJump: false, prevThrow: false,
        bot: null,
      };
    }

    loadFloor(n) {
      const count = this.floors.length;
      this.floorN = clamp(n, 1, count);
      this.def = this.floors[this.floorN - 1];
      this.f = parseFloor(this.def, this.floorN - 1);
      this.nav = navFor(this.f);
      this.enemies = [];
      this.shots = [];
      this.items = [];
      this.ghost = null;
      this.hurried = false;
      this.time = 0;
      this.phase = 'intro';
      this.phaseT = 0;
      this.defeated = 0;
      this.combos = 0;
      this.potionsLeft = this.def.potions == null ? 1 + (this.floorN > 3 ? 1 : 0) : this.def.potions;
      this.nextPotionAt = this.rng.int(1, 3);
      this.speedUp = 1 + (this.floorN - 1) * 0.012;
      if (this.buddy) this.buddy = null;
      const sp = this.f.spawns;
      this.players.forEach((p, i) => {
        const s = sp.players[i] || sp.players[0] || { x: 3.5, y: 1 };
        Object.assign(p, { x: s.x, y: s.y, vx: 0, vy: 0, onGround: false, dropT: 0, face: s.x < TUNE.W / 2 ? 1 : -1, t: 0, inv: 0, anim: '', animT: 0, balloonT: 0, shield: false, burstT: 0 });
        if (p.state === 'out') p.lives = this.M.lives;
        p.state = 'play';
        p.cheer = this.cheerFor(p);
      });
      for (const s of sp.enemies) this.addEnemy(s.type, s.x, s.y, { state: 'spawn', t: 0.4 + this.rng() * 0.6 });
      this.boss = null;
      if (this.def.boss && sp.boss) this.addBoss(this.def.boss, sp.boss);
      this.ev({ t: 'floor', n: this.floorN, name: this.def.name, boss: this.boss && this.boss.name });
    }

    cheerFor(p) {
      if (p.id === 'teddy') return this.floorN % 2 ? 'boxing' : 'jumpshot';
      if (p.id === 'tommy') return 'peace';
      return 'wave';
    }

    addEnemy(type, x, y, o = {}) {
      const k = KINDS[type];
      const e = {
        kind: 'enemy', type, uid: this.newId(), x, y, w: k.w, h: k.h, vx: 0, vy: 0, onGround: false, dropT: 0,
        face: this.rng() < 0.5 ? -1 : 1, state: 'walk', t: 0, snow: 0, snowT: 0, meltT: 0, ballT: 0,
        hopT: this.rng.range(k.hop[0], k.hop[1]) * 0.6, thinkT: this.rng.range(1, 3), edgeDecided: false, edgeTurn: false,
        dir: 1, bounces: 0, rollT: 0, combo: null, minion: false,
      };
      Object.assign(e, o);
      this.enemies.push(e);
      return e;
    }

    addBoss(type, s) {
      const D = BOSSES[type];
      const f = this.f;
      // the boss walks the bottom floor, keeping 2 tiles away from each wall so there's a safe corner to stand in
      const r = s.r + 1;
      let c0 = s.c, c1 = s.c;
      while (f.standable(c0 - 1, r)) c0--;
      while (f.standable(c1 + 1, r)) c1++;
      this.boss = {
        kind: 'boss', type, name: D.name, uid: this.newId(), x: s.x, y: TUNE.H + 2, groundY: s.y, w: D.w, h: D.h, vx: 0, vy: 0,
        hp: Math.max(3, D.hp + this.M.bossHp), maxHp: 0, face: -1, state: 'intro', t: 0, inv: 0,
        xmin: c0 + 2 + D.w / 2, xmax: c1 + 1 - 2 - D.w / 2, hopT: 3, spawnT: 2.5, gone: false,
      };
      this.boss.maxHp = this.boss.hp;
    }

    // ---- controls from outside ----
    // Call the other brother (1P), or high-five (2P). Returns what happened.
    callBuddy() {
      if (this.twoP) return this.highFive();
      const main = this.players[0];
      if (main.state === 'out' || this.phase === 'celebrate' || this.phase === 'done' || this.phase === 'over') return null;
      let b = this.buddy;
      if (b && (b.cstate === 'bye' || b.cstate === 'leave')) {
        b.cstate = 'enter'; b.vy = 0; b.ghostFall = true; b.visitT = TUNE.visit; b.treats++;
        main.shield = true;
        this.ev({ t: 'buddyCall', again: true, id: b.id });
        return 'back';
      }
      if (b) {
        b.visitT = TUNE.visit;
        b.treats++;
        main.shield = true;
        this.ev({ t: 'buddyCall', again: true, id: b.id });
        return 'again';
      }
      const id = main.id === 'tommy' ? 'teddy' : 'tommy';
      b = this.newPlayer(id, -1);
      b.companion = true;
      b.cstate = 'enter';
      b.ghostFall = true;
      b.visitT = TUNE.visit;
      b.treats = 1;
      b.treatCd = 0;
      let x = clamp(main.x - main.face * 1.1, 1.6, TUNE.W - 1.6);
      const r = rowOfY(main.y + 0.5);
      if (this.f.solid(Math.floor(x), r) || this.f.solid(Math.floor(x), r - 1)) x = main.x;
      Object.assign(b, { x, y: TUNE.H + 1.5, vy: 0, face: main.x >= x ? 1 : -1, cheer: this.cheerFor(b) });
      b.bot = new Bot(this, b);
      this.buddy = b;
      main.shield = true;
      this.ev({ t: 'buddyCall', id });
      return 'called';
    }

    highFive() {
      if (!this.twoP || this.hi5Cd > 0) return null;
      if (!(this.phase === 'play' || this.phase === 'intro' || this.phase === 'clear')) return null;
      this.hi5Cd = this.M.hi5Cd;
      for (const p of this.players) {
        if (p.state === 'out') { p.lives = this.M.lives; p.y = Math.max(p.y, 1); this.ev({ t: 'rejoin', p }); }
        if (p.state === 'balloon') continue;
        p.state = 'hi5'; p.t = 0.9; p.vx = 0;
        p.inv = Math.max(p.inv, 1.4);
        p.burstT = TUNE.burst;
      }
      this.ev({ t: 'highfive' });
      return 'highfive';
    }

    continueGame() {
      if (this.phase !== 'over') return;
      for (const p of this.players) if (p.state === 'out') { p.state = 'play'; p.lives = this.M.lives; p.inv = 3; p.vy = 4; }
      this.phase = 'play';
      this.ev({ t: 'continue' });
    }

    // ---- the step ----
    step(dt) {
      // fixed 60 Hz sub-steps so the physics (and the nav edges) always match
      this.acc = (this.acc || 0) + Math.min(dt, 0.25);
      while (this.acc >= DT) { this.acc -= DT; this.tick(DT); }
    }

    tick(dt) {
      this.t += dt;
      this.phaseT += dt;
      if (this.phase === 'over') return;
      if (this.hi5Cd > 0) this.hi5Cd = Math.max(0, this.hi5Cd - dt);
      if (this.phase === 'intro' && this.phaseT > (this.boss ? TUNE.bossIntro : TUNE.intro)) { this.phase = 'play'; this.phaseT = 0; this.ev({ t: 'go' }); }
      if (this.phase === 'play') this.time += dt;

      for (const p of this.players) {
        if (p.bot) p.bot.step(dt);
        this.updatePlayer(p, dt);
      }
      this.updateBuddy(dt);
      this.updateShots(dt);
      for (let i = this.enemies.length - 1; i >= 0; i--) this.updateEnemy(this.enemies[i], dt);
      this.enemies = this.enemies.filter((e) => !e.dead);
      if (this.boss) this.updateBoss(dt);
      this.updateItems(dt);
      this.updateGhost(dt);
      this.contacts();

      if (this.phase === 'play' && this.enemies.length === 0 && (!this.boss || this.boss.gone)) {
        this.phase = 'clear'; this.phaseT = 0;
        this.ev({ t: 'clear', n: this.floorN });
      } else if (this.phase === 'clear' && this.phaseT > TUNE.clearWait) {
        this.phase = 'celebrate'; this.phaseT = 0;
        for (const p of this.players) {
          if (p.state === 'out') continue;
          p.state = 'cheer'; p.vx = 0; p.balloonT = 0;
        }
        if (this.buddy && this.buddy.cstate === 'play') { this.buddy.state = 'cheer'; }
        for (const it of this.items) { this.collect(this.nearestPlayer(it.x, it.y) || this.players[0], it); }
        this.items = [];
        this.ev({ t: 'celebrate', n: this.floorN });
      } else if (this.phase === 'celebrate' && this.phaseT > TUNE.celebrate) {
        this.phase = 'done'; this.phaseT = 0;
        this.ev({ t: 'floorDone', n: this.floorN, last: this.floorN >= this.floors.length });
      }
    }

    speedOf(p) { return p.powers.speed || p.burstT > 0 ? TUNE.fastRun : TUNE.run; }
    shotRange(p) { return p.powers.long || p.burstT > 0 ? TUNE.longRange : TUNE.shotRange; }

    onLedge(b) {
      const r = TUNE.H - Math.round(b.y);
      const c0 = Math.floor(b.x - b.w / 2 + 0.03), c1 = Math.floor(b.x + b.w / 2 - 0.03);
      let ledge = false;
      for (let c = c0; c <= c1; c++) {
        const t = this.f.tile(c, r);
        if (t === '#') return false;
        if (t === '=') ledge = true;
      }
      return ledge;
    }

    updatePlayer(p, dt) {
      const inp = p.input;
      const jumpPressed = inp.jump && !p.prevJump, throwPressed = inp.throw && !p.prevThrow;
      p.prevJump = inp.jump; p.prevThrow = inp.throw;
      p.inv = Math.max(0, p.inv - dt);
      p.shotCd = Math.max(0, p.shotCd - dt);
      p.animT = Math.max(0, p.animT - dt);
      if (p.burstT > 0) p.burstT = Math.max(0, p.burstT - dt);
      if (p.companion && p.cstate !== 'play') return; // the companion's entrance and exit are scripted
      const f = this.f;
      switch (p.state) {
        case 'out':
          if (throwPressed && this.twoP && this.phase !== 'celebrate' && this.phase !== 'done') {
            const other = this.players.find((o) => o !== p && o.state !== 'out');
            p.state = 'play'; p.lives = this.M.lives; p.inv = 3; p.vx = 0; p.vy = 0;
            if (other) { p.x = other.x; p.y = other.y + 2; }
            this.ev({ t: 'rejoin', p });
          }
          return;
        case 'dizzy':
          p.vx = 0;
          moveBody(f, p, dt);
          p.t -= dt;
          if (p.t <= 0) this.recover(p);
          return;
        case 'tickle': case 'hi5': case 'cheer':
          p.vx = 0;
          moveBody(f, p, dt);
          if (p.state !== 'cheer') { p.t -= dt; if (p.t <= 0) p.state = 'play'; }
          return;
        case 'balloon':
          this.updateBalloon(p, dt);
          return;
      }
      // playing
      const mx = clamp(inp.mx || 0, -1, 1);
      p.vx = mx * this.speedOf(p);
      if (mx > 1e-4) p.face = 1;
      else if (mx < -1e-4) p.face = -1;
      if (p.onGround && jumpPressed) {
        if (inp.down && this.onLedge(p)) { p.dropT = 0.22; p.y -= 0.02; this.ev({ t: 'drop', p }); }
        else { p.vy = TUNE.jump; this.ev({ t: 'jump', p }); }
      }
      this.ballBlock(p, dt);
      const was = p.onGround;
      moveBody(f, p, dt);
      if (!was && p.onGround) this.ev({ t: 'land', p });
      if (p.y < -2) { p.y = 1; p.vy = 0; } // never lost below the floor
      if (throwPressed && this.phase !== 'celebrate') this.throwOrKick(p);
    }

    // stationary snowballs block a brother at their own height; walking into one pushes it, and pushing it off a
    // ledge sends it rolling
    ballBlock(p, dt) {
      for (const e of this.enemies) {
        if (e.state !== 'ball' || Math.abs(e.y - p.y) > 0.7) continue;
        const dx = e.x - p.x, minD = (e.w + p.w) / 2;
        const nx = p.x + p.vx * dt;
        if (Math.abs(e.x - nx) >= minD) continue;
        if (p.vx !== 0 && Math.sign(p.vx) === Math.sign(dx)) {
          const v = Math.sign(p.vx) * Math.min(Math.abs(p.vx), TUNE.push);
          p.vx = v;
          e.vx = v;
          const before = e.x;
          moveBody(this.f, e, dt);
          e.vx = 0;
          p.anim = 'push'; p.animT = 0.15;
          if (!e.onGround && e.state === 'ball') this.kick(e, p, Math.sign(v), true);
          else if (Math.abs(e.x - before) < 1e-4) p.vx = 0;
          // keep the brother just behind the ball
          const lim = e.x - Math.sign(dx) * (minD - 0.0005);
          if (Math.sign(dx) > 0 && p.x + p.vx * dt > lim) p.vx = (lim - p.x) / dt;
          if (Math.sign(dx) < 0 && p.x + p.vx * dt < lim) p.vx = (lim - p.x) / dt;
        } else if (Math.abs(dx) < minD - 0.05) {
          // overlapping (landed on it from above): slide off to the near side
          p.x = e.x - (dx >= 0 ? 1 : -1) * minD;
          unstick(this.f, p);
        }
      }
    }

    ballInReach(p) {
      let best = null, bd = Infinity;
      for (const e of this.enemies) {
        if (e.state !== 'ball' || Math.abs(e.y - p.y) > 0.6) continue;
        const d = (e.x - p.x) * p.face;
        if (d > 0 && d < e.w / 2 + p.w / 2 + 0.45 && d < bd) { best = e; bd = d; }
      }
      return best;
    }

    throwOrKick(p) {
      const ball = this.ballInReach(p);
      if (ball) {
        this.kick(ball, p, p.face);
        p.anim = 'kick'; p.animT = TUNE.kickAnim;
        return;
      }
      if (p.shotCd > 0) return;
      p.shotCd = TUNE.throwCd;
      p.anim = 'throw'; p.animT = TUNE.throwAnim;
      const big = !!(p.powers.big || p.burstT > 0), long = !!(p.powers.long || p.burstT > 0);
      const s = {
        kind: 'shot', uid: this.newId(), owner: p, style: p.id, x: p.x + p.face * 0.45, y: p.y + 1.05,
        vx: p.face * (long ? TUNE.longSpeed : TUNE.shotSpeed), range: long ? TUNE.longRange : TUNE.shotRange, dist: 0,
        r: big ? 0.42 : 0.28, power: big ? 2 : 1, big, t: 0,
      };
      this.shots.push(s);
      this.ev({ t: 'throw', p, shot: s });
    }

    kick(e, p, dir, pushed) {
      e.state = 'rolling';
      e.dir = dir || 1;
      e.vx = e.dir * TUNE.roll;
      e.rollT = 0;
      e.bounces = 0;
      e.combo = { n: 0, owner: p, id: this.newId() };
      this.ev({ t: 'kick', p, e, pushed: !!pushed });
    }

    updateBalloon(p, dt) {
      const inp = p.input;
      p.balloonT -= dt;
      const mx = clamp(inp.mx || 0, -1, 1);
      if (mx > 1e-4) p.face = 1; else if (mx < -1e-4) p.face = -1;
      p.vx = mx * 4.6;
      const want = inp.jump ? 4.2 : inp.down ? -4 : -0.9;
      p.vy += (want - p.vy) * Math.min(1, dt * 4);
      // fly through ledges, bounce off walls and the ceiling of the screen
      p.x += p.vx * dt;
      unstick(this.f, p);
      p.x = clamp(p.x, 1 + p.w / 2, TUNE.W - 1 - p.w / 2);
      p.y = clamp(p.y + p.vy * dt, 1, TUNE.H - p.h - 0.2);
      p.onGround = p.y <= 1.0001;
      // bowl over everyone it touches
      for (const e of this.enemies) {
        if (!overlap(p, e, 0.1)) continue;
        if (this.active(e)) {
          if (!p.balloonCombo) p.balloonCombo = { n: 0, owner: p, id: this.newId() };
          this.ko(e, p.balloonCombo, Math.sign(e.x - p.x) || p.face);
        } else if (e.state === 'ball') this.kick(e, p, Math.sign(e.x - p.x) || p.face);
      }
      if (p.balloonT <= 0) {
        p.state = 'play'; p.inv = Math.max(p.inv, 1.2); p.vy = 2; p.balloonCombo = null;
        this.ev({ t: 'balloonPop', p });
      }
    }

    recover(p) {
      if (p.lives > 0) {
        p.state = 'play';
        p.inv = TUNE.safeAfter;
        this.ev({ t: 'recover', p });
        return;
      }
      p.state = 'out';
      this.ev({ t: 'out', p });
      if (this.players.every((o) => o.state === 'out')) {
        this.phase = 'over';
        this.ev({ t: 'gameOver' });
      }
    }

    credit(owner, pts) {
      let p = owner;
      if (!p) return;
      if (p.companion) p = this.players[0];
      p.score += pts;
      while (p.score >= p.nextLife) {
        p.nextLife += TUNE.extraLife;
        if (p.lives < 9) { p.lives++; this.ev({ t: 'oneUp', p }); }
      }
    }

    active(e) { return e.state === 'walk' || e.state === 'stun' || e.state === 'spawn' || e.state === 'fly'; }
    harmful(e) { return e.state === 'walk' && e.snow < 2; }

    // ---- snow ----
    updateShots(dt) {
      const f = this.f;
      for (const s of this.shots) {
        s.t += dt;
        s.x += s.vx * dt;
        s.dist += Math.abs(s.vx) * dt;
        if (s.dist > s.range) { s.dead = true; this.ev({ t: 'fizzle', x: s.x, y: s.y, s }); continue; }
        if (f.solid(Math.floor(s.x + Math.sign(s.vx) * s.r * 0.6), rowOfY(s.y))) { s.dead = true; this.ev({ t: 'poof', x: s.x, y: s.y, s }); continue; }
        const box = { x: s.x, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
        for (const e of this.enemies) {
          if (!overlap(box, e)) continue;
          if (e.state === 'walk' || e.state === 'stun') { this.snowEnemy(e, s); s.dead = true; break; }
          if (e.state === 'ball') { s.dead = true; this.ev({ t: 'poof', x: s.x, y: s.y, s }); break; }
        }
        if (s.dead) continue;
        const B = this.boss;
        if (B && !B.gone && B.state !== 'intro' && overlap(box, B, 0.2)) { s.dead = true; this.ev({ t: 'poof', x: s.x, y: s.y, s, boss: true }); continue; }
        const G = this.ghost;
        if (G && Math.hypot(G.x - s.x, G.y + 0.8 - s.y) < 1.0) { s.dead = true; G.scared = 1.6; this.ev({ t: 'poof', x: s.x, y: s.y, s, ghost: true }); }
      }
      this.shots = this.shots.filter((s) => !s.dead);
    }

    snowEnemy(e, s) {
      e.snow = Math.min(TUNE.snowMax, e.snow + s.power);
      e.snowT = 0;
      e.meltT = 0;
      this.credit(s.owner, 10);
      this.ev({ t: 'snowHit', e, x: s.x, y: s.y, level: e.snow, s });
      if (e.snow >= TUNE.snowMax) this.encase(e, s.owner);
    }

    encase(e, owner) {
      e.state = 'ball';
      e.ballT = 0;
      e.vx = 0;
      e.w = e.h = TUNE.ballSize;
      unstick(this.f, e);
      this.credit(owner, 50);
      this.ev({ t: 'encase', e });
    }

    // ---- baddies ----
    updateEnemy(e, dt) {
      const f = this.f, k = KINDS[e.type];
      e.t += dt;
      switch (e.state) {
        case 'spawn':
          e.vx = 0;
          moveBody(f, e, dt);
          if (this.phase !== 'intro' || e.t > 99) { e.state = 'walk'; e.t = 0; }
          return;
        case 'fly': {
          // a minion thrown by the boss, flying a fixed arc to its landing spot
          const u = Math.min(1, e.t / e.flyT);
          e.x = e.fx0 + (e.fx1 - e.fx0) * u;
          e.y = e.fy0 + (e.fy1 - e.fy0) * u + e.flyH * 4 * u * (1 - u);
          if (u >= 1) { e.state = 'walk'; e.onGround = true; e.vy = 0; this.ev({ t: 'land', e }); }
          return;
        }
        case 'bonked':
          // knocked out: tumbles away in an arc, then pops into a treat
          e.x += e.vx * dt;
          e.vy -= TUNE.gravity * 0.8 * dt;
          e.y += e.vy * dt;
          if (e.x < 1.4 || e.x > TUNE.W - 1.4) { e.vx = -e.vx; e.x = clamp(e.x, 1.4, TUNE.W - 1.4); }
          if (e.t > 0.9 && (e.vy < 0 || e.t > 2)) { e.dead = true; this.drop(e.x, Math.max(1, Math.min(e.y, TUNE.H - 2))); this.ev({ t: 'pop', e }); }
          return;
        case 'ball': {
          e.ballT += dt;
          e.vx = 0;
          moveBody(f, e, dt);
          if (e.ballT > this.M.ballTime + 1.8) {
            // shook itself free
            e.state = 'walk'; e.snow = 0; e.w = k.w; e.h = k.h; e.vy = 8; e.t = 0;
            unstick(f, e);
            this.ev({ t: 'breakFree', e });
          }
          return;
        }
        case 'rolling':
          this.updateRolling(e, dt);
          return;
        case 'stun':
          e.vx *= Math.pow(0.02, dt);
          moveBody(f, e, dt);
          if (e.t > 1.2) { e.state = 'walk'; e.t = 0; }
          this.melt(e, dt);
          return;
      }
      // walking
      this.melt(e, dt);
      const sf = SNOW_SPEED[e.snow];
      const sp = k.speed * this.M.enemySpeed * this.speedUp * sf * (this.ghost ? 1.3 : 1);
      if (e.onGround && sf > 0) {
        const r = TUNE.H - Math.round(e.y);
        const ahead = Math.floor(e.x + e.face * (e.w / 2 + 0.08));
        if (!f.standable(ahead, r)) {
          if (!e.edgeDecided) { e.edgeDecided = true; e.edgeTurn = this.rng() < k.edgeTurn; }
          if (e.edgeTurn) { e.face = -e.face; e.edgeDecided = false; }
        } else e.edgeDecided = false;
        e.hopT -= dt;
        if (e.hopT <= 0 && e.snow === 0) {
          e.hopT = this.rng.range(k.hop[0], k.hop[1]);
          const c = Math.floor(e.x);
          if (f.standable(c, r - 3) && f.tile(c, r - 3) === '=' && !f.solid(c, r - 1) && !f.solid(c, r - 2)) {
            e.vy = TUNE.jump; e.hopUp = true; this.ev({ t: 'hop', e });
          } else if (k.smallHop) e.vy = 7.5;
        }
        e.thinkT -= dt;
        if (e.thinkT <= 0) {
          e.thinkT = this.rng.range(2, 4);
          const p = this.nearestPlayer(e.x, e.y, 0.6);
          if (p && this.rng() < this.M.chase) e.face = p.x > e.x ? 1 : -1;
        }
      }
      e.vx = e.hopUp && !e.onGround ? 0 : e.face * sp;
      const wall = moveBody(f, e, dt);
      if (e.onGround) e.hopUp = false;
      if (wall) e.face = -wall;
      if (e.y < -2) { e.y = 1; e.vy = 0; }
    }

    melt(e, dt) {
      if (e.snow <= 0) return;
      e.snowT += dt;
      if (e.snowT < this.M.snowHold) return;
      if (e.meltT === 0) this.ev({ t: 'shake', e });
      e.meltT += dt;
      if (e.meltT >= this.M.snowMelt) { e.snow--; e.meltT = 0.0001; if (e.snow === 0) { e.meltT = 0; this.ev({ t: 'free', e }); } }
    }

    updateRolling(e, dt) {
      e.rollT += dt;
      e.vx = e.dir * TUNE.roll;
      const was = e.onGround;
      const wall = moveBody(this.f, e, dt);
      if (!was && e.onGround && e.rollT > 0.1) this.ev({ t: 'ballLand', e });
      if (wall) {
        e.dir = -wall;
        e.bounces++;
        this.ev({ t: 'bounce', e });
        if (e.bounces >= TUNE.ballBounces) return this.shatter(e);
      }
      if (e.rollT > TUNE.rollTime || e.y < -2) return this.shatter(e);
      for (const o of this.enemies) {
        if (o === e || o.dead || !overlap(e, o, 0.1)) continue;
        if (this.active(o)) this.ko(o, e.combo, e.dir);
        else if (o.state === 'ball') {
          this.kick(o, e.combo.owner, e.dir);
          o.combo = e.combo;
          this.comboHit(e.combo, o, 'chain');
        }
      }
      const B = this.boss;
      if (B && !B.gone && B.state !== 'down' && B.state !== 'intro' && B.inv <= 0 && overlap(e, B, 0.2)) this.hitBoss(e);
    }

    comboHit(combo, o, how) {
      combo.n++;
      const pts = Math.min(200 * Math.pow(2, combo.n - 1), 12800);
      this.credit(combo.owner, pts);
      this.ev({ t: 'ko', e: o, x: o.x, y: o.y + o.h / 2, n: combo.n, pts, how, owner: combo.owner });
      if (combo.n >= 2) {
        this.combos++;
        const extra = combo.n >= 4 ? 4 : 0;
        for (let i = 0; i < combo.n - 1 + extra; i++) this.rainTreat();
        this.ev({ t: 'combo', n: combo.n, super: combo.n === 4, x: o.x, y: o.y + 1, owner: combo.owner });
      }
    }

    ko(o, combo, dir) {
      if (o.state === 'bonked' || o.dead) return;
      o.state = 'bonked';
      o.t = 0;
      o.vx = (dir || 1) * this.rng.range(2.5, 4.5);
      o.vy = this.rng.range(9, 12);
      this.comboHit(combo, o, 'bonk');
    }

    shatter(e) {
      e.dead = true;
      this.credit(e.combo && e.combo.owner, 100);
      this.ev({ t: 'shatter', e, x: e.x, y: e.y + e.h / 2, n: e.combo ? e.combo.n : 0 });
      this.drop(e.x, Math.max(1, e.y));
    }

    drop(x, y) {
      this.defeated++;
      x = clamp(x, 1.5, TUNE.W - 1.5);
      if (this.potionsLeft > 0 && this.defeated >= this.nextPotionAt) {
        this.potionsLeft--;
        this.nextPotionAt = this.defeated + this.rng.int(2, 4);
        const r = this.rng();
        const potion = r < 0.32 ? 'speed' : r < 0.6 ? 'big' : r < 0.86 ? 'long' : 'balloon';
        this.addItem({ what: 'potion', potion, x, y });
      } else {
        const [emoji, pts] = this.rng.pick(TREATS);
        this.addItem({ what: 'treat', emoji, pts, x, y });
      }
    }

    rainTreat() {
      const [emoji, pts] = this.rng.pick(TREATS.slice(0, 3));
      this.addItem({ what: 'treat', emoji, pts, x: this.rng.range(2, TUNE.W - 2), y: TUNE.H + this.rng.range(0, 3), rain: true });
    }

    addItem(o) {
      const it = Object.assign({ kind: 'item', uid: this.newId(), w: 0.7, h: 0.7, vx: 0, vy: o.rain ? 0 : 5, onGround: false, dropT: 0, t: 0, life: o.what === 'potion' ? 14 : 10 }, o);
      unstick(this.f, it);
      this.items.push(it);
      this.ev({ t: 'item', it });
      return it;
    }

    updateItems(dt) {
      for (const it of this.items) {
        it.t += dt;
        it.vx = 0;
        if (it.rain && it.y > TUNE.H - 1) { it.y -= 6 * dt; } else moveBody(this.f, it, dt);
        if (it.y < 0.5) it.y = 1;
        if (it.t > it.life) { it.dead = true; continue; }
        for (const p of this.players) {
          if (p.state === 'out' || p.state === 'dizzy' || !overlap(p, it, -0.1)) continue;
          this.collect(p, it);
          break;
        }
      }
      this.items = this.items.filter((i) => !i.dead);
    }

    collect(p, it) {
      it.dead = true;
      if (it.what === 'potion') {
        if (it.potion === 'balloon') {
          if (p.state === 'play' || p.state === 'balloon') { p.state = 'balloon'; p.balloonT = TUNE.balloon; p.vy = 2; }
        } else p.powers[it.potion] = true;
        this.credit(p, 500);
        this.ev({ t: 'potion', p, potion: it.potion, label: POTIONS[it.potion].label, x: it.x, y: it.y });
      } else {
        this.credit(p, it.pts);
        this.ev({ t: 'pickup', p, emoji: it.emoji, pts: it.pts, x: it.x, y: it.y });
      }
    }

    nearestPlayer(x, y, maxDy) {
      let best = null, bd = Infinity;
      for (const p of this.players) {
        if (p.state === 'out') continue;
        if (maxDy != null && Math.abs(p.y - y) > maxDy) continue;
        const d = Math.hypot(p.x - x, (p.y - y) * 1.5);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    // ---- the boss ----
    updateBoss(dt) {
      const B = this.boss, D = BOSSES[B.type];
      if (B.gone) return;
      B.t += dt;
      B.inv = Math.max(0, B.inv - dt);
      const gravity = () => {
        B.vy -= TUNE.gravity * dt;
        B.y += B.vy * dt;
        if (B.y <= B.groundY) {
          if (B.vy < -4) this.ev({ t: 'thump', boss: B });
          B.y = B.groundY; B.vy = 0; return true;
        }
        return false;
      };
      switch (B.state) {
        case 'intro':
          if (B.t > 0.6) { if (gravity()) { B.state = 'walk'; B.t = 0; } }
          return;
        case 'hurt':
          gravity();
          if (B.t > 0.8) { B.state = 'walk'; B.t = 0; }
          return;
        case 'down':
          gravity();
          if (B.t > 2.6) { B.gone = true; this.ev({ t: 'bossGone', boss: B }); }
          return;
      }
      if (this.phase !== 'play') { gravity(); return; }
      B.x += B.face * D.speed * this.M.enemySpeed * dt;
      if (B.x < B.xmin) { B.x = B.xmin; B.face = 1; }
      if (B.x > B.xmax) { B.x = B.xmax; B.face = -1; }
      const grounded = gravity();
      B.hopT -= dt;
      if (B.hopT <= 0 && grounded) { B.hopT = this.rng.range(D.hop[0], D.hop[1]); B.vy = D.hopV; this.ev({ t: 'bossHop', boss: B }); }
      B.spawnT -= dt;
      const minions = this.enemies.filter((e) => e.minion && e.state !== 'bonked').length;
      const max = Math.max(1, D.max - (this.mode === 'easy' ? 1 : 0));
      if (B.spawnT <= 0) {
        B.spawnT = D.every * this.M.minionEvery;
        if (minions < max) this.spawnMinion(B, D);
      }
      // nothing left to snow and no snowballs waiting: send one straight away
      if (minions === 0 && !this.enemies.some((e) => e.state === 'ball' || e.state === 'rolling') && B.spawnT > 1.2) B.spawnT = 1.2;
    }

    spawnMinion(B, D) {
      const nav = this.nav;
      const spots = [];
      for (const s of nav.segs) {
        if (s.y <= B.groundY + 0.5) continue; // the boss's own floor
        for (let c = s.c0; c <= s.c1; c++) {
          const x = c + 0.5;
          if (this.players.some((p) => p.state !== 'out' && Math.abs(p.x - x) < 2.5 && Math.abs(p.y - s.y) < 1)) continue;
          spots.push({ x, y: s.y });
        }
      }
      if (!spots.length) return;
      const to = this.rng.pick(spots);
      const type = this.rng.pick(D.minion);
      const fx0 = B.x, fy0 = B.y + B.h * 0.8;
      const e = this.addEnemy(type, fx0, fy0, { state: 'fly', t: 0, minion: true, fx0, fy0, fx1: to.x, fy1: to.y, flyT: 1.1, flyH: 2.5 + Math.max(0, to.y - fy0) * 0.3 });
      e.face = to.x > fx0 ? 1 : -1;
      this.ev({ t: 'bossSpawn', boss: B, e });
    }

    hitBoss(ball) {
      const B = this.boss;
      B.hp--;
      B.inv = 1.0;
      B.t = 0;
      this.credit(ball.combo && ball.combo.owner, 1000);
      ball.dead = true;
      this.ev({ t: 'bossHit', boss: B, x: ball.x, y: ball.y + 0.75, hp: B.hp });
      this.drop(ball.x, Math.max(1, ball.y));
      if (B.hp <= 0) {
        B.state = 'down';
        this.credit(ball.combo && ball.combo.owner, 5000);
        this.ev({ t: 'bossDown', boss: B });
        const combo = { n: 0, owner: ball.combo && ball.combo.owner, id: this.newId() };
        for (const e of this.enemies) if (!e.dead && e.state !== 'bonked') { if (e.state === 'ball' || e.state === 'rolling') this.shatter(e); else this.ko(e, combo, e.x > B.x ? 1 : -1); }
        for (let i = 0; i < 10; i++) this.rainTreat();
      } else B.state = 'hurt';
    }

    // ---- the "hurry up!" ghost-snowman: harmless, but he tickles, and the baddies get zippy ----
    updateGhost(dt) {
      if (this.boss || this.phase !== 'play') { if (this.ghost && this.phase !== 'play') this.ghost.leaving = true; }
      if (!this.boss && this.phase === 'play') {
        if (!this.hurried && this.time > this.M.hurry) { this.hurried = true; this.ev({ t: 'hurry' }); }
        if (!this.ghost && this.time > this.M.hurry + 3) {
          this.ghost = { x: TUNE.W / 2, y: TUNE.H + 1, vx: 0, vy: 0, scared: 0, t: 0, leaving: false };
          this.ev({ t: 'ghost' });
        }
      }
      const G = this.ghost;
      if (!G) return;
      G.t += dt;
      G.scared = Math.max(0, G.scared - dt);
      if (G.leaving) {
        G.y += 4 * dt;
        if (G.y > TUNE.H + 3) this.ghost = null;
        return;
      }
      const p = this.nearestPlayer(G.x, G.y);
      if (!p) return;
      const dx = p.x - G.x, dy = p.y + 0.4 - G.y, d = Math.hypot(dx, dy) || 1;
      const sp = (this.mode === 'easy' ? 1.1 : 1.5) * (G.scared > 0 ? -1.2 : 1);
      G.vx += ((dx / d) * sp - G.vx) * Math.min(1, dt * 2);
      G.vy += ((dy / d) * sp - G.vy) * Math.min(1, dt * 2);
      G.x = clamp(G.x + G.vx * dt, 1.5, TUNE.W - 1.5);
      G.y = clamp(G.y + G.vy * dt, 0.5, TUNE.H + 1);
      if (G.scared <= 0 && d < 0.9 && p.state === 'play' && p.inv <= 0 && !this.god) {
        p.state = 'tickle'; p.t = 1.0; p.vx = 0;
        G.scared = 2.2;
        this.ev({ t: 'tickle', p });
      }
    }

    // ---- baddies touching brothers ----
    contacts() {
      if (this.phase !== 'play' && this.phase !== 'intro') return;
      for (const p of this.players) {
        if (p.state !== 'play' || p.inv > 0 || this.god) continue;
        for (const e of this.enemies) {
          if (this.harmful(e) && overlap(p, e, 0.14)) { this.hurt(p, e); break; }
        }
        const B = this.boss;
        if (p.state === 'play' && p.inv <= 0 && B && !B.gone && B.state !== 'down' && B.state !== 'intro' && overlap(p, B, 0.3)) this.hurt(p, B);
      }
    }

    hurt(p, src) {
      const away = Math.sign(src.x - p.x) || 1;
      if (p.shield) {
        p.shield = false;
        p.inv = 1.4;
        if (src.kind === 'enemy') { src.state = 'stun'; src.t = 0; src.vx = away * 5; src.vy = 6; }
        else { p.vy = 12; p.vx = 0; }
        if (this.buddy) { this.buddy.anim = 'hello'; this.buddy.animT = 1.0; }
        this.ev({ t: 'saved', p, by: this.buddy ? this.buddy.id : (p.id === 'tommy' ? 'teddy' : 'tommy') });
        return;
      }
      p.lives--;
      p.state = 'dizzy';
      p.t = TUNE.dizzy;
      p.vx = 0;
      p.balloonT = 0;
      if (!this.M.keepPowers) p.powers = {};
      if (src.kind === 'enemy') { src.state = 'stun'; src.t = 0; src.vx = away * 3; src.vy = 4; }
      this.ev({ t: 'dizzy', p, lives: p.lives });
    }

    // ---- the companion: the other brother drops in for about 10 s ----
    updateBuddy(dt) {
      const b = this.buddy;
      if (!b) return;
      const main = this.players[0];
      b.t += dt;
      b.treatCd = Math.max(0, (b.treatCd || 0) - dt);
      switch (b.cstate) {
        case 'enter':
          if (b.ghostFall) {
            // float down next to his brother, following him if he runs off
            b.vy = Math.max(b.vy - TUNE.gravity * 0.6 * dt, -12);
            b.y += b.vy * dt;
            const tx = clamp(main.x - main.face * 1.1, 1.6, TUNE.W - 1.6);
            b.x += (tx - b.x) * Math.min(1, dt * 5);
            if (b.y <= Math.max(1, main.y + 0.4)) {
              b.ghostFall = false;
              const r = rowOfY(b.y + 0.5);
              if (this.f.solid(Math.floor(b.x), r) || this.f.solid(Math.floor(b.x), r - 1)) b.x = main.x;
              unstick(this.f, b);
            }
          } else {
            b.vx = 0;
            moveBody(this.f, b, dt);
            if (b.onGround) { b.cstate = 'hello'; b.t = 0; b.face = main.x >= b.x ? 1 : -1; this.ev({ t: 'buddyHello', b }); }
          }
          if (b.y < 0.5) { b.y = 1; b.vy = 0; }
          break;
        case 'hello':
          b.vx = 0;
          moveBody(this.f, b, dt);
          if (b.t > 1.1) { b.cstate = 'play'; b.t = 0; b.state = 'play'; }
          break;
        case 'play':
          b.visitT -= dt;
          if (this.phase === 'celebrate' || this.phase === 'done') { b.state = 'cheer'; b.vx = 0; moveBody(this.f, b, dt); break; }
          b.bot.step(dt);
          this.updatePlayer(b, dt);
          if (b.visitT <= 1.0 && b.onGround) { b.cstate = 'bye'; b.t = 0; b.state = 'play'; b.face = main.x >= b.x ? 1 : -1; this.ev({ t: 'buddyBye', b }); }
          break;
        case 'bye':
          b.vx = 0;
          moveBody(this.f, b, dt);
          if (b.t > 1.0) { b.cstate = 'leave'; b.t = 0; b.vy = 14; }
          break;
        case 'leave':
          b.vy = Math.max(b.vy - TUNE.gravity * 0.3 * dt, 6);
          b.y += b.vy * dt;
          if (b.y > TUNE.H + 3) {
            this.buddy = null;
            main.shield = false;
            this.ev({ t: 'buddyGone', id: b.id });
            return;
          }
          break;
      }
      if (b.treats > 0 && b.treatCd <= 0 && ((b.cstate === 'hello' && b.t > 0.45) || b.cstate === 'play') && main.state !== 'out') {
        b.treats--;
        b.treatCd = 0.9;
        const [emoji, name] = this.rng.pick(BUDDY_TREATS);
        this.credit(main, 300);
        b.anim = 'give'; b.animT = 0.6;
        this.ev({ t: 'treat', emoji, name, from: b, to: main, pts: 300 });
      }
    }

    // time left on the companion's visit, 0..1 (for the HUD bar)
    buddyLeft() {
      const b = this.buddy;
      if (!b || b.cstate === 'leave') return 0;
      return clamp(b.visitT / TUNE.visit, 0, 1);
    }
  }

  // ---- the autopilot: the companion's brain, the title-screen demo and the floor check's player ----
  class Bot {
    constructor(world, p) {
      this.w = world;
      this.p = p;
      this.edge = null;
      this.edgeT = 0;
      this.thinkT = 0;
      this.target = null;
      this.stuckT = 0;
      this.lastX = p.x;
      this.lastY = p.y;
      this.flip = false;
    }

    k() { return TUNE.run / this.w.speedOf(this.p); } // walk at normal speed, so the planned jumps still land

    step(dt) {
      const w = this.w, p = this.p, inp = p.input, nav = w.nav;
      this.flip = !this.flip;
      inp.mx = 0; inp.jump = false; inp.down = false; inp.throw = false;
      if (p.state === 'out') { inp.throw = this.flip; return; }
      if (p.state === 'balloon') {
        const e = this.nearestEnemy();
        if (e) { inp.mx = Math.sign(e.x - p.x); inp.jump = e.y > p.y + 0.3; inp.down = e.y < p.y - 0.6; }
        return;
      }
      if (p.state !== 'play') return;
      if (!p.onGround) {
        if (this.edge) inp.mx = this.edge.dir * this.k();
        return;
      }
      // walking off an edge: keep walking until we drop
      if (this.edge && this.edge.act === 'walk' && this.edgeT < 0.6) { this.edgeT += dt; inp.mx = this.edge.dir * this.k(); return; }
      this.edge = null;

      // stuck? (walking into something for a while) then think again from scratch
      if (Math.abs(p.x - this.lastX) + Math.abs(p.y - this.lastY) > 0.05) { this.stuckT = 0; this.lastX = p.x; this.lastY = p.y; }
      else this.stuckT += dt;
      if (this.stuckT > 2.5) { this.stuckT = 0; this.target = null; inp.jump = true; inp.mx = w.rng() < 0.5 ? -1 : 1; return; }

      this.thinkT -= dt;
      if (this.thinkT <= 0 || !this.valid(this.target)) { this.thinkT = 0.3; this.target = this.choose(); }
      const tg = this.target;
      const seg = nav.segOf(p);
      if (!tg || seg < 0) { if (seg < 0) inp.mx = p.face * this.k(); return; }

      // can we snow something from right here?
      if (this.tryThrow(inp)) return;

      if (tg.seg !== seg) {
        const e = nav.route(seg, p.x, tg.seg);
        if (!e) { this.target = null; this.thinkT = 0.5; return; }
        if (Math.abs(p.x - e.x) > 0.06) { inp.mx = this.toward(e.x); return; }
        this.edge = e;
        this.edgeT = 0;
        inp.mx = e.dir * this.k();
        if (e.act === 'jump') inp.jump = true;
        else if (e.act === 'drop') { inp.down = true; inp.jump = true; }
        return;
      }
      // on the target's platform
      const x = tg.kind === 'kick' ? tg.x : nav.clampSeg(seg, tg.x);
      if (Math.abs(p.x - x) > 0.08) { inp.mx = this.toward(x); return; }
      if (tg.kind === 'kick') {
        if (p.face !== tg.dir) { inp.mx = tg.dir * 0.001; return; }
        inp.throw = !p.prevThrow;
        return;
      }
      if (tg.kind === 'snow' && tg.ent) { const d = Math.sign(tg.ent.x - p.x); if (d && p.face !== d) inp.mx = d * 0.001; }
    }

    toward(x) {
      const p = this.p, d = x - p.x;
      return clamp(d / (TUNE.run * DT), -1, 1) * this.k();
    }

    // throw at a baddy in range at our height, with nothing solid in between
    tryThrow(inp) {
      const w = this.w, p = this.p;
      if (p.shotCd > 0) return false;
      const range = w.shotRange(p) - 0.3;
      let best = null, bd = Infinity;
      for (const e of w.enemies) {
        if (!(e.state === 'walk' || e.state === 'stun') || !e.onGround) continue;
        if (Math.abs(e.y - p.y) > 0.4) continue;
        const d = Math.abs(e.x - p.x);
        if (d > range || d < 0.3 || !this.clear(p.x, e.x, p.y + 1.05)) continue;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      const dir = Math.sign(best.x - p.x);
      if (p.face !== dir) { inp.mx = dir * 0.001; return true; }
      inp.throw = !p.prevThrow;
      return true;
    }

    clear(x0, x1, y) {
      const r = rowOfY(y), a = Math.floor(Math.min(x0, x1)), b = Math.floor(Math.max(x0, x1));
      for (let c = a; c <= b; c++) if (this.w.f.solid(c, r)) return false;
      return true;
    }

    nearestEnemy() {
      let best = null, bd = Infinity;
      for (const e of this.w.enemies) {
        if (!this.w.active(e) && e.state !== 'ball') continue;
        const d = Math.hypot(e.x - this.p.x, e.y - this.p.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    valid(tg) {
      if (!tg) return false;
      if (tg.kind === 'idle') return true;
      const e = tg.ent;
      if (!e || e.dead || this.w.enemies.indexOf(e) < 0) return false;
      if (tg.kind === 'kick') return e.state === 'ball';
      return e.state === 'walk' || e.state === 'stun' || e.state === 'spawn';
    }

    choose() {
      const w = this.w, p = this.p, nav = w.nav;
      const mySeg = nav.segOf(p);
      let best = null;
      const consider = (tg, cost) => { if (cost < Infinity && (!best || cost < best.cost)) { tg.cost = cost; best = tg; } };
      const range = w.shotRange(p) - 0.5;
      for (const e of w.enemies) {
        if (e.dead) continue;
        if (e.state === 'ball' && e.onGround) {
          const seg = nav.segAtX(TUNE.H - Math.round(e.y), e.x, 0.4);
          if (seg < 0) continue;
          for (const dir of p.x <= e.x ? [1, -1] : [-1, 1]) {
            const sx = e.x - dir * (e.w / 2 + p.w / 2 + 0.2);
            if (!nav.inSeg(seg, sx)) continue;
            consider({ kind: 'kick', ent: e, seg, x: sx, dir }, nav.cost(mySeg, p.x, seg, sx) - 2.5 - (e.ballT > 4 ? 2 : 0));
            break;
          }
        } else if ((e.state === 'walk' || e.state === 'stun' || e.state === 'spawn') && e.onGround) {
          const seg = nav.segOf(e);
          if (seg < 0) continue;
          for (const side of [-1, 1]) {
            const sx = nav.clampSeg(seg, e.x + side * Math.min(2.2, range));
            const d = Math.abs(sx - e.x);
            if (d > range || d < 0.5) continue;
            consider({ kind: 'snow', ent: e, seg, x: sx }, nav.cost(mySeg, p.x, seg, sx) - e.snow * 0.4);
          }
        }
      }
      if (!best) {
        const s = nav.segs[nav.top];
        if (s) best = { kind: 'idle', seg: s.id, x: (s.c0 + s.c1 + 1) / 2 + (p.companion ? 1 : p.slot === 1 ? 1.5 : -1.5), cost: 0 };
      }
      return best;
    }
  }

  Object.assign(ST, { TUNE, MODES, KINDS, BOSSES, TREATS, BUDDY_TREATS, POTIONS, World, Bot, parseFloor, navFor, moveBody, DT });
})(typeof window !== 'undefined' ? window : globalThis);
