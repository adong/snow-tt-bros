/* Snow TT Bros: the floor check. Runs in node (tools/check.js) and in the browser console (game.check()).
   For every floor it checks
     - the map: 15 rows of 20, known letters only, solid outside walls and ground, both starts present
     - spawns: nobody starts inside a wall or in mid-air, and baddies don't start right next to a brother
     - reachability: with the real jump physics, every ledge can be reached from both starts, and every ledge can get
       back to the starts (no traps)
     - boss floors: from every ledge a kicked snowball can roll down to the boss
     - a soak: two invincible autopilot brothers (and a 1P run with the companion) must clear the floor in time
   ST.check({ soak, seeds, floors, modes, maxTime, quiet }) returns { ok, problems, floors: [...] }. */
(function (root) {
  'use strict';
  const ST = (root.ST = root.ST || {});

  function staticCheck(def, i) {
    const { W, H } = ST.TUNE;
    const probs = [];
    const map = def.map || [];
    if (map.length !== H) probs.push(`has ${map.length} rows (wants ${H})`);
    map.forEach((row, r) => {
      if (row.length !== W) probs.push(`row ${r} is ${row.length} wide (wants ${W})`);
      const bad = row.replace(/[#=.12zrgB]/g, '');
      if (bad) probs.push(`row ${r} has unknown letters "${bad}"`);
    });
    const f = ST.parseFloor(def, i);
    for (let r = 0; r < H; r++) if (f.grid[r][0] !== '#' || f.grid[r][W - 1] !== '#') { probs.push(`row ${r}: the outside walls must be solid`); break; }
    if (f.grid[H - 1].some((t) => t !== '#')) probs.push('the ground row must be solid');
    const sp = f.spawns;
    if (!sp.players[0]) probs.push('no Teddy start (1)');
    if (!sp.players[1]) probs.push('no Tommy start (2)');
    if (def.boss && !sp.boss) probs.push('boss floor without a B');
    if (!def.boss && sp.boss) probs.push('a B on a floor without a boss');
    if (def.boss && !ST.BOSSES[def.boss]) probs.push(`unknown boss "${def.boss}"`);
    if (!def.boss && !sp.enemies.length) probs.push('no baddies');

    const bodyClear = (s, h, w, what) => {
      const rows = Math.ceil(h - 0.01);
      const c0 = Math.floor(s.x - w / 2 + 0.03), c1 = Math.floor(s.x + w / 2 - 0.03);
      for (let k = 0; k < rows; k++) for (let c = c0; c <= c1; c++) {
        if (f.solid(c, s.r - k)) { probs.push(`${what} at row ${s.r} col ${s.c} starts inside a wall`); return false; }
      }
      if (!f.standable(s.c, s.r + 1)) { probs.push(`${what} at row ${s.r} col ${s.c} starts in mid-air (nothing to stand on below)`); return false; }
      return true;
    };
    sp.players.forEach((s, k) => s && bodyClear(s, ST.TUNE.ph, ST.TUNE.pw, k ? 'Tommy' : 'Teddy'));
    for (const e of sp.enemies) {
      const K = ST.KINDS[e.type];
      bodyClear(e, K.h, K.w, e.type);
      for (const s of sp.players) {
        if (s && Math.abs(s.y - e.y) < 0.5 && Math.abs(s.x - e.x) < 3) probs.push(`${e.type} at row ${e.r} col ${e.c} starts too close to a brother`);
      }
    }
    if (sp.boss) {
      const D = ST.BOSSES[def.boss] || { w: 3, h: 4 };
      bodyClear(sp.boss, D.h, D.w, 'the boss');
      for (const s of sp.players) if (s && s.y < sp.boss.y + D.h + 0.5) probs.push('a brother starts down on the boss floor; start them on a ledge');
    }
    return { f, probs };
  }

  function navCheck(f, def) {
    const probs = [];
    const nav = ST.navFor(f);
    const segName = (s) => `ledge on row ${s.r} cols ${s.c0}-${s.c1}`;
    const starts = f.spawns.players.filter(Boolean).map((s) => nav.segAtX(s.r + 1, s.x));
    starts.forEach((st, k) => {
      if (st < 0) return;
      const seen = nav.reach(st);
      for (const s of nav.segs) if (!seen.has(s.id)) probs.push(`${segName(s)} can't be reached from ${k ? "Tommy's" : "Teddy's"} start`);
    });
    // no traps: from every ledge you can get back to a start
    for (const s of nav.segs) {
      const seen = nav.reach(s.id);
      if (starts.length && !starts.some((st) => seen.has(st))) probs.push(`${segName(s)} is a trap: you can't get back down from it`);
    }
    // enemy spawns must stand on a ledge the brothers can reach
    for (const e of f.spawns.enemies) if (nav.segAtX(e.r + 1, e.x) < 0) probs.push(`${e.type} at row ${e.r} col ${e.c} isn't standing on a ledge`);
    // boss floors: kicked snowballs must be able to reach the boss's floor from every ledge
    if (def.boss && f.spawns.boss) {
      const gy = f.spawns.boss.y;
      for (const s of nav.segs) {
        if (s.y <= gy + 0.5) continue;
        let ok = false;
        for (let c = s.c0; c <= s.c1 && !ok; c++) {
          for (const dir of [-1, 1]) {
            if (rollReaches(f, c + 0.5, s.y, dir, gy)) { ok = true; break; }
          }
        }
        if (!ok) probs.push(`a snowball kicked on the ${segName(s)} never rolls down to the boss`);
      }
    }
    return { nav, probs };
  }

  function rollReaches(f, x, y, dir, gy) {
    const T = ST.TUNE;
    const b = { x, y, w: T.ballSize, h: T.ballSize, vx: 0, vy: 0, onGround: true, dropT: 0 };
    let bounces = 0;
    for (let i = 0; i < T.rollTime * 60; i++) {
      b.vx = dir * T.roll;
      const wall = ST.moveBody(f, b, ST.DT);
      if (wall) { dir = -wall; if (++bounces >= T.ballBounces) return false; }
      if (b.onGround && b.y <= gy + 0.01) return true;
    }
    return false;
  }

  // Play a floor with autopilot brothers until it's cleared (or time runs out).
  function soak(floorN, opts) {
    const players = opts.oneP ? [{ id: 'teddy' }] : [{ id: 'teddy' }, { id: 'tommy' }];
    const w = new ST.World({ floors: opts.floors, floor: floorN, mode: opts.mode, players, seed: opts.seed, god: true });
    for (const p of w.players) p.bot = opts.idle ? null : new ST.Bot(w, p);
    const maxT = opts.maxTime || 240;
    let nextCall = 1;
    const stats = { calls: 0, treats: 0, combos: 0, bestCombo: 0, kicks: 0, shots: 0, bossHits: 0, saved: 0 };
    while (w.t < maxT) {
      if (opts.oneP && opts.buddy && !opts.idle && w.t > nextCall) { if (w.callBuddy()) stats.calls++; nextCall = w.t + 11; }
      w.step(0.1);
      for (const e of w.events) {
        if (e.t === 'treat') stats.treats++;
        else if (e.t === 'combo') { stats.combos++; stats.bestCombo = Math.max(stats.bestCombo, e.n); }
        else if (e.t === 'kick') stats.kicks++;
        else if (e.t === 'throw') stats.shots++;
        else if (e.t === 'bossHit') stats.bossHits++;
      }
      w.events.length = 0;
      if (w.phase === 'clear' || w.phase === 'celebrate' || w.phase === 'done') return Object.assign({ cleared: true, time: w.time }, stats);
    }
    return Object.assign({ cleared: false, time: w.time, left: w.enemies.length + (w.boss && !w.boss.gone ? ' + boss hp ' + w.boss.hp : '') }, stats);
  }

  ST.check = function (opts = {}) {
    const floors = opts.floors || ST.FLOORS;
    const seeds = opts.seeds || [1, 2, 3];
    const modes = opts.modes || ['normal', 'easy'];
    const out = { ok: true, problems: [], floors: [] };
    const log = opts.quiet ? () => {} : (opts.log || console.log);
    floors.forEach((def, i) => {
      const n = i + 1;
      const rec = { n, name: def.name, problems: [], soak: [] };
      const st = staticCheck(def, i);
      rec.problems.push(...st.probs);
      if (!st.probs.length || opts.navAnyway) {
        const nc = navCheck(st.f, def);
        rec.problems.push(...nc.probs);
        rec.ledges = nc.nav.segs.length;
        rec.moves = nc.nav.segs.reduce((a, s) => a + s.edges.length, 0);
      }
      if (opts.soak !== false && !rec.problems.length) {
        for (const mode of modes) {
          for (const seed of seeds) {
            const r2 = soak(n, { floors, mode, seed, maxTime: opts.maxTime, idle: opts.idle });
            rec.soak.push(Object.assign({ mode, seed, players: 2 }, r2));
            if (!r2.cleared) rec.problems.push(`2P autopilot didn't clear it (${mode}, seed ${seed}, ${r2.left} left after ${Math.round(r2.time)} s)`);
          }
          const r1 = soak(n, { floors, mode, seed: 7, oneP: true, buddy: true, maxTime: opts.maxTime, idle: opts.idle });
          rec.soak.push(Object.assign({ mode, seed: 7, players: 1 }, r1));
          if (!r1.cleared) rec.problems.push(`1P autopilot with the companion didn't clear it (${mode}, ${r1.left} left after ${Math.round(r1.time)} s)`);
        }
      }
      if (rec.problems.length) { out.ok = false; for (const p of rec.problems) out.problems.push(`floor ${n} (${def.name}): ${p}`); }
      const times = rec.soak.filter((s) => s.cleared).map((s) => s.time);
      const tstr = times.length ? `cleared in ${Math.round(Math.min(...times))}-${Math.round(Math.max(...times))} s` : '';
      const combo = rec.soak.length ? `best combo ${Math.max(...rec.soak.map((s) => s.bestCombo))}` : '';
      log(`floor ${String(n).padStart(2)} ${def.name.padEnd(18)} ${rec.problems.length ? 'PROBLEMS ' + rec.problems.length : 'ok'}  ${rec.ledges || 0} ledges ${rec.moves || 0} moves  ${tstr} ${combo}`);
      out.floors.push(rec);
    });
    for (const p of out.problems) log('  - ' + p);
    log(out.ok ? 'ALL FLOORS OK' : `${out.problems.length} PROBLEMS`);
    return out;
  };

  ST.check.soak = soak;
})(typeof window !== 'undefined' ? window : globalThis);
