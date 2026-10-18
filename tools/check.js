#!/usr/bin/env node
/* Headless floor check: node tools/check.js [--quick] [--no-soak] [--floor=N] [--seeds=1,2,3]
   Loads the game's rules (js/sim.js), floors and checker into a sandbox with no browser, checks every floor, then
   proves the check can fail: deliberately broken floors must be caught, and idle brothers must not clear a floor. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..');
const sandbox = { console, Math, Date };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/title.js', 'js/floors.js', 'js/sim.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
}
const ST = sandbox.ST;

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === '--' + name);
const val = (name) => { const a = args.find((x) => x.startsWith('--' + name + '=')); return a ? a.split('=')[1] : null; };

const t0 = Date.now();
let floors = ST.FLOORS;
const only = val('floor');
const opts = { soak: !flag('no-soak'), seeds: (val('seeds') || (flag('quick') ? '1' : '1,2,3')).split(',').map(Number) };
if (flag('quick')) opts.modes = ['normal'];
if (only) {
  const n = Number(only);
  opts.floors = floors.slice(0, n); // floors before it still count for numbering
  const res = ST.check(Object.assign({}, opts, { floors: [floors[n - 1]] }));
  process.exit(res.ok ? 0 : 1);
}
const res = ST.check(opts);

// ---- prove the check can fail ----
console.log('\nsabotage (each must be caught):');
const base = floors[0];
const broken = [
  { why: 'a ledge too high to reach', def: Object.assign({}, base, { map: base.map.map((r, i) => (i === 1 ? '#....====..........#' : i === 2 ? '#..................#' : r)) }) },
  { why: 'a zombie inside a wall', def: Object.assign({}, base, { map: base.map.map((r, i) => (i === 5 ? '#=======..z.=======#' : r)).map((r, i) => (i === 4 ? '#.......####.......#' : r)) }) },
  { why: 'a hole in the outside wall', def: Object.assign({}, base, { map: base.map.map((r, i) => (i === 7 ? '...................#' : r)) }) },
  { why: 'a gremlin floating in mid-air', def: Object.assign({}, base, { map: base.map.map((r, i) => (i === 9 ? '#........g.........#' : r)) }) },
  { why: 'a row too short', def: Object.assign({}, base, { map: base.map.map((r, i) => (i === 3 ? '#.................#' : r)) }) },
];
let caught = 0;
for (const b of broken) {
  const r = ST.check({ floors: [b.def], soak: false, quiet: true });
  const ok = !r.ok;
  if (ok) caught++;
  console.log(`  ${ok ? 'caught' : 'MISSED'}: ${b.why}${ok ? ' -> ' + r.problems[0].replace(/^floor 1 \([^)]*\): /, '') : ''}`);
}
let idleOk = true;
if (opts.soak) {
  for (const n of [1, 5]) {
    const r = ST.check.soak(n, { floors, mode: 'easy', seed: 1, idle: true, maxTime: 90 });
    const ok = !r.cleared;
    idleOk = idleOk && ok;
    console.log(`  ${ok ? 'caught' : 'MISSED'}: idle brothers on floor ${n} (${r.cleared ? 'cleared it!' : 'did not clear it'})`);
  }
}
const allCaught = caught === broken.length && idleOk;
console.log(`\n${res.ok && allCaught ? 'PASS' : 'FAIL'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(res.ok && allCaught ? 0 : 1);
