/* Snow TT Bros: everything painted on canvases (tiles, backdrops, potions, snow shots, comic bursts) and the models
   that aren't kit people (gremlins, the snow monster, the castle boss, the ghost-snowman, a crown).
   Exposes ST.art. */
(function () {
  'use strict';
  const ST = (window.ST = window.ST || {});
  const T = THREE;
  const G = Kit.gfx;
  const { makeCanvas, toTexture, shade, roundRect, std, mesh, FONT } = G;
  const cache = {};
  const once = (key, fn) => cache[key] || (cache[key] = fn());

  // a tiny seeded random so the paintings look the same every time
  function prng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

  // ---- tiles ----
  function blockTexture(theme) {
    return once('block' + theme, () => {
      const [c, g] = makeCanvas(128, 128);
      const R = prng(7);
      if (theme === 'yard') {
        g.fillStyle = '#efe6dc'; g.fillRect(0, 0, 128, 128);
        for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) {
          const x = i * 64 + (row % 2) * 32 + 3, y = row * 32 + 3;
          g.fillStyle = shade(['#c0503a', '#b34732', '#c95c43'][(row + i + 3) % 3], (R() - 0.5) * 0.12);
          roundRect(g, x, y, 58, 26, 4); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 4, y + 3, 50, 5);
        }
      } else if (theme === 'toys') {
        const cols = ['#ff5a5f', '#ffc93c', '#3fa7f5', '#4cd187'];
        const letters = ['A', 'B', 'C', '1'];
        for (let i = 0; i < 4; i++) {
          const x = (i % 2) * 64, y = Math.floor(i / 2) * 64;
          g.fillStyle = shade(cols[i], -0.25); g.fillRect(x, y, 64, 64);
          g.fillStyle = cols[i]; roundRect(g, x + 4, y + 4, 56, 56, 8); g.fill();
          g.fillStyle = '#ffffff'; g.font = `38px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(letters[i], x + 32, y + 35);
        }
      } else if (theme === 'ice') {
        const gr = g.createLinearGradient(0, 0, 128, 128);
        gr.addColorStop(0, '#d8f6ff'); gr.addColorStop(1, '#7cc9ef');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          g.beginPath(); let x = R() * 128, y = R() * 128; g.moveTo(x, y);
          for (let k = 0; k < 3; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); }
          g.stroke();
        }
        g.strokeStyle = 'rgba(40,120,170,0.5)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 125);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(10, 10, 40, 8);
      } else {
        g.fillStyle = '#4e4a63'; g.fillRect(0, 0, 128, 128);
        for (let row = 0; row < 3; row++) for (let i = -1; i < 3; i++) {
          const w = 60, h = 40, x = i * 64 + (row % 2) * 32 + 2, y = row * 43 + 2;
          g.fillStyle = shade('#8f8aa6', (R() - 0.5) * 0.25);
          roundRect(g, x, y, w, h, 6); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 4, y + 4, w - 8, 6);
        }
      }
      const t = toTexture(c, true);
      return t;
    });
  }

  function ledgeTexture(theme) {
    return once('ledge' + theme, () => {
      const [c, g] = makeCanvas(128, 64);
      const R = prng(11);
      if (theme === 'yard') {
        g.fillStyle = '#8a5a35'; g.fillRect(0, 0, 128, 64);
        for (let y = 0; y < 64; y += 21) {
          g.fillStyle = shade('#a06a40', (R() - 0.5) * 0.2); g.fillRect(0, y + 1, 128, 19);
          g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 1.5;
          for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, y + 5 + k * 5); g.bezierCurveTo(40, y + 3 + k * 5, 80, y + 8 + k * 5, 128, y + 5 + k * 5); g.stroke(); }
          g.fillStyle = '#4b2d17'; g.beginPath(); g.arc(10, y + 10, 2.5, 0, 7); g.arc(118, y + 10, 2.5, 0, 7); g.fill();
        }
      } else if (theme === 'toys') {
        g.fillStyle = '#2f6fd6'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 128, 10); g.fillRect(0, 54, 128, 10);
        g.fillStyle = '#1f4fa0';
        for (let x = 0; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 16, 54); g.lineTo(x + 32, 10); g.lineWidth = 5; g.strokeStyle = '#1f4fa0'; g.stroke(); }
        g.fillStyle = '#d9e6ff'; for (let x = 8; x < 128; x += 16) { g.beginPath(); g.arc(x, 5, 2.5, 0, 7); g.arc(x, 59, 2.5, 0, 7); g.fill(); }
      } else if (theme === 'ice') {
        const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, '#bff0ff'); gr.addColorStop(1, '#4fb2dc');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
        for (let x = 0; x < 128; x += 24) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 12, 10); g.lineTo(x + 24, 64); g.stroke(); }
      } else {
        g.fillStyle = '#6c4d8f'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#e8b931'; g.fillRect(0, 0, 128, 7); g.fillRect(0, 57, 128, 7);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let x = 0; x < 128; x += 32) g.fillRect(x, 7, 3, 50);
        g.fillStyle = '#f7d36b'; for (let x = 16; x < 128; x += 32) { g.beginPath(); g.arc(x, 32, 6, 0, 7); g.fill(); }
      }
      return toTexture(c, true);
    });
  }

  function snowTexture() {
    return once('snow', () => {
      const [c, g] = makeCanvas(256, 128);
      const R = prng(3);
      g.fillStyle = '#fbfdff'; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(${150 + R() * 60},${190 + R() * 40},255,${0.15 + R() * 0.3})`;
        g.beginPath(); g.arc(R() * 256, R() * 128, 1 + R() * 3.5, 0, 7); g.fill();
      }
      for (let i = 0; i < 18; i++) {
        g.fillStyle = 'rgba(170,205,240,0.35)';
        g.beginPath(); g.ellipse(R() * 256, R() * 128, 8 + R() * 14, 5 + R() * 8, R() * 3, 0, 7); g.fill();
      }
      return toTexture(c, true);
    });
  }

  // ---- backdrops: one big painting per world, behind the floor ----
  function backdrop(theme) {
    return once('bg' + theme, () => {
      const W = 1600, H = 1000;
      const [c, g] = makeCanvas(W, H);
      const R = prng(theme.length * 97 + 5);
      const grad = (stops) => { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, col]) => gr.addColorStop(o, col)); return gr; };
      const tree = (x, y, s, col) => {
        g.fillStyle = '#5b3a22'; g.fillRect(x - 5 * s, y - 14 * s, 10 * s, 18 * s);
        for (let k = 0; k < 3; k++) {
          const w = (46 - k * 11) * s, top = y - (30 + k * 28) * s - 34 * s, base = y - (8 + k * 28) * s;
          g.fillStyle = col; g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, base); g.lineTo(x - w, base); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, top); g.lineTo(x + w * 0.45, top + (base - top) * 0.45); g.lineTo(x - w * 0.45, top + (base - top) * 0.45); g.closePath(); g.fill();
        }
      };
      if (theme === 'yard') {
        g.fillStyle = grad([[0, '#6fb0ff'], [0.6, '#cfe7ff'], [1, '#f2f8ff']]); g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,250,220,0.8)'; g.beginPath(); g.arc(1220, 190, 70, 0, 7); g.fill();
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,0.85)'; const x = R() * W, y = 80 + R() * 220; g.beginPath(); g.ellipse(x, y, 90 + R() * 60, 26, 0, 0, 7); g.ellipse(x + 50, y - 18, 60, 30, 0, 0, 7); g.fill(); }
        g.fillStyle = '#e4f0fb'; g.beginPath(); g.moveTo(0, 640); for (let x = 0; x <= W; x += 80) g.lineTo(x, 600 - Math.sin(x / 260) * 60 - Math.sin(x / 97) * 14); g.lineTo(W, H); g.lineTo(0, H); g.fill();
        for (let i = 0; i < 22; i++) tree(R() * W, 610 + R() * 40, 0.6 + R() * 0.5, R() < 0.5 ? '#2f6b4f' : '#3a7d5a');
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, 760); for (let x = 0; x <= W; x += 60) g.lineTo(x, 740 - Math.sin(x / 180) * 24); g.lineTo(W, H); g.lineTo(0, H); g.fill();
        // a cosy house with lit windows, and a snowman
        const hx = 170, hy = 760;
        g.fillStyle = '#c96f4a'; g.fillRect(hx, hy - 170, 230, 170);
        g.fillStyle = '#7a3b2c'; g.beginPath(); g.moveTo(hx - 25, hy - 165); g.lineTo(hx + 115, hy - 270); g.lineTo(hx + 255, hy - 165); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(hx - 25, hy - 165); g.lineTo(hx + 115, hy - 270); g.lineTo(hx + 255, hy - 165); g.lineTo(hx + 225, hy - 160); g.lineTo(hx + 115, hy - 245); g.lineTo(hx + 5, hy - 160); g.fill();
        g.fillStyle = '#ffd86b'; g.fillRect(hx + 30, hy - 130, 50, 45); g.fillRect(hx + 150, hy - 130, 50, 45);
        g.fillStyle = '#5b2f22'; g.fillRect(hx + 95, hy - 90, 40, 90);
        g.fillStyle = '#ffffff'; for (const [x, y, r] of [[1330, 735, 38], [1330, 680, 28], [1330, 640, 20]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(1330, 640); g.lineTo(1356, 645); g.lineTo(1330, 650); g.fill();
        g.fillStyle = '#e53935'; g.fillRect(1306, 658, 48, 9);
      } else if (theme === 'toys') {
        g.fillStyle = grad([[0, '#b8794b'], [1, '#7d4a2a']]); g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 70) { g.fillStyle = `rgba(0,0,0,${0.06 + R() * 0.06})`; g.fillRect(x, 0, 4, H); }
        // round window with snow outside
        g.fillStyle = '#1d2f5c'; g.beginPath(); g.arc(800, 240, 120, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; for (let i = 0; i < 40; i++) { const a = R() * 7, r = R() * 110; g.beginPath(); g.arc(800 + Math.cos(a) * r, 240 + Math.sin(a) * r, 2 + R() * 3, 0, 7); g.fill(); }
        g.strokeStyle = '#5a3418'; g.lineWidth = 18; g.beginPath(); g.arc(800, 240, 120, 0, 7); g.stroke();
        g.lineWidth = 8; g.beginPath(); g.moveTo(680, 240); g.lineTo(920, 240); g.moveTo(800, 120); g.lineTo(800, 360); g.stroke();
        // shelves with toys
        for (const sy of [520, 760]) {
          g.fillStyle = '#5a3418'; g.fillRect(0, sy, W, 22);
          let x = 20;
          while (x < W - 60) {
            const kind = Math.floor(R() * 4), col = ['#ff5a5f', '#ffc93c', '#3fa7f5', '#4cd187', '#b26bff'][Math.floor(R() * 5)];
            g.fillStyle = col;
            if (kind === 0) { g.fillRect(x, sy - 50, 50, 50); g.fillStyle = '#fff'; g.font = `30px ${FONT}`; g.textAlign = 'center'; g.fillText('ABCXYZ'[Math.floor(R() * 6)], x + 25, sy - 14); x += 70; }
            else if (kind === 1) { g.beginPath(); g.arc(x + 26, sy - 26, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x, sy - 30, 52, 8); x += 70; }
            else if (kind === 2) { g.fillRect(x, sy - 40, 90, 32); g.fillRect(x + 60, sy - 62, 30, 26); g.fillStyle = '#222'; for (const k of [15, 45, 75]) { g.beginPath(); g.arc(x + k, sy - 6, 9, 0, 7); g.fill(); } x += 120; }
            else { g.beginPath(); g.moveTo(x + 18, sy - 90); g.lineTo(x + 34, sy - 60); g.lineTo(x + 34, sy - 10); g.lineTo(x + 2, sy - 10); g.lineTo(x + 2, sy - 60); g.fill(); g.fillStyle = '#e53935'; g.fillRect(x - 6, sy - 26, 48, 16); x += 70; }
          }
        }
        // gears
        const gear = (x, y, r, col) => {
          g.fillStyle = col; g.beginPath();
          for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? r : r * 1.18; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          g.fill(); g.fillStyle = shade(col, -0.35); g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
        };
        gear(150, 200, 110, '#c9a24b'); gear(330, 120, 60, '#9aa3ad'); gear(1450, 260, 130, '#9aa3ad'); gear(1270, 110, 60, '#c9a24b');
        // string lights
        g.strokeStyle = '#2c2c2c'; g.lineWidth = 3; g.beginPath();
        for (let x = 0; x <= W; x += 20) g.lineTo(x, 40 + Math.sin(x / 120) * 18); g.stroke();
        for (let x = 30; x < W; x += 60) { g.fillStyle = ['#ff5a5f', '#ffc93c', '#3fa7f5', '#4cd187'][(x / 60) % 4 | 0]; g.beginPath(); g.arc(x, 52 + Math.sin(x / 120) * 18, 9, 0, 7); g.fill(); }
      } else if (theme === 'ice') {
        g.fillStyle = grad([[0, '#06203d'], [0.55, '#0f4766'], [1, '#2b8fae']]); g.fillRect(0, 0, W, H);
        for (let k = 0; k < 3; k++) {
          const col = ['rgba(90,255,180,0.18)', 'rgba(170,110,255,0.16)', 'rgba(90,220,255,0.14)'][k];
          g.fillStyle = col; g.beginPath(); g.moveTo(0, 120 + k * 50);
          for (let x = 0; x <= W; x += 40) g.lineTo(x, 140 + k * 50 + Math.sin(x / 150 + k) * 50);
          for (let x = W; x >= 0; x -= 40) g.lineTo(x, 230 + k * 50 + Math.sin(x / 130 + k * 2) * 40);
          g.fill();
        }
        for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; g.beginPath(); g.arc(R() * W, R() * 400, R() * 2 + 0.5, 0, 7); g.fill(); }
        g.fillStyle = '#0a2b45';
        for (let x = 0; x < W; x += 50 + R() * 40) { const w = 20 + R() * 30, h = 60 + R() * 140; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w / 2, h); g.lineTo(x + w, 0); g.fill(); }
        const crystal = (x, y, h, col) => {
          g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.lineTo(x + h * 0.18, y - h * 0.8); g.lineTo(x + h * 0.09, y - h); g.lineTo(x - h * 0.09, y - h * 0.82); g.lineTo(x - h * 0.16, y); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + h * 0.09, y - h); g.lineTo(x + h * 0.02, y - h * 0.4); g.fill();
        };
        for (let i = 0; i < 26; i++) crystal(R() * W, H - R() * 120, 80 + R() * 200, R() < 0.5 ? 'rgba(120,230,255,0.75)' : 'rgba(190,140,255,0.7)');
        g.fillStyle = '#0d3550'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 60) g.lineTo(x, H - 60 - Math.sin(x / 90) * 20 - R() * 20); g.lineTo(W, H); g.fill();
      } else {
        g.fillStyle = grad([[0, '#1f1546'], [0.6, '#6b3a87'], [1, '#f08aa0']]); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,230,${0.3 + R() * 0.7})`; g.beginPath(); g.arc(R() * W, R() * 520, R() * 2 + 0.5, 0, 7); g.fill(); }
        g.fillStyle = '#fff4cf'; g.beginPath(); g.arc(1250, 200, 85, 0, 7); g.fill();
        g.fillStyle = '#e8d9a8'; g.beginPath(); g.arc(1225, 185, 14, 0, 7); g.arc(1275, 225, 10, 0, 7); g.fill();
        const tower = (x, w, h, col) => {
          g.fillStyle = col; g.fillRect(x, H - h, w, h);
          for (let k = 0; k < w; k += 24) g.fillRect(x + k, H - h - 18, 14, 18);
          g.fillStyle = '#ffd86b'; for (let y = H - h + 40; y < H - 60; y += 70) g.fillRect(x + w / 2 - 8, y, 16, 26);
        };
        const roof = (x, w, h, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - 10, H - h); g.lineTo(x + w / 2, H - h - w * 1.1); g.lineTo(x + w + 10, H - h); g.fill(); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w / 2, H - h - w * 1.1); g.lineTo(x + w / 2, H - h - w * 1.1 - 40); g.stroke(); g.fillStyle = '#ff5a5f'; g.fillRect(x + w / 2, H - h - w * 1.1 - 40, 26, 16); };
        tower(60, 120, 520, '#3a2560'); roof(60, 120, 520, '#5c2a6e');
        tower(1380, 140, 560, '#3a2560'); roof(1380, 140, 560, '#5c2a6e');
        tower(300, 90, 380, '#4a3072'); tower(1200, 100, 400, '#4a3072');
        g.fillStyle = '#2c1d4a'; g.fillRect(0, H - 220, W, 220);
        for (let k = 0; k < W; k += 40) g.fillRect(k, H - 245, 24, 25);
      }
      const t = toTexture(c);
      t.anisotropy = 4;
      return t;
    });
  }

  // ---- sprites ----
  function shotTexture(style) {
    return once('shot' + style, () => {
      const [c, g] = makeCanvas(128, 128);
      if (style === 'tommy') {
        // a ✌️ hand made of snow, drawn by hand so it never depends on an emoji font
        const draw = (fill, grow) => {
          g.save(); g.translate(64, 70); g.fillStyle = fill;
          const fat = (x, y, w, h, a) => { g.save(); g.translate(x, y); g.rotate(a); roundRect(g, -w / 2 - grow, -h - grow, w + grow * 2, h + grow * 2, w / 2 + grow); g.fill(); g.restore(); };
          fat(-10, -6, 17, 50, -0.3); // index finger
          fat(10, -6, 17, 50, 0.3);   // middle finger
          roundRect(g, -24 - grow, -16 - grow, 48 + grow * 2, 44 + grow * 2, 16 + grow); g.fill(); // palm
          fat(-25, 12, 15, 26, -1.25); // thumb across
          g.restore();
        };
        draw('#2a5d9f', 6);
        draw('#ffffff', 0);
        g.save(); g.translate(64, 70); g.strokeStyle = 'rgba(80,140,210,0.6)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.moveTo(-14, 10); g.lineTo(14, 10); g.stroke(); g.restore();
        g.fillStyle = 'rgba(140,190,255,0.5)';
        for (const [x, y] of [[50, 40], [78, 48], [60, 88], [44, 74]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
      } else {
        // Teddy's snowball, with faint basketball seams
        const gr = g.createRadialGradient(54, 50, 6, 64, 64, 54);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#eef6ff'); gr.addColorStop(1, '#a9cdf2');
        g.fillStyle = '#2a5d9f'; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
        g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 51, 0, 7); g.fill();
        g.strokeStyle = 'rgba(70,130,200,0.55)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(64, 13); g.lineTo(64, 115); g.moveTo(13, 64); g.lineTo(115, 64); g.stroke();
        g.beginPath(); g.arc(14, 64, 40, -1.0, 1.0); g.stroke();
        g.beginPath(); g.arc(114, 64, 40, Math.PI - 1.0, Math.PI + 1.0); g.stroke();
      }
      return toTexture(c);
    });
  }

  function potionTexture(kind) {
    return once('potion' + kind, () => {
      const [c, g] = makeCanvas(128, 128);
      const col = ST.POTIONS[kind].color;
      g.lineJoin = 'round';
      // flask
      g.fillStyle = '#14121f';
      roundRect(g, 46, 10, 36, 22, 6); g.fill();
      g.beginPath(); g.arc(64, 82, 42, 0, 7); g.fill(); g.fillRect(48, 24, 32, 30);
      g.fillStyle = '#e8f3ff'; g.beginPath(); g.arc(64, 82, 36, 0, 7); g.fill(); g.fillRect(54, 28, 20, 28);
      g.save(); g.beginPath(); g.arc(64, 82, 36, 0, 7); g.clip();
      g.fillStyle = col; g.fillRect(20, 66, 90, 60);
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (const [x, y, r] of [[52, 96, 5], [76, 104, 4], [68, 84, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.restore();
      g.fillStyle = '#9b6a3c'; roundRect(g, 50, 6, 28, 16, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(46, 70, 6, 14, 0.4, 0, 7); g.fill();
      // icon
      g.fillStyle = '#ffffff'; g.strokeStyle = '#14121f'; g.lineWidth = 4;
      g.beginPath();
      if (kind === 'speed') { g.moveTo(70, 60); g.lineTo(52, 88); g.lineTo(64, 88); g.lineTo(58, 110); g.lineTo(78, 80); g.lineTo(66, 80); g.closePath(); }
      else if (kind === 'big') { g.arc(64, 86, 18, 0, 7); }
      else if (kind === 'long') { g.moveTo(40, 82); g.lineTo(74, 82); g.lineTo(74, 72); g.lineTo(92, 88); g.lineTo(74, 104); g.lineTo(74, 94); g.lineTo(40, 94); g.closePath(); }
      else { g.ellipse(64, 80, 14, 18, 0, 0, 7); }
      g.stroke(); g.fill();
      if (kind === 'balloon') { g.beginPath(); g.moveTo(64, 98); g.quadraticCurveTo(58, 106, 66, 114); g.stroke(); }
      return toTexture(c);
    });
  }

  // comic burst with a word: POW!, BONK!, POOF!...
  function burstTexture(word, fill = '#ffd23f') {
    return once('burst' + word + fill, () => {
      const [c, g] = makeCanvas(256, 256);
      g.translate(128, 128);
      g.beginPath();
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 78 : 118; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); }
      g.closePath();
      g.fillStyle = fill; g.fill();
      g.lineWidth = 8; g.strokeStyle = '#14121f'; g.stroke();
      g.rotate(-0.12);
      g.font = `${word.length > 5 ? 40 : 52}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.strokeText(word, 0, 4);
      g.fillStyle = '#e53935'; g.fillText(word, 0, 4);
      return toTexture(c);
    });
  }

  // outlined text for floating scores and words
  function textTexture(text, color = '#ffffff') {
    return once('text' + text + color, () => {
      const [c, g] = makeCanvas(512, 128);
      g.font = `64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = '#14121f'; g.lineJoin = 'round'; g.strokeText(text, 256, 68);
      g.fillStyle = color; g.fillText(text, 256, 68);
      return toTexture(c);
    });
  }

  function starTexture() {
    return once('star', () => {
      const [c, g] = makeCanvas(64, 64);
      g.translate(32, 32); g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#ffe14d'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#f08a00'; g.stroke();
      return toTexture(c);
    });
  }

  // eyes peeking out of a snowball (worried, or cross when it's about to break free)
  function eyesTexture(cross) {
    return once('eyes' + cross, () => {
      const [c, g] = makeCanvas(128, 64);
      for (const x of [38, 90]) {
        g.fillStyle = '#14121f'; g.beginPath(); g.ellipse(x, 34, 19, 22, 0, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, 34, 15, 18, 0, 0, 7); g.fill();
        g.fillStyle = '#14121f'; g.beginPath(); g.arc(x + 3, 38, 7, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 5, 35, 2.5, 0, 7); g.fill();
      }
      g.strokeStyle = '#14121f'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath();
      if (cross) { g.moveTo(20, 8); g.lineTo(54, 18); g.moveTo(108, 8); g.lineTo(74, 18); }
      else { g.moveTo(22, 14); g.lineTo(52, 8); g.moveTo(106, 14); g.lineTo(76, 8); }
      g.stroke();
      return toTexture(c);
    });
  }

  function bubbleTexture(text) {
    return once('bubble' + text, () => {
      const [c, g] = makeCanvas(256, 128);
      g.fillStyle = '#ffffff'; g.strokeStyle = '#14121f'; g.lineWidth = 6;
      roundRect(g, 8, 8, 240, 82, 30); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(70, 88); g.lineTo(54, 120); g.lineTo(100, 88); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(66, 80, 38, 10);
      g.font = `34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e53935';
      g.fillText(text, 128, 52);
      return toTexture(c);
    });
  }

  function sprite(tex, size, o = {}) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, ...o }));
    s.scale.set(size, size * (o.aspect || 1), 1);
    return s;
  }

  // ---- models ----
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, parent);

  // a little gremlin: round-ish fuzzy body, big ears, big eyes, toothy grin. About 1 m tall, faces -z like kit people.
  function buildGremlin(fur = '#7bd389') {
    const root = new T.Group(), rig = new T.Group();
    root.add(rig);
    const m = std(fur, { roughness: 0.9 }), dark = std('#1b1a22'), white = std('#ffffff'), belly = std(shade(fur, 0.45), { roughness: 0.9 });
    const body = new T.Group(); body.position.y = 0.32; rig.add(body);
    box(0.7, 0.62, 0.6, m, 0, 0.31, 0, body);
    box(0.44, 0.4, 0.05, belly, 0, 0.26, -0.3, body);
    const head = new T.Group(); head.position.y = 0.62; body.add(head);
    box(0.62, 0.36, 0.52, m, 0, 0.1, 0, head);
    for (const x of [-0.15, 0.15]) {
      box(0.2, 0.22, 0.04, white, x, 0.14, -0.27, head);
      box(0.09, 0.11, 0.03, dark, x + 0.02, 0.12, -0.295, head);
    }
    box(0.3, 0.07, 0.03, std('#5a1f2b'), 0, -0.02, -0.27, head);
    for (const x of [-0.08, 0.08]) box(0.05, 0.05, 0.03, white, x, -0.005, -0.285, head);
    const ears = [];
    for (const s of [-1, 1]) {
      const ear = new T.Group(); ear.position.set(s * 0.3, 0.18, 0); head.add(ear);
      const e = box(0.42, 0.14, 0.06, m, s * 0.2, 0.05, 0, ear); e.rotation.z = s * 0.35;
      box(0.26, 0.07, 0.065, std('#f2a3b0'), s * 0.2, 0.05, -0.005, ear).rotation.z = s * 0.35;
      ears.push(ear);
    }
    const limb = (x, y, w, h, parent) => { const g = new T.Group(); g.position.set(x, y, 0); parent.add(g); box(w, h, w, m, 0, -h / 2, 0, g); return g; };
    const armL = limb(-0.42, 0.5, 0.14, 0.34, body), armR = limb(0.42, 0.5, 0.14, 0.34, body);
    const legL = limb(-0.18, 0.06, 0.18, 0.3, body), legR = limb(0.18, 0.06, 0.18, 0.3, body);
    box(0.24, 0.08, 0.3, dark, 0, -0.32, -0.05, legL); box(0.24, 0.08, 0.3, dark, 0, -0.32, -0.05, legR);
    return { root, rig, body, head, ears, armL, armR, legL, legR, gremlin: true };
  }
  function poseGremlin(p, ph, moving, k) {
    const s = Math.sin(ph);
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'x', moving ? s * 0.8 : 0);
    to(p.legR.rotation, 'x', moving ? -s * 0.8 : 0);
    to(p.armL.rotation, 'x', moving ? -s * 0.9 : 0.3);
    to(p.armR.rotation, 'x', moving ? s * 0.9 : 0.3);
    p.body.position.y = 0.32 + (moving ? Math.abs(Math.cos(ph)) * 0.08 : 0);
    p.ears[0].rotation.z = Math.sin(ph * 1.5) * 0.15;
    p.ears[1].rotation.z = -Math.sin(ph * 1.5) * 0.15;
  }

  // BIG FLUFF, the snow monster: a huge fluffy white-blue block with little horns and a goofy grin. ~3.8 m tall.
  function buildYeti() {
    const root = new T.Group(), rig = new T.Group(); root.add(rig);
    const fur = std('#eef6ff', { roughness: 1 }), shadeFur = std('#bcd8f2', { roughness: 1 }), dark = std('#1b1a22'), white = std('#ffffff');
    const face = std('#8fb6dd');
    const body = new T.Group(); body.position.y = 0.9; rig.add(body);
    box(2.6, 2.1, 2.0, fur, 0, 1.05, 0, body);
    for (let i = 0; i < 8; i++) box(0.5, 0.5, 2.05, i % 2 ? shadeFur : fur, -1.1 + i * 0.32, 0.05 + (i % 3) * 0.08, 0, body);
    const head = new T.Group(); head.position.y = 2.1; body.add(head);
    box(2.0, 1.1, 1.7, fur, 0, 0.5, 0, head);
    box(1.4, 0.75, 0.1, face, 0, 0.42, -0.86, head);
    for (const x of [-0.35, 0.35]) { box(0.34, 0.34, 0.06, white, x, 0.55, -0.92, head); box(0.16, 0.18, 0.05, dark, x + 0.04, 0.52, -0.96, head); }
    box(0.7, 0.16, 0.05, std('#3a2a5a'), 0, 0.2, -0.92, head);
    for (const x of [-0.18, 0.18]) box(0.14, 0.12, 0.05, white, x, 0.25, -0.95, head);
    for (const s of [-1, 1]) { const h = mesh(new T.ConeGeometry(0.16, 0.6, 6), std('#ffe3a3'), s * 0.75, 1.25, 0, head); h.rotation.z = -s * 0.4; }
    const limb = (x, y, w, h, parent) => { const g = new T.Group(); g.position.set(x, y, 0); parent.add(g); box(w, h, w, fur, 0, -h / 2, 0, g); box(w * 1.1, 0.3, w * 1.1, face, 0, -h, 0, g); return g; };
    const armL = limb(-1.55, 1.8, 0.6, 1.5, body), armR = limb(1.55, 1.8, 0.6, 1.5, body);
    const legL = limb(-0.7, 0.2, 0.75, 0.9, body), legR = limb(0.7, 0.2, 0.75, 0.9, body);
    return { root, rig, body, head, armL, armR, legL, legR };
  }

  // KING GRUMPCASTLE: a grumpy walking castle. Its gate is its mouth and opens when it sends out baddies.
  function buildCastle() {
    const root = new T.Group(), rig = new T.Group(); root.add(rig);
    const stoneTex = blockTexture('castle');
    const stone = std('#ffffff', { map: stoneTex });
    const roof = std('#7a3fb0'), dark = std('#1b1a22'), white = std('#ffffff'), gold = std('#ffd23f', { metalness: 0.4, roughness: 0.4 });
    const body = new T.Group(); body.position.y = 0.5; rig.add(body);
    const keep = new T.BoxGeometry(3.0, 3.0, 2.0); G.boxUV(keep, 3, 3, 2, 1);
    mesh(keep, stone, 0, 1.5, 0, body);
    for (let i = 0; i < 5; i++) box(0.4, 0.35, 2.0, stone, -1.2 + i * 0.6, 3.17, 0, body);
    for (const s of [-1, 1]) {
      const tg = new T.BoxGeometry(0.9, 3.6, 1.6); G.boxUV(tg, 0.9, 3.6, 1.6, 1);
      mesh(tg, stone, s * 1.75, 1.8, 0, body);
      mesh(new T.ConeGeometry(0.75, 1.1, 4), roof, s * 1.75, 4.15, 0, body).rotation.y = Math.PI / 4;
      box(0.3, 0.4, 0.05, std('#ffd86b', { emissive: '#ffb200', emissiveIntensity: 0.6 }), s * 1.75, 2.6, -0.81, body);
    }
    const flagPole = box(0.06, 0.9, 0.06, dark, 1.75, 5.0, 0, body);
    box(0.5, 0.3, 0.04, std('#ff5a5f'), 2.0, 5.25, 0, body);
    // the grumpy face
    const face = new T.Group(); face.position.set(0, 2.2, -1.02); body.add(face);
    for (const x of [-0.6, 0.6]) {
      box(0.5, 0.42, 0.06, white, x, 0, 0, face);
      box(0.2, 0.22, 0.05, dark, x * 0.92, -0.04, -0.04, face);
      const brow = box(0.62, 0.12, 0.08, dark, x, 0.32, -0.02, face); brow.rotation.z = x > 0 ? 0.35 : -0.35;
    }
    const gate = new T.Group(); gate.position.set(0, 0.95, -1.02); body.add(gate);
    box(1.1, 1.2, 0.05, std('#2a1a12'), 0, 0, 0.01, gate);
    const portcullis = new T.Group(); gate.add(portcullis);
    for (let i = 0; i < 4; i++) box(0.07, 1.2, 0.06, gold, -0.39 + i * 0.26, 0, -0.03, portcullis);
    for (let i = 0; i < 3; i++) box(1.05, 0.07, 0.06, gold, 0, -0.4 + i * 0.4, -0.03, portcullis);
    const crown = new T.Group(); crown.position.y = 3.4; body.add(crown);
    const feet = [];
    for (const s of [-1, 1]) { const f = new T.Group(); f.position.set(s * 0.9, 0.5, 0); rig.add(f); box(0.7, 0.5, 1.0, dark, 0, -0.25, -0.1, f); feet.push(f); }
    return { root, rig, body, face, gate, portcullis, feet, flagPole };
  }

  // the "hurry up!" ghost-snowman: see-through, wobbly, with a carrot nose and a speech bubble
  function buildGhost() {
    const root = new T.Group(), rig = new T.Group(); root.add(rig);
    const ghostMat = new T.MeshStandardMaterial({ color: '#f4fbff', emissive: '#bfe3ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.78, roughness: 0.6 });
    const dark = std('#1b1a22');
    mesh(new T.SphereGeometry(0.62, 18, 14), ghostMat, 0, 0.75, 0, rig, false);
    mesh(new T.SphereGeometry(0.44, 18, 14), ghostMat, 0, 1.55, 0, rig, false);
    const tail = mesh(new T.ConeGeometry(0.55, 0.9, 14, 1, true), ghostMat, 0, 0.12, 0, rig, false); tail.rotation.x = Math.PI;
    for (const x of [-0.15, 0.15]) mesh(new T.SphereGeometry(0.07, 8, 6), dark, x, 1.62, 0.39, rig, false);
    const nose = mesh(new T.ConeGeometry(0.07, 0.36, 8), std('#ff8a1f'), 0, 1.52, 0.55, rig, false); nose.rotation.x = Math.PI / 2;
    const mouth = mesh(new T.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), dark, 0, 1.43, 0.4, rig, false); mouth.rotation.z = Math.PI;
    const hat = new T.Group(); hat.position.y = 1.95; rig.add(hat);
    mesh(new T.CylinderGeometry(0.42, 0.42, 0.06, 16), dark, 0, 0, 0, hat, false);
    mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 16), dark, 0, 0.27, 0, hat, false);
    mesh(new T.CylinderGeometry(0.29, 0.29, 0.1, 16), std('#e53935'), 0, 0.08, 0, hat, false);
    const arms = [];
    for (const s of [-1, 1]) { const a = box(0.7, 0.06, 0.06, std('#6b4226'), s * 0.75, 1.0, 0, rig); a.rotation.z = s * 0.5; arms.push(a); }
    const bubble = sprite(bubbleTexture('HURRY UP!'), 1.8, { aspect: 0.5 });
    bubble.position.set(1.1, 2.6, 0);
    root.add(bubble);
    return { root, rig, arms, bubble, mat: ghostMat };
  }

  function buildCrown() {
    const g = new T.Group();
    const gold = std('#ffd23f', { metalness: 0.5, roughness: 0.35, emissive: '#5a4000', emissiveIntensity: 0.3 });
    box(0.56, 0.1, 0.52, gold, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) {
      for (const z of [-0.24, 0.24]) box(0.08, 0.16, 0.06, gold, -0.22 + i * 0.146, 0.12, z, g);
    }
    mesh(new T.SphereGeometry(0.05, 8, 6), std('#ff3d7f'), 0, 0.04, -0.27, g, false);
    return g;
  }

  // a pine tree / crystal / toy block / tower, to fill the sides of wide screens
  function buildProp(theme, R) {
    const g = new T.Group();
    if (theme === 'yard') {
      const green = std(R() < 0.5 ? '#2f6b4f' : '#3a7d5a'), snow = std('#ffffff');
      box(0.35, 0.8, 0.35, std('#6b4226'), 0, 0.4, 0, g);
      for (let i = 0; i < 3; i++) {
        mesh(new T.ConeGeometry(1.5 - i * 0.35, 1.5, 8), green, 0, 1.4 + i * 1.0, 0, g);
        mesh(new T.ConeGeometry(0.6 - i * 0.12, 0.5, 8), snow, 0, 1.95 + i * 1.0, 0, g);
      }
    } else if (theme === 'toys') {
      const cols = ['#ff5a5f', '#ffc93c', '#3fa7f5', '#4cd187'];
      let y = 0;
      for (let i = 0; i < 2 + Math.floor(R() * 3); i++) { const s = 1.2 - i * 0.15; box(s, s, s, std(cols[Math.floor(R() * 4)]), (R() - 0.5) * 0.4, y + s / 2, 0, g).rotation.y = R() * 0.6; y += s; }
    } else if (theme === 'ice') {
      const mat = new T.MeshStandardMaterial({ color: R() < 0.5 ? '#8fe6ff' : '#c8a6ff', emissive: '#3aa0d0', emissiveIntensity: 0.3, transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.1 });
      for (let i = 0; i < 4; i++) { const h = 1.5 + R() * 3; const c = mesh(new T.ConeGeometry(0.35 + R() * 0.3, h, 5), mat, (R() - 0.5) * 1.6, h / 2, (R() - 0.5) * 0.8, g); c.rotation.z = (R() - 0.5) * 0.5; }
    } else {
      const stone = std('#5a4f7a');
      const h = 3 + R() * 4;
      box(1.6, h, 1.6, stone, 0, h / 2, 0, g);
      for (let i = 0; i < 4; i++) box(0.36, 0.4, 1.6, stone, -0.6 + i * 0.4, h + 0.2, 0, g);
      mesh(new T.ConeGeometry(1.2, 1.6, 4), std('#7a3fb0'), 0, h + 1.2, 0, g).rotation.y = Math.PI / 4;
    }
    return g;
  }

  ST.art = {
    blockTexture, ledgeTexture, snowTexture, backdrop, shotTexture, potionTexture, burstTexture, textTexture,
    starTexture, eyesTexture, bubbleTexture, sprite, buildGremlin, poseGremlin, buildYeti, buildCastle, buildGhost,
    buildCrown, buildProp, prng,
  };
})();
