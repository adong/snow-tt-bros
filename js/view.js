/* Snow TT Bros: the 3D view. Reads the world (js/sim.js) every frame and draws it: the floor's blocks and ledges,
   the brothers (kit people), baddies with their snow, rolling snowballs, bosses, the ghost-snowman, treats, potions,
   snow shots and all the poofs, stars and comic bursts. It never changes the world. Exposes ST.View. */
(function () {
  'use strict';
  const ST = (window.ST = window.ST || {});
  const T = THREE;
  const A = () => ST.art;
  const { std, mesh, emojiTexture, nameTag, dotTexture, glowTexture } = Kit.gfx;
  const HALF = Math.PI / 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const THEME_LIGHT = {
    yard: { sky: '#dff0ff', ground: '#8a7a6a', hemi: 0.95, sun: '#fff4e0', sunI: 1.15, fog: '#cfe7ff', flakes: '#ffffff' },
    toys: { sky: '#ffe6c8', ground: '#6a4a30', hemi: 0.9, sun: '#ffe0b0', sunI: 1.1, fog: '#b8794b', flakes: '#fff3d6' },
    ice: { sky: '#bfefff', ground: '#21506e', hemi: 0.9, sun: '#d8f4ff', sunI: 1.0, fog: '#0f4766', flakes: '#bff4ff' },
    castle: { sky: '#e6d2ff', ground: '#3a2a50', hemi: 0.85, sun: '#ffd9e6', sunI: 1.0, fog: '#6b3a87', flakes: '#ffffff' },
  };
  const ROBOT_LOOK = { head: 'robot', skin: '#cfd6de', eyes: '#ffea00', shirt: 'jacket', top: '#e53935', print: 'panel', bottom: '#4a4f5b', shoes: '#22222a' };
  const BIG_ROBOT_LOOK = { head: 'robot', skin: '#dfe5ec', eyes: '#ff3d7f', shirt: 'jacket', top: '#7c4dff', print: 'bolt', bottom: '#3a3f4b', shoes: '#22222a' };

  // ---- particles: one Points draw for every poof, sparkle and trail ----
  class Particles {
    constructor(scene, max = 900) {
      this.max = max;
      this.n = 0;
      const geo = new T.BufferGeometry();
      this.pos = new Float32Array(max * 3);
      this.col = new Float32Array(max * 3);
      this.size = new Float32Array(max);
      this.alpha = new Float32Array(max);
      geo.setAttribute('position', new T.BufferAttribute(this.pos, 3));
      geo.setAttribute('pcolor', new T.BufferAttribute(this.col, 3));
      geo.setAttribute('size', new T.BufferAttribute(this.size, 1));
      geo.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1));
      this.geo = geo;
      this.mat = new T.ShaderMaterial({
        uniforms: { map: { value: dotTexture() }, scale: { value: 600 } },
        vertexShader: `
          attribute float size; attribute float alpha; attribute vec3 pcolor;
          uniform float scale;
          varying float vAlpha; varying vec3 vColor;
          void main() {
            vAlpha = alpha; vColor = pcolor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * scale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D map;
          varying float vAlpha; varying vec3 vColor;
          void main() {
            vec4 t = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
          }`,
        transparent: true,
        depthWrite: false,
      });
      this.points = new T.Points(geo, this.mat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      this.list = [];
      this.tmp = new T.Color();
    }
    add(x, y, z, o) {
      if (this.list.length >= this.max) this.list.shift();
      this.tmp.set(o.color || '#ffffff');
      this.list.push({
        x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g == null ? 6 : o.g, drag: o.drag || 0.5,
        life: o.life || 0.8, t: 0, size: o.size || 0.25, grow: o.grow || 0, r: this.tmp.r, gg: this.tmp.g, b: this.tmp.b,
      });
    }
    burst(x, y, o = {}) {
      const n = o.n || 12;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (o.speed || 4) * (0.4 + Math.random() * 0.8);
        this.add(x + (Math.random() - 0.5) * (o.spread || 0.3), y + (Math.random() - 0.5) * (o.spread || 0.3), (o.z || 0) + (Math.random() - 0.5) * 0.4, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 1), vz: (Math.random() - 0.5) * sp * 0.5, g: o.g, life: (o.life || 0.7) * (0.6 + Math.random() * 0.6),
          size: (o.size || 0.3) * (0.6 + Math.random() * 0.8), color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, drag: o.drag, grow: o.grow,
        });
      }
    }
    update(dt) {
      const L = this.list;
      let j = 0;
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) continue;
        p.vy -= p.g * dt;
        const d = Math.pow(p.drag, dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        L[j++] = p;
      }
      L.length = j;
      const n = Math.min(L.length, this.max);
      for (let i = 0; i < n; i++) {
        const p = L[i], u = p.t / p.life;
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.gg; this.col[i * 3 + 2] = p.b;
        this.size[i] = p.size * (1 + p.grow * u);
        this.alpha[i] = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      }
      this.geo.setDrawRange(0, n);
      for (const k of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[k].needsUpdate = true;
    }
  }

  // ---- floating sprites: comic bursts, scores, emoji ----
  class Floaters {
    constructor(scene) { this.scene = scene; this.list = []; }
    add(tex, x, y, o = {}) {
      if (!o.to) y = Math.min(y, ST.TUNE.H - 0.9 - (o.vy == null ? 1.2 : o.vy) * (o.life || 1) * 0.5);
      const s = A().sprite(tex, o.size || 1, { aspect: o.aspect || 1, depthTest: o.depthTest !== false });
      s.position.set(x, y, o.z == null ? 1.2 : o.z);
      s.renderOrder = 10;
      this.scene.add(s);
      const f = { s, t: 0, life: o.life || 1, vx: o.vx || 0, vy: o.vy == null ? 1.2 : o.vy, g: o.g || 0, size: o.size || 1, aspect: o.aspect || 1, pop: o.pop !== false, spin: o.spin || 0, fade: o.fade == null ? 0.35 : o.fade, to: o.to, from: o.to ? new T.Vector3(x, y, s.position.z) : null, arc: o.arc || 0 };
      if (o.rot) s.material.rotation = o.rot;
      this.list.push(f);
      return f;
    }
    update(dt) {
      for (const f of this.list) {
        f.t += dt;
        const u = f.t / f.life;
        if (f.to) {
          // fly along an arc to a moving target (a treat thrown to a brother)
          const tx = f.to.x, ty = f.to.y;
          const k = Math.min(1, u);
          f.s.position.x = lerp(f.from.x, tx, k);
          f.s.position.y = lerp(f.from.y, ty, k) + Math.sin(Math.PI * k) * f.arc;
        } else {
          f.vy -= f.g * dt;
          f.s.position.x += f.vx * dt;
          f.s.position.y += f.vy * dt;
        }
        const pop = f.pop ? Math.min(1, f.t / 0.12) * (1 + Math.max(0, 0.25 - f.t) * 1.2) : 1;
        f.s.scale.set(f.size * pop, f.size * f.aspect * pop, 1);
        f.s.material.rotation += f.spin * dt;
        f.s.material.opacity = u > 1 - f.fade ? Math.max(0, (1 - u) / f.fade) : 1;
        if (u >= 1) { this.scene.remove(f.s); f.s.material.dispose(); f.dead = true; }
      }
      this.list = this.list.filter((f) => !f.dead);
    }
  }

  class View {
    constructor(canvas) {
      this.canvas = canvas;
      const r = (this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
      r.outputEncoding = T.sRGBEncoding;
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(30, 1, 1, 200);
      this.hemi = new T.HemisphereLight('#ffffff', '#806040', 0.9);
      this.scene.add(this.hemi);
      const sun = (this.sun = new T.DirectionalLight('#fff4e0', 1.1));
      sun.position.set(4, 22, 16);
      sun.target.position.set(10, 7, 0);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 13, bottom: -13, near: 1, far: 60 });
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 0.02;
      this.scene.add(sun, sun.target);
      this.level = new T.Group();
      this.scene.add(this.level);
      this.parts = new Particles(this.scene);
      this.floaters = new Floaters(this.scene);
      this.views = new Map();
      this.shake = 0;
      this.zoom = 0;
      this.zoomTo = null;
      this.insets = { top: 70, bottom: 0, left: 0, right: 0 };
      this.flakes = null;
      this.time = 0;
      this.portraitLooks = {};
      this.resize();
    }

    setInsets(o) { Object.assign(this.insets, o); this.resize(); }

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      if (w === this.w && h === this.h && !this.insetsDirty) { this.frame(); return; }
      this.w = w; this.h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.parts.mat.uniforms.scale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
      this.frame();
    }

    // place the camera so the whole floor fits between the HUD and the touch buttons
    frame() {
      const { W, H } = ST.TUNE;
      const I = this.insets, w = this.w, h = this.h;
      const aw = Math.max(100, w - I.left - I.right), ah = Math.max(100, h - I.top - I.bottom);
      const lw = W + 0.6, lh = H + 0.3;
      const hvis = Math.max((lh * h) / ah, (lw * h) / aw);
      const tan = Math.tan((this.camera.fov * Math.PI) / 360);
      const D = hvis / (2 * tan);
      const wpp = hvis / h;
      this.base = {
        x: W / 2 + ((I.right - I.left) / 2) * wpp,
        y: H / 2 + 0.55 + ((I.top - I.bottom) / 2) * wpp,
        z: D,
      };
      this.wpp = wpp;
    }

    // ---- building a floor ----
    buildFloor(world) {
      const f = world.f, theme = world.def.theme || 'yard';
      const { W, H } = ST.TUNE;
      this.theme = theme;
      for (const o of this.level.children.slice()) this.level.remove(o);
      for (const v of this.views.values()) v.dispose && v.dispose();
      this.views.clear();
      const L = THEME_LIGHT[theme];
      this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemi;
      this.sun.color.set(L.sun); this.sun.intensity = L.sunI;
      this.scene.background = new T.Color(L.fog);

      const art = A();
      const bg = new T.Mesh(new T.PlaneGeometry(64, 40), new T.MeshBasicMaterial({ map: art.backdrop(theme) }));
      bg.position.set(W / 2, H / 2 + 2, -9);
      this.level.add(bg);

      const blockTex = art.blockTexture(theme), ledgeTex = art.ledgeTexture(theme), snowTex = art.snowTexture();
      const blockMat = std('#ffffff', { map: blockTex, roughness: theme === 'ice' ? 0.3 : 0.85 });
      const ledgeMat = std('#ffffff', { map: ledgeTex, roughness: 0.7 });
      const snowMat = std('#ffffff', { map: snowTex, roughness: 0.95 });
      const iceMat = new T.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.85, roughness: 0.2 });
      const D = 1.6;
      const addBox = (w, h, d, mat, x, y, z, uv) => {
        const geo = new T.BoxGeometry(w, h, d);
        if (uv) Kit.gfx.boxUV(geo, uv[0], uv[1], uv[2], 1);
        const m = mesh(geo, mat, x, y, z, this.level, true);
        m.receiveShadow = true;
        return m;
      };
      const R = art.prng(world.floorN * 31 + 7);
      // the ground, running off both sides of the screen
      addBox(80, 1, 6, blockMat, W / 2, 0.5, -1.5, [80, 1, 6]);
      addBox(80, 0.2, 6.1, snowMat, W / 2, 1.02, -1.5, [20, 1, 3]);
      // outside walls, taller than the screen
      for (const x of [0.5, W - 0.5]) {
        addBox(1, H + 4, D, blockMat, x, (H + 4) / 2, 0, [1, H + 4, D]);
      }
      for (let r = 0; r < H - 1; r++) {
        let c = 1;
        while (c < W - 1) {
          const ch = f.grid[r][c];
          if (ch !== '#' && ch !== '=') { c++; continue; }
          const c0 = c;
          while (c < W - 1 && f.grid[r][c] === ch) c++;
          const len = c - c0, cx = c0 + len / 2, top = H - r;
          if (ch === '#') {
            addBox(len, 1, D, blockMat, cx, top - 0.5, 0, [len, 1, D]);
            let capped = false;
            for (let k = c0; k < c; k++) if (!f.solid(k, r - 1)) capped = true;
            if (capped) addBox(len + 0.08, 0.16, D + 0.1, snowMat, cx, top + 0.02, 0, [len, 1, 1]);
          } else {
            addBox(len, 0.5, 1.5, ledgeMat, cx, top - 0.27, 0, [len, 1, 1.5]);
            const cap = addBox(len + 0.14, 0.2, 1.62, snowMat, cx, top - 0.02, 0, [len, 1, 1]);
            cap.castShadow = true;
            // little icicles under the front edge
            for (let x = c0 + 0.3; x < c - 0.2; x += 0.55 + R() * 0.6) {
              const h = 0.15 + R() * 0.3;
              const ic = mesh(new T.ConeGeometry(0.06, h, 5), iceMat, x, top - 0.52 - h / 2, 0.72, this.level, false);
              ic.rotation.x = Math.PI;
            }
          }
        }
      }
      // props beside the tower, for wide screens
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const p = art.buildProp(theme, R);
          const x = side < 0 ? -1.8 - i * 3.2 - R() * 1.2 : W + 1.8 + i * 3.2 + R() * 1.2;
          p.position.set(x, 1, -1.5 - R() * 2.5);
          p.scale.setScalar(0.8 + R() * 0.5);
          p.traverse((o) => { if (o.isMesh) o.castShadow = false; });
          this.level.add(p);
        }
      }
      this.buildFlakes(L.flakes);
    }

    // gentle snowfall in front of and behind the floor
    buildFlakes(color) {
      if (this.flakes) { this.scene.remove(this.flakes.points); this.flakes.geo.dispose(); }
      const n = 260, geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), seed = [];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = -12 + Math.random() * 44; pos[i * 3 + 1] = Math.random() * 22; pos[i * 3 + 2] = -6 + Math.random() * 9;
        seed.push(Math.random() * 10);
      }
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const mat = new T.PointsMaterial({ color, size: 0.16, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.85 });
      const points = new T.Points(geo, mat);
      points.frustumCulled = false;
      this.scene.add(points);
      this.flakes = { points, geo, pos, seed, n };
    }

    // ---- per-entity views ----
    personView(id, scale, look) {
      const entry = Kit.roster.get(id);
      const p = Kit.people.build(look || entry.look);
      const g = new T.Group();
      p.root.scale.setScalar(scale);
      g.add(p.root);
      return { g, p, scale, entry };
    }

    starRing(parent, y, n = 3, size = 0.32) {
      const ring = new T.Group();
      ring.position.y = y;
      for (let i = 0; i < n; i++) {
        const s = A().sprite(A().starTexture(), size);
        const a = (i / n) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
        ring.add(s);
      }
      ring.visible = false;
      parent.add(ring);
      return ring;
    }

    makePlayerView(pl) {
      const scale = pl.id === 'tommy' ? 0.7 : pl.id === 'teddy' ? 0.78 : 0.74;
      const v = this.personView(pl.id, scale);
      this.scene.add(v.g);
      v.kind = 'player';
      v.stars = this.starRing(v.g, 1.75);
      v.giggle = A().sprite(emojiTexture('😆'), 0.6);
      v.giggle.position.set(0.4, 1.9, 0.4);
      v.giggle.visible = false;
      v.g.add(v.giggle);
      const shieldMat = new T.SpriteMaterial({ map: glowTexture(), color: pl.id === 'tommy' ? '#ffd27a' : '#ffb02e', transparent: true, opacity: 0.0, depthWrite: false, blending: T.AdditiveBlending });
      v.shield = new T.Sprite(shieldMat);
      v.shield.scale.set(2.4, 2.8, 1);
      v.shield.position.y = 0.85;
      v.g.add(v.shield);
      // the balloon for the green potion
      const bal = new T.Group();
      const ball = mesh(new T.SphereGeometry(0.6, 16, 12), std('#38d27a', { roughness: 0.3, emissive: '#0a5a2a', emissiveIntensity: 0.25 }), 0, 0.9, 0, bal, true);
      ball.scale.y = 1.15;
      mesh(new T.ConeGeometry(0.1, 0.16, 6), std('#2aa860'), 0, 0.2, 0, bal, false).rotation.x = Math.PI;
      mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 4), std('#ffffff'), 0, -0.3, 0, bal, false);
      bal.position.y = 2.1;
      bal.visible = false;
      v.g.add(bal);
      v.balloon = bal;
      const tag = nameTag(v.entry.name, pl.companion ? (v.entry.tag || '#ffb02e') : pl.id === 'teddy' ? '#8cc2ff' : '#9ff0c8');
      tag.scale.set(1.0, 0.32, 1);
      tag.position.y = 2.15;
      tag.visible = false;
      v.g.add(tag);
      v.tag = tag;
      v.rotY = pl.face > 0 ? -(HALF + 0.45) : HALF + 0.45;
      v.ph = 0;
      v.celebT = 0;
      v.lastBeat = -1;
      v.dispose = () => this.scene.remove(v.g);
      return v;
    }

    syncPlayer(pl, w, dt) {
      let v = this.views.get(pl.uid);
      if (!v) { v = this.makePlayerView(pl); this.views.set(pl.uid, v); if (pl.companion) this.parts.burst(pl.x, pl.y + 1, { n: 16, color: ['#ffffff', '#ffe14d'], speed: 3 }); }
      v.seen = true;
      const g = v.g, p = v.p;
      const out = pl.state === 'out';
      g.visible = !out;
      if (out) return;
      g.position.set(pl.x, pl.y, pl.companion ? 0.35 : pl.slot === 1 ? 0.15 : 0);
      const moving = Math.abs(pl.vx) > 0.2 && pl.onGround;
      v.ph += dt * (moving ? Math.abs(pl.vx) * 2.4 : 2);
      const sigHello = Kit.roster.signature(v.entry, 'hello'), sigBye = Kit.roster.signature(v.entry, 'goodbye');
      let mode = 'stand', u = 0, faceCam = false;
      const cs = pl.companion ? pl.cstate : null;
      if (cs === 'enter') mode = pl.ghostFall ? 'cheer' : 'jump';
      else if (cs === 'hello') { mode = sigHello; faceCam = true; }
      else if (cs === 'bye') { mode = sigBye; faceCam = true; }
      else if (cs === 'leave') mode = 'cheer';
      else if (pl.state === 'dizzy') mode = 'dizzy';
      else if (pl.state === 'tickle') mode = 'tickle';
      else if (pl.state === 'balloon') mode = 'balloon';
      else if (pl.state === 'hi5') { mode = sigHello; faceCam = true; }
      else if (pl.state === 'cheer') { mode = pl.cheer; faceCam = true; }
      else if (pl.animT > 0 && pl.anim === 'throw') { mode = pl.id === 'teddy' ? 'throwT' : 'throwM'; u = 1 - pl.animT / ST.TUNE.throwAnim; }
      else if (pl.animT > 0 && pl.anim === 'kick') { mode = 'kick'; u = 1 - pl.animT / ST.TUNE.kickAnim; }
      else if (pl.animT > 0 && pl.anim === 'hello') { mode = sigHello; faceCam = true; }
      else if (pl.animT > 0 && pl.anim === 'give') mode = 'give';
      else if (pl.animT > 0 && pl.anim === 'push') mode = 'push';
      else if (!pl.onGround) mode = 'jump';
      else if (moving) mode = 'run';
      if ((mode === 'peace' || mode === 'wave') && !faceCam) faceCam = true;
      ST.pose(p, v.ph, mode, 1 - Math.exp(-18 * dt), u);
      // turn: side-on and a little toward the camera so faces show; celebrations face the camera
      let want = pl.face > 0 ? -(HALF + 0.45) : HALF + 0.45;
      if (faceCam) want = mode === 'jumpshot' ? (pl.face > 0 ? -(HALF + 0.2) : HALF + 0.2) : mode === 'boxing' ? Math.PI - 0.55 * pl.face : Math.PI;
      if (want - v.rotY > Math.PI) v.rotY += Math.PI * 2;
      if (v.rotY - want > Math.PI) v.rotY -= Math.PI * 2;
      v.rotY = lerp(v.rotY, want, 1 - Math.exp(-14 * dt));
      p.root.rotation.y = v.rotY;
      // the jump shot celebration hops
      if (mode === 'jumpshot' && (pl.state === 'cheer' || cs === 'bye')) {
        v.celebT += dt;
        const hop = (v.celebT % 1.1) / 1.1;
        p.root.position.y = Math.sin(Math.PI * Math.min(1, hop * 1.6)) * 0.5;
        if (hop < v.lastHop) this.shootHoop(pl, v);
        v.lastHop = hop;
      } else if (mode === 'boxing' && (pl.state === 'cheer' || pl.state === 'hi5' || cs === 'hello' || pl.anim === 'hello')) {
        v.celebT += dt;
        const beat = Math.floor((v.ph / (Math.PI * 2)) * 4);
        if (beat !== v.lastBeat) { v.lastBeat = beat; if (beat % 2 === 0) this.floaters.add(emojiTexture('💥'), pl.x + (pl.face || 1) * 0.5, pl.y + 1.3, { size: 0.55, life: 0.35, vy: 0.5, z: 1.4 }); }
        p.root.position.y = 0;
      } else if (mode === 'peace' && (pl.state === 'cheer' || pl.state === 'hi5' || cs)) {
        v.celebT += dt;
        if (v.celebT > 0.45) { v.celebT = 0; this.floaters.add(emojiTexture(Math.random() < 0.5 ? '✌️' : '⭐'), pl.x + (Math.random() - 0.5) * 1.6, pl.y + 1.6 + Math.random() * 0.6, { size: 0.5, life: 0.8, vy: 1.4, z: 1.4 }); }
        p.root.position.y = 0;
      } else { p.root.position.y = 0; v.celebT = 0; }
      // extras
      v.stars.visible = pl.state === 'dizzy';
      v.stars.rotation.y += dt * 5;
      v.giggle.visible = pl.state === 'tickle';
      v.balloon.visible = pl.state === 'balloon';
      if (v.balloon.visible) { v.balloon.rotation.z = Math.sin(this.time * 3) * 0.12; if (pl.balloonT < 1.5) v.balloon.visible = (this.time * 8) % 2 < 1.4; }
      const shieldOn = pl.shield && !pl.companion;
      v.shield.material.opacity = lerp(v.shield.material.opacity, shieldOn ? 0.32 + Math.sin(this.time * 5) * 0.08 : 0, 1 - Math.exp(-8 * dt));
      const blink = pl.inv > 0 && pl.state === 'play' && !pl.companion && Math.floor(this.time * 14) % 2 === 0;
      p.root.visible = !blink;
      v.tag.visible = pl.companion || (w.twoP && w.phase === 'intro');
      // sparkles for the high-five burst or a speed potion
      if (pl.burstT > 0 && Math.random() < dt * 30) this.parts.add(pl.x + (Math.random() - 0.5) * 0.8, pl.y + Math.random() * 1.5, 0.4, { color: Math.random() < 0.5 ? '#ffe14d' : '#ffffff', vy: 1, g: 0, life: 0.5, size: 0.18 });
      else if (pl.powers.speed && moving && Math.random() < dt * 14) this.parts.add(pl.x - pl.face * 0.3, pl.y + 0.1, 0.2, { color: '#ffffff', vx: -pl.face, vy: 0.6, g: 0, life: 0.4, size: 0.22 });
    }

    shootHoop(pl, v) {
      const hx = pl.x + (pl.face || 1) * 0.3, hy = pl.y + 2.0;
      this.floaters.add(emojiTexture('🏀'), hx, hy, { size: 0.5, life: 0.9, vx: (pl.face || 1) * 1.5, vy: 5, g: 9, spin: 6, pop: false, z: 1.4 });
      setTimeout(() => this.floaters.add(A().textTexture('SWISH!', '#ffd23f'), hx + (pl.face || 1) * 1.3, hy + 1.2, { size: 2.8, aspect: 0.25, life: 0.7, vy: 0.6, z: 1.6 }), 450);
      if (ST.sfx) setTimeout(() => ST.sfx.swish(), 450);
    }

    makeEnemyView(e, w) {
      let v;
      if (e.type === 'gremlin') {
        const fur = w.floorN > 10 ? '#b07cff' : '#7bd389';
        const m = A().buildGremlin(fur);
        v = { g: new T.Group(), m, gremlin: true };
        m.root.scale.setScalar(1);
        v.g.add(m.root);
        v.model = m.root;
      } else {
        const look = e.type === 'robot' ? ROBOT_LOOK : null;
        v = this.personView(e.type === 'robot' ? 'bolt' : 'zombie', 0.68, look);
        v.model = v.p.root;
      }
      this.scene.add(v.g);
      v.kind = 'enemy';
      v.ph = Math.random() * 6;
      v.rotY = e.face > 0 ? -(HALF + 0.3) : HALF + 0.3;
      // snow: a mound that grows with each hit, then a full snowball
      const snowMat = std('#ffffff', { map: A().snowTexture(), roughness: 0.95 });
      v.mound = new T.Group();
      const lumps = [[0, 0, 0, 1], [-0.22, 0.05, 0.12, 0.7], [0.24, -0.02, -0.1, 0.75]];
      for (const [x, y, z, s] of lumps) { const l = mesh(new T.SphereGeometry(0.5 * s, 14, 10), snowMat, x, y, z, v.mound, true); l.userData.s = s; }
      v.mound.visible = false;
      v.g.add(v.mound);
      v.ball = mesh(new T.SphereGeometry(ST.TUNE.ballSize / 2, 22, 16), snowMat, 0, ST.TUNE.ballSize / 2, 0, v.g, true);
      v.ball.visible = false;
      v.eyes = A().sprite(A().eyesTexture(false), 0.6, { aspect: 0.5 });
      v.eyes.position.set(0, 0.95, 0.8);
      v.eyes.visible = false;
      v.g.add(v.eyes);
      v.stars = this.starRing(v.g, e.type === 'gremlin' ? 1.15 : 1.45, 3, 0.26);
      v.dispose = () => this.scene.remove(v.g);
      return v;
    }

    syncEnemy(e, w, dt) {
      let v = this.views.get(e.uid);
      if (!v) { v = this.makeEnemyView(e, w); this.views.set(e.uid, v); }
      v.seen = true;
      const g = v.g;
      g.position.set(e.x, e.y, 0);
      const ballState = e.state === 'ball' || e.state === 'rolling';
      v.model.visible = !ballState;
      v.ball.visible = ballState;
      v.eyes.visible = e.state === 'ball';
      v.stars.visible = e.state === 'stun' || e.state === 'bonked';
      v.stars.rotation.y += dt * 6;
      const k = 1 - Math.exp(-16 * dt);
      if (ballState) {
        v.mound.visible = false;
        if (e.state === 'rolling') {
          v.ball.rotation.z -= (e.vx * dt) / (ST.TUNE.ballSize / 2);
          v.ball.position.x = 0;
          if (Math.random() < dt * 40 && e.onGround) this.parts.add(e.x - e.dir * 0.6, e.y + 0.1, (Math.random() - 0.5) * 0.8, { color: '#ffffff', vx: -e.dir * 1.5, vy: 1.5, g: 5, life: 0.5, size: 0.28 });
        } else {
          const shaking = e.ballT > w.M.ballTime;
          v.ball.position.x = shaking ? Math.sin(this.time * 40) * 0.06 : 0;
          v.ball.rotation.z = lerp(v.ball.rotation.z, 0, k * 0.2);
          if (shaking !== v.wasShaking) { v.eyes.material.map = A().eyesTexture(shaking); v.wasShaking = shaking; }
          v.eyes.position.x = v.ball.position.x;
        }
        return;
      }
      v.ball.rotation.z = 0;
      // the model
      const moving = e.state === 'walk' && Math.abs(e.vx) > 0.05 && e.onGround;
      v.ph += dt * (moving ? Math.abs(e.vx) * 3 + 2 : 2);
      let want = e.face > 0 ? -(HALF + 0.3) : HALF + 0.3;
      if (e.state === 'spawn') {
        const s = clamp((w.phaseT - 0.0) / 0.5, 0.01, 1);
        v.model.scale.setScalar((v.gremlin ? 1 : 0.68) * s);
      } else v.model.scale.setScalar(v.gremlin ? 1 : 0.68);
      if (v.gremlin) ST.art.poseGremlin(v.m, v.ph, moving || !e.onGround, k);
      else ST.pose(v.p, v.ph, e.state === 'stun' || e.state === 'bonked' || e.state === 'fly' ? 'fall' : !e.onGround ? 'jump' : moving ? 'walk' : 'stand', k);
      if (e.state === 'bonked' || e.state === 'fly') {
        v.spin = (v.spin || 0) + dt * 12 * (e.vx >= 0 ? -1 : 1);
        v.model.rotation.z = v.spin;
        v.model.position.y = 0.6;
      } else { v.model.rotation.z = 0; v.model.position.y = 0; v.spin = 0; }
      if (want - v.rotY > Math.PI) v.rotY += Math.PI * 2;
      if (v.rotY - want > Math.PI) v.rotY -= Math.PI * 2;
      v.rotY = lerp(v.rotY, want, 1 - Math.exp(-10 * dt));
      v.model.rotation.y = v.rotY;
      // the snow mound climbs up the baddy, hit by hit
      const level = e.snow;
      v.mound.visible = level > 0;
      if (level > 0) {
        const h = e.h * (level / 4) * 1.1 + 0.15;
        const shake = e.meltT > 0 ? Math.sin(this.time * 45) * 0.05 : 0;
        v.mound.position.set(shake, h / 2 - 0.05, 0);
        v.mound.scale.set(e.w * 1.25 + level * 0.06, h, 0.95);
        v.model.position.x = shake;
      } else v.model.position.x = 0;
    }

    makeBossView(B) {
      let v;
      if (B.type === 'zombo' || B.type === 'robo') {
        const look = B.type === 'robo' ? BIG_ROBOT_LOOK : null;
        v = this.personView(B.type === 'robo' ? 'bolt' : 'zombie', B.h / 2.05, look);
        v.person = true;
        if (B.type === 'zombo') { const c = A().buildCrown(); c.position.y = 0.33; v.p.head.add(c); }
        else {
          v.flames = [];
          for (const leg of [v.p.legL, v.p.legR]) {
            const fl = mesh(new T.ConeGeometry(0.16, 0.6, 8), new T.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.9 }), 0, -1.1, 0, leg, false);
            fl.rotation.x = Math.PI;
            fl.visible = false;
            v.flames.push(fl);
          }
        }
        v.model = v.p.root;
      } else if (B.type === 'fluff') {
        const m = A().buildYeti();
        v = { g: new T.Group(), m, model: m.root };
        v.g.add(m.root);
      } else {
        const m = A().buildCastle();
        v = { g: new T.Group(), m, model: m.root, castle: true };
        v.g.add(m.root);
      }
      this.scene.add(v.g);
      v.kind = 'boss';
      v.ph = 0;
      v.rotY = -0.5;
      v.stars = this.starRing(v.g, B.h + 0.5, 5, 0.5);
      v.dispose = () => this.scene.remove(v.g);
      return v;
    }

    syncBoss(B, w, dt) {
      if (B.gone) return;
      let v = this.views.get(B.uid);
      if (!v) { v = this.makeBossView(B); this.views.set(B.uid, v); }
      v.seen = true;
      v.g.position.set(B.x, B.y, -0.2);
      const k = 1 - Math.exp(-10 * dt);
      const walking = B.state === 'walk' && B.y <= B.groundY + 0.01;
      v.ph += dt * (walking ? 4 : 2);
      // bosses face the camera three-quarters, turned toward where they walk
      const want = B.face > 0 ? -0.75 : 0.75;
      v.rotY = lerp(v.rotY, Math.PI + want, k);
      v.model.rotation.y = v.rotY;
      const hurt = B.state === 'hurt';
      const down = B.state === 'down';
      v.stars.visible = down;
      v.stars.rotation.y += dt * 4;
      if (v.person) {
        ST.pose(v.p, v.ph, down ? 'dizzy' : hurt ? 'fall' : B.y > B.groundY + 0.05 ? 'jump' : walking ? 'walk' : 'stand', 1 - Math.exp(-12 * dt));
        if (v.flames) for (const f of v.flames) { f.visible = B.vy > 0.5 || B.y > B.groundY + 0.3; f.scale.y = 0.8 + Math.random() * 0.5; }
      } else if (v.m.armL) {
        const s = Math.sin(v.ph);
        v.m.armL.rotation.x = lerp(v.m.armL.rotation.x, hurt ? 2.6 : walking ? -s * 0.6 : 0.8, k);
        v.m.armR.rotation.x = lerp(v.m.armR.rotation.x, hurt ? 2.6 : walking ? s * 0.6 : 0.8, k);
        v.m.legL.rotation.x = walking ? s * 0.5 : 0;
        v.m.legR.rotation.x = walking ? -s * 0.5 : 0;
        v.m.rig.rotation.z = down ? lerp(v.m.rig.rotation.z, 0.5, k) : Math.sin(v.ph * 0.5) * 0.04;
      } else if (v.castle) {
        const s = Math.sin(v.ph);
        v.m.feet[0].position.y = 0.5 + (walking ? Math.max(0, s) * 0.25 : 0);
        v.m.feet[1].position.y = 0.5 + (walking ? Math.max(0, -s) * 0.25 : 0);
        v.m.body.rotation.z = walking ? s * 0.04 : 0;
        v.gateOpen = Math.max(0, (v.gateOpen || 0) - dt);
        v.m.portcullis.position.y = lerp(v.m.portcullis.position.y, v.gateOpen > 0 ? 1.0 : 0, k);
        v.m.rig.rotation.z = down ? lerp(v.m.rig.rotation.z, 0.35, k) : 0;
      }
      // squash on hits, shrink away when beaten
      const squash = hurt ? 1 + Math.sin(B.t * 30) * 0.08 * Math.max(0, 1 - B.t) : 1;
      const gone = down ? clamp(1 - (B.t - 1.8) / 0.8, 0, 1) : 1;
      v.model.scale.set(squash * gone, (2 - squash) * gone, squash * gone);
      if (v.person) v.model.scale.multiplyScalar(B.h / 2.05);
      v.model.visible = !(B.inv > 0 && !down && Math.floor(this.time * 16) % 2 === 0);
      if (down && gone < 1 && !v.poofed) { v.poofed = true; this.parts.burst(B.x, B.y + B.h / 2, { n: 60, color: ['#ffffff', '#ffe14d', '#ff5a5f', '#3fa7f5'], speed: 7, size: 0.5, spread: 2 }); }
    }

    syncGhost(G, dt) {
      let v = this.views.get('ghost');
      if (!v) {
        const m = A().buildGhost();
        v = { g: m.root, m, kind: 'ghost', dispose: () => this.scene.remove(m.root) };
        this.scene.add(m.root);
        this.views.set('ghost', v);
        v.born = this.time;
      }
      v.seen = true;
      v.g.position.set(G.x, G.y + Math.sin(this.time * 2.5) * 0.15, 0.8);
      v.m.rig.rotation.y = Math.sin(this.time * 1.5) * 0.4 + (G.vx > 0 ? -0.4 : 0.4);
      v.m.rig.rotation.z = Math.sin(this.time * 3) * 0.08;
      for (const [i, a] of v.m.arms.entries()) a.rotation.z = (i ? 1 : -1) * (0.5 + Math.sin(this.time * 6 + i) * 0.3);
      v.m.bubble.visible = (this.time - v.born) % 5 < 2.5;
      v.m.mat.opacity = G.scared > 0 ? 0.4 : 0.78;
    }

    syncItem(it) {
      let v = this.views.get(it.uid);
      if (!v) {
        const tex = it.what === 'potion' ? A().potionTexture(it.potion) : emojiTexture(it.emoji);
        const s = A().sprite(tex, it.what === 'potion' ? 0.95 : 0.8);
        this.scene.add(s);
        v = { g: s, kind: 'item', dispose: () => { this.scene.remove(s); s.material.dispose(); } };
        this.views.set(it.uid, v);
      }
      v.seen = true;
      v.g.position.set(it.x, it.y + 0.45 + (it.onGround ? Math.sin(this.time * 4 + it.uid) * 0.08 : 0), 0.6);
      v.g.visible = it.life - it.t > 2 || Math.floor(this.time * 8) % 2 === 0;
    }

    syncShot(s) {
      let v = this.views.get(s.uid);
      if (!v) {
        const spr = A().sprite(A().shotTexture(s.style === 'tommy' ? 'tommy' : 'teddy'), s.r * 2.4);
        this.scene.add(spr);
        v = { g: spr, kind: 'shot', dispose: () => { this.scene.remove(spr); spr.material.dispose(); } };
        if (s.style === 'tommy' && s.vx < 0) spr.material.rotation = 0.25; else if (s.style === 'tommy') spr.material.rotation = -0.25;
        this.views.set(s.uid, v);
      }
      v.seen = true;
      v.g.position.set(s.x, s.y, 0.5);
      if (s.style !== 'tommy') v.g.material.rotation -= Math.sign(s.vx) * 0.25;
      if (Math.random() < 0.5) this.parts.add(s.x - Math.sign(s.vx) * 0.2, s.y, 0.5, { color: '#e8f4ff', vx: -s.vx * 0.05, vy: 0.2, g: 0, life: 0.3, size: s.r * 0.9 });
    }

    // ---- every frame ----
    sync(w, dt) {
      this.time += dt;
      for (const v of this.views.values()) v.seen = false;
      for (const p of w.players) this.syncPlayer(p, w, dt);
      if (w.buddy) this.syncPlayer(w.buddy, w, dt);
      for (const e of w.enemies) this.syncEnemy(e, w, dt);
      if (w.boss) this.syncBoss(w.boss, w, dt);
      if (w.ghost) this.syncGhost(w.ghost, dt);
      for (const it of w.items) this.syncItem(it);
      for (const s of w.shots) this.syncShot(s);
      for (const [k, v] of this.views) {
        if (v.seen) continue;
        if (v.kind === 'player' && v.g.visible) this.parts.burst(v.g.position.x, v.g.position.y + 1, { n: 12, color: '#ffffff', speed: 3 });
        v.dispose && v.dispose();
        this.views.delete(k);
      }
      this.parts.update(dt);
      this.floaters.update(dt);
      if (this.flakes) {
        const F = this.flakes, P = F.pos;
        for (let i = 0; i < F.n; i++) {
          P[i * 3 + 1] -= dt * (0.6 + (F.seed[i] % 1) * 0.6);
          P[i * 3] += Math.sin(this.time * 0.8 + F.seed[i]) * dt * 0.3;
          if (P[i * 3 + 1] < 0) P[i * 3 + 1] += 22;
        }
        F.geo.attributes.position.needsUpdate = true;
      }
      this.updateCamera(w, dt);
    }

    updateCamera(w, dt) {
      const b = this.base;
      let tx = b.x, ty = b.y, tz = b.z, lx = b.x, ly = b.y - 0.55;
      const zoomOn = (w.phase === 'celebrate' || this.zoomTo) && this.allowZoom !== false;
      this.zoom = lerp(this.zoom, zoomOn ? 1 : 0, 1 - Math.exp(-3 * dt));
      if (this.zoom > 0.001) {
        let fx = 0, fy = 0, n = 0;
        const list = this.zoomTo ? [this.zoomTo] : [...w.players, w.buddy].filter((p) => p && p.state !== 'out');
        for (const p of list) { fx += p.x; fy += p.y; n++; }
        if (n) { fx /= n; fy = fy / n + 1.0; }
        const spread = n > 1 ? Math.max(...list.map((p) => Math.abs(p.x - fx))) : 0;
        const z = clamp(9 + spread * 1.6, 9, b.z);
        tx = lerp(tx, fx, this.zoom); ty = lerp(ty, fy + 0.6, this.zoom); tz = lerp(tz, z, this.zoom);
        lx = lerp(lx, fx, this.zoom); ly = lerp(ly, fy, this.zoom);
      }
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.35;
      this.camera.position.set(tx + (Math.random() - 0.5) * s, ty + (Math.random() - 0.5) * s, tz);
      this.camera.lookAt(lx, ly, 0);
      this.camera.updateMatrixWorld();
    }

    render() { this.renderer.render(this.scene, this.camera); }

    // ---- effects for world events ----
    fx(e, w) {
      const P = this.parts, F = this.floaters, art = A();
      const pointsText = (pts, x, y, color = '#ffffff') => F.add(art.textTexture(String(pts), color), x, y, { size: 2.2, aspect: 0.25, life: 0.9, vy: 1.4, z: 1.5 });
      switch (e.t) {
        case 'throw':
          P.burst(e.shot.x, e.shot.y, { n: 4, color: '#ffffff', speed: 1.5, size: 0.2, life: 0.3 });
          break;
        case 'snowHit':
          P.burst(e.x, e.y, { n: 10 + e.s.power * 5, color: ['#ffffff', '#dff0ff'], speed: 3.5, size: 0.3, life: 0.6 });
          if (e.level >= 4) break;
          F.add(art.burstTexture('POOF!', '#dff0ff'), e.x, e.y + 0.3, { size: 0.9, life: 0.35, vy: 0.4, z: 1.4, rot: (Math.random() - 0.5) * 0.4 });
          break;
        case 'poof': case 'fizzle':
          P.burst(e.x, e.y, { n: 7, color: '#ffffff', speed: 2.5, size: 0.25, life: 0.45 });
          break;
        case 'encase':
          P.burst(e.e.x, e.e.y + 0.8, { n: 24, color: ['#ffffff', '#bfe3ff', '#ffe14d'], speed: 4.5, size: 0.35, spread: 0.8 });
          F.add(art.textTexture('SNOWBALL!', '#bfe3ff'), e.e.x, e.e.y + 2.0, { size: 3.4, aspect: 0.25, life: 0.9, vy: 0.8, z: 1.5 });
          break;
        case 'kick':
          F.add(art.burstTexture('KICK!', '#ffb02e'), e.e.x - e.e.dir * 0.4, e.e.y + 1.0, { size: 1.4, life: 0.4, vy: 0.4, z: 1.5 });
          P.burst(e.e.x, e.e.y + 0.3, { n: 14, color: '#ffffff', speed: 3, size: 0.3 });
          break;
        case 'bounce':
          P.burst(e.e.x + e.e.dir * -0.7, e.e.y + 0.7, { n: 10, color: '#ffffff', speed: 3, size: 0.3 });
          F.add(art.burstTexture('BOING!', '#9ff0c8'), e.e.x - e.e.dir * 0.7, e.e.y + 1.4, { size: 0.8, life: 0.35, vy: 0.3, z: 1.5 });
          this.shake = Math.max(this.shake, 0.4);
          break;
        case 'ko':
          F.add(art.burstTexture(e.n > 1 ? 'BONK!' : 'POW!'), e.x, e.y + 0.4, { size: 1.8, life: 0.5, vy: 0.5, z: 1.6, rot: (Math.random() - 0.5) * 0.5 });
          P.burst(e.x, e.y, { n: 18, color: ['#ffe14d', '#ffffff', '#ff8a1f'], speed: 5, size: 0.3 });
          pointsText(e.pts, e.x, e.y + 1.4, e.n > 1 ? '#ffd23f' : '#ffffff');
          this.shake = Math.max(this.shake, 0.5);
          break;
        case 'combo':
          F.add(art.textTexture(`${e.n} COMBO!`, '#ff8ad8'), e.x, e.y + 2.2, { size: 5, aspect: 0.25, life: 1.3, vy: 0.8, z: 1.8 });
          for (let i = 0; i < 3 + e.n * 2; i++) F.add(emojiTexture(['🍦', '🍪', '🍉'][i % 3]), e.x + (Math.random() - 0.5) * 3, e.y + 1 + Math.random(), { size: 0.5, life: 1.0, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 2, g: 8, z: 1.6, pop: false });
          break;
        case 'shatter':
          P.burst(e.x, e.y, { n: 30, color: ['#ffffff', '#dff0ff', '#bfe3ff'], speed: 5.5, size: 0.4, spread: 0.8 });
          F.add(art.burstTexture('CRUNCH!', '#dff0ff'), e.x, e.y + 0.6, { size: 1.6, life: 0.45, vy: 0.4, z: 1.6 });
          break;
        case 'pop':
          P.burst(e.e.x, e.e.y + 0.5, { n: 10, color: ['#ffe14d', '#ffffff'], speed: 3, size: 0.25 });
          break;
        case 'pickup':
          P.burst(e.x, e.y + 0.4, { n: 8, color: '#ffe14d', speed: 2.5, size: 0.22 });
          pointsText(e.pts, e.x, e.y + 1, '#ffd23f');
          break;
        case 'potion':
          P.burst(e.x, e.y + 0.4, { n: 26, color: [ST.POTIONS[e.potion].color, '#ffffff'], speed: 4, size: 0.32 });
          F.add(art.textTexture(e.label, ST.POTIONS[e.potion].color), e.p.x, e.p.y + 2.3, { size: 4, aspect: 0.25, life: 1.2, vy: 0.8, z: 1.8 });
          break;
        case 'dizzy':
          F.add(art.burstTexture('BONK!', '#ffb02e'), e.p.x, e.p.y + 1.5, { size: 1.5, life: 0.5, vy: 0.4, z: 1.6 });
          P.burst(e.p.x, e.p.y + 1.4, { n: 12, color: '#ffe14d', speed: 3, size: 0.25 });
          break;
        case 'saved':
          P.burst(e.p.x, e.p.y + 1, { n: 30, color: ['#ffe14d', '#ffffff', '#ffb02e'], speed: 5, size: 0.35, spread: 0.6 });
          F.add(emojiTexture('🛡️'), e.p.x, e.p.y + 1.9, { size: 0.9, life: 0.9, vy: 0.8, z: 1.7 });
          break;
        case 'tickle':
          F.add(art.textTexture('HEE HEE!', '#ffd23f'), e.p.x, e.p.y + 2.1, { size: 3.2, aspect: 0.25, life: 0.9, vy: 0.6, z: 1.7 });
          break;
        case 'breakFree': case 'free':
          P.burst(e.e.x, e.e.y + 0.7, { n: 22, color: '#ffffff', speed: 4, size: 0.35, spread: 0.6 });
          if (e.t === 'breakFree') F.add(art.textTexture('BRRR!', '#bfe3ff'), e.e.x, e.e.y + 2, { size: 2.6, aspect: 0.25, life: 0.8, vy: 0.6, z: 1.6 });
          break;
        case 'treat': {
          const from = e.from, to = e.to;
          F.add(emojiTexture(e.emoji), from.x + from.face * 0.4, from.y + 1.4, { size: 0.75, life: 0.7, to: { get x() { return to.x; }, get y() { return to.y + 1.3; } }, arc: 1.6, fade: 0.1, z: 1.6 });
          setTimeout(() => { P.burst(to.x, to.y + 1.3, { n: 12, color: ['#ffe14d', '#ffffff'], speed: 2.5, size: 0.25 }); }, 700);
          break;
        }
        case 'buddyHello':
          P.burst(e.b.x, e.b.y + 0.2, { n: 14, color: '#ffffff', speed: 3, size: 0.3 });
          break;
        case 'highfive': {
          const [a, b] = w.players;
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2 + 1.6;
          F.add(emojiTexture('✋'), a.x, a.y + 2.2, { size: 0.9, life: 0.9, vy: 0.5, z: 1.7 });
          F.add(emojiTexture('🤚'), b.x, b.y + 2.2, { size: 0.9, life: 0.9, vy: 0.5, z: 1.7 });
          for (const p of [a, b]) P.burst(p.x, p.y + 1, { n: 30, color: ['#ffe14d', '#ffffff', '#ff8ad8'], speed: 5, size: 0.35 });
          F.add(art.textTexture('HIGH FIVE!', '#ffd23f'), x, y + 0.6, { size: 5, aspect: 0.25, life: 1.2, vy: 0.5, z: 1.8 });
          break;
        }
        case 'balloonPop':
          F.add(art.burstTexture('POP!', '#38d27a'), e.p.x, e.p.y + 2.4, { size: 1.0, life: 0.4, z: 1.6 });
          P.burst(e.p.x, e.p.y + 2.4, { n: 16, color: '#38d27a', speed: 4, size: 0.3 });
          break;
        case 'thump':
          this.shake = Math.max(this.shake, 0.8);
          P.burst(e.boss.x, e.boss.y + 0.2, { n: 24, color: '#ffffff', speed: 4, size: 0.4, spread: e.boss.w, up: 2 });
          break;
        case 'bossSpawn': {
          const v = this.views.get(e.boss.uid);
          if (v) v.gateOpen = 1.0;
          P.burst(e.e.x, e.e.y, { n: 14, color: ['#ffffff', '#ffe14d'], speed: 3, size: 0.3 });
          break;
        }
        case 'bossHit':
          this.shake = Math.max(this.shake, 1.0);
          F.add(art.burstTexture('OOF!', '#ff8a1f'), e.x, e.y + 1.0, { size: 1.8, life: 0.6, vy: 0.5, z: 1.8, rot: -0.2 });
          P.burst(e.x, e.y, { n: 40, color: ['#ffffff', '#ffe14d', '#bfe3ff'], speed: 6, size: 0.45, spread: 1 });
          pointsText(1000, e.x, e.y + 2.2, '#ffd23f');
          break;
        case 'bossDown':
          this.shake = 1.2;
          F.add(art.burstTexture('KA-BONK!', '#ffd23f'), e.boss.x, e.boss.y + e.boss.h * 0.7, { size: 2.6, life: 1.2, vy: 0.3, z: 1.8 });
          break;
        case 'oneUp':
          F.add(art.textTexture('1UP!', '#9ff0c8'), e.p.x, e.p.y + 2.4, { size: 2.6, aspect: 0.25, life: 1.2, vy: 0.8, z: 1.7 });
          break;
        case 'land':
          if (e.p && e.p.vy === 0) P.burst(e.p.x, e.p.y + 0.05, { n: 4, color: '#ffffff', speed: 1.2, size: 0.2, up: 0.5, life: 0.35 });
          break;
        case 'ballLand':
          P.burst(e.e.x, e.e.y + 0.1, { n: 10, color: '#ffffff', speed: 2.5, size: 0.3, up: 1 });
          break;
        case 'ghost':
          P.burst(ST.TUNE.W / 2, ST.TUNE.H - 1, { n: 20, color: '#dff0ff', speed: 3, size: 0.4 });
          break;
      }
    }

    // world position -> page pixels (for HUD bits that follow things)
    toScreen(x, y, z = 0) {
      const v = new T.Vector3(x, y, z).project(this.camera);
      return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
    }
  }

  ST.View = View;
})();
