/* ANSS — eraser cursor for the hero portrait (desktop / mouse only)
   ---------------------------------------------------------------------
   A little eraser character replaces the cursor over the portrait.
   Rubbing reveals the real photo (js/effects.js does the painting); the
   eraser's own hair wears off in 6 stages and sheds black crumbs that fall
   and dissolve. At stage 6 he's bald, the photo fills in by itself, he
   bounces and stands up — "oops, sorry dude" — then goes back to rubbing.
   He talks: says hi, nudges idle visitors, reacts to every hair he loses,
   begs you to come back, and panics if you rub too fast ("slow down!").
   Optional sound (off by default, 🔊 button): a real rubbing sound
   (assets/audio/eraser-rub.mp3, looped, louder/faster as you rub faster)
   plus synthesized pops, boings and a gibberish voice.

   <div class="hero__portrait reveal" data-eraser="/assets/img/eraser/eraser-{n}.webp"
        data-eraser-brush="190" …>
   --------------------------------------------------------------------- */
(() => {
  const wrap = document.querySelector(".reveal[data-eraser]");
  if (!wrap || !wrap.revealApi) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const api = wrap.revealApi;

  /* ---------- config ---------- */
  const STAGES = 6;
  const THRESHOLDS = [0.07, 0.15, 0.23, 0.32, 0.42]; // photo coverage that triggers stage 2…6
  const SPRITE_W = 200, SPRITE_H = 332;               // eraser-{n}.webp natural size
  const CONTACT = { x: 0.5, y: 0.045 };               // rubbing point (top of the head), sprite-relative
  const RUB_ANGLE = -115;                             // head down-left, body up-right (as held in the hand)
  const HAIR = "#262526";
  const MAX_CRUMBS = 220;
  const GRAVITY = 0.35;                               // px / frame²
  const FAST = 2.2;                                   // px/ms — rubbing faster than this annoys him
  const PANIC_MS = 260, SAY_COOLDOWN = 3800, SAY_MS = 2200;
  const LINES = [
    "whoa whoa WHOA — slow down!",
    "easy! I'm rubber, not a race car",
    "ow ow ow — my head!",
    "I'm getting dizzy here…",
    "not so fast, buddy!",
    "hey! gentle, please",
    "my hair! MY HAIR!",
    "is that smoke?! slow down!",
  ];
  const LAST_STRAW = "okay that's it, I quit!… kidding. slower?";
  // everyday chatter, so the joke lands even for gentle visitors
  const SAY = {
    hello: ["oh hey! rub the photo, I dare you", "psst — the real me is under here", "hi! I'm the eraser. let's do this"],
    still: ["go on, I don't bite", "rub rub rub! come on", "hello? I'm waiting…"],
    leave: ["wait, come back!", "hey, we weren't done!", "fine. I'll just wait here…"],
    idle: ["psst… scratch the photo", "*whistles*", "so… bored…", "anyone? rub the photo?"],
    bald: ["I'm already bald, buddy", "there's nothing left to give!", "okay okay, you win"],
  };
  const STAGE_SAY = { 2: "hehe, that tickles", 3: "wait… is my hair coming off?", 4: "it's getting breezy up here", 5: "not the last few strands!!" };
  const CHAT_GAP = 3200;   // min ms between any two lines
  const src = (n) => wrap.dataset.eraser.replace("{n}", n);
  const eraserBrush = +wrap.dataset.eraserBrush || 190;

  /* ---------- DOM ---------- */
  const el = document.createElement("div");
  el.className = "eraser";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<div class="eraser__body"><img alt="" draggable="false"></div>' +
    '<p class="eraser__note">oops, sorry dude</p>' +
    '<p class="eraser__say"></p>';
  document.body.appendChild(el);
  const body = el.querySelector(".eraser__body");
  const sprite = body.querySelector("img");
  const note = el.querySelector(".eraser__note");
  const say = el.querySelector(".eraser__say");
  for (let i = 1; i <= STAGES; i++) { const im = new Image(); im.src = src(i); }
  sprite.src = src(1);

  const crumbCv = document.createElement("canvas");
  crumbCv.className = "reveal__crumbs";
  crumbCv.setAttribute("aria-hidden", "true");
  wrap.appendChild(crumbCv);
  const cctx = crumbCv.getContext("2d");

  /* ---------- sound (off until the visitor turns it on) ---------- */
  const sfx = (() => {
    const KEY = "anss-eraser-sound";
    let ac = null, out = null, on = false;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "eraser-sound";
    const label = () => {
      btn.textContent = on ? "🔊 sound on" : "🔈 sound off";
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", on ? "Turn eraser sounds off" : "Turn eraser sounds on");
    };
    const RUB_SRC = "/assets/audio/eraser-rub.mp3";
    const RUB_LOOP = [0.12, 1.95];   // seconds of steady rubbing inside the file
    let rubBuf = null, rubSrc = null, rubGain = null, rubIdle = 0;
    const loadRub = () => {
      if (rubBuf) return;
      fetch(RUB_SRC).then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
        .then((buf) => { rubBuf = buf; })
        .catch(() => {});
    };
    const start = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ac = new AC(); out = ac.createGain(); out.gain.value = 0.16; out.connect(ac.destination);
        loadRub();
      }
      if (ac.state === "suspended") ac.resume();
      return true;
    };
    // keep clicks on the button from painting/rubbing the portrait underneath
    ["pointerdown", "pointermove"].forEach((ev) => btn.addEventListener(ev, (e) => e.stopPropagation()));
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      on = !on && start();
      if (!on) api.rubStop(true);
      try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (_) {}
      label();
      if (on) api.blip("hi!");
    });
    // a visitor who turned sound on before gets it back after their first click on the page
    let wanted = false; try { wanted = localStorage.getItem(KEY) === "1"; } catch (_) {}
    if (wanted) {
      const resume = (e) => {
        if (btn.contains(e.target)) return;           // the button's own click handles itself
        window.removeEventListener("pointerdown", resume, true);
        if (!on && start()) { on = true; label(); }
      };
      window.addEventListener("pointerdown", resume, true);
    }
    label();
    wrap.appendChild(btn);

    const t = () => ac.currentTime;
    const env = (g, at, peak, len) => {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.012, len / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    };
    const tone = (type, f0, f1, len, peak, at = t()) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, at);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + len);
      env(g, at, peak, len); o.connect(g).connect(out); o.start(at); o.stop(at + len + 0.02);
      return o;
    };
    let noiseBuf = null;
    const noise = (len, fFrom, fTo, peak, at = t()) => {
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      n.buffer = noiseBuf; f.type = "bandpass"; f.Q.value = 1.4;
      f.frequency.setValueAtTime(fFrom, at); f.frequency.exponentialRampToValueAtTime(fTo, at + len);
      env(g, at, peak, len); n.connect(f).connect(g).connect(out); n.start(at); n.stop(at + len + 0.02);
    };
    const api = {
      btn,
      get on() { return on; },
      // real eraser sound: loops while rubbing; volume and pitch follow speed
      rub(speed) {
        if (!on || !rubBuf) return;
        const now = t();
        if (!rubSrc) {
          rubSrc = ac.createBufferSource(); rubGain = ac.createGain();
          rubSrc.buffer = rubBuf; rubSrc.loop = true;
          rubSrc.loopStart = RUB_LOOP[0]; rubSrc.loopEnd = RUB_LOOP[1];
          rubGain.gain.value = 0.0001;
          rubSrc.connect(rubGain).connect(ac.destination);
          rubSrc.start(now, rand(RUB_LOOP[0], RUB_LOOP[1] - 0.2));
        }
        const level = Math.min(1, 0.25 + speed / 1.6) * 0.9;
        rubGain.gain.setTargetAtTime(level, now, 0.03);
        rubSrc.playbackRate.setTargetAtTime(0.85 + Math.min(speed, 3) * 0.12, now, 0.05);
        clearTimeout(rubIdle);
        rubIdle = setTimeout(() => api.rubStop(), 110);
      },
      rubStop(now) {
        clearTimeout(rubIdle);
        if (!rubSrc) return;
        const src = rubSrc, g = rubGain;
        rubSrc = rubGain = null;
        g.gain.setTargetAtTime(0.0001, t(), now ? 0.01 : 0.06);
        src.stop(t() + (now ? 0.05 : 0.35));
      },
      // synthesized rubber squeak (fallback, unused while the recorded sound is available)
      squeak(speed) {
        if (!on) return;
        const f = 480 + Math.min(speed, 4) * 260 + rand(-40, 40);
        const o = tone("triangle", f, f * rand(1.08, 1.25), 0.07, 0.22);
        const v = ac.createOscillator(), vg = ac.createGain();
        v.frequency.value = 38; vg.gain.value = f * 0.03; v.connect(vg).connect(o.frequency); v.start(); v.stop(t() + 0.09);
      },
      pop() { if (on) { tone("sine", 520, 1250, 0.09, 0.5); noise(0.05, 2500, 1200, 0.15); } },
      boing(big = true) {
        if (!on) return;
        const len = big ? 0.5 : 0.32, o = tone("sine", big ? 330 : 420, big ? 150 : 260, len, 0.45);
        const v = ac.createOscillator(), vg = ac.createGain();
        v.frequency.value = 22; vg.gain.setValueAtTime(60, t()); vg.gain.exponentialRampToValueAtTime(4, t() + len);
        v.connect(vg).connect(o.frequency); v.start(); v.stop(t() + len);
      },
      whoosh() { if (on) noise(0.9, 350, 2600, 0.35); },
      uhoh() { if (on) { tone("triangle", 560, 540, 0.16, 0.35); tone("triangle", 420, 380, 0.26, 0.35, t() + 0.2); } },
      // gibberish voice: one squeaky blip per syllable
      blip(text, excited = false) {
        if (!on) return;
        const syl = (text.toLowerCase().match(/[aeiouy]+/g) || ["a"]).slice(0, 14);
        const base = excited ? 640 : 520, step = excited ? 0.075 : 0.095;
        let at = t() + 0.02;
        syl.forEach((v, i) => {
          const wob = (v.charCodeAt(0) % 5) * 22 + rand(-25, 25);
          const f = base + wob + (i === syl.length - 1 ? (text.trim().endsWith("?") ? 120 : -60) : 0);
          tone("square", f, f * rand(0.92, 1.06), step * 0.8, 0.07, at);
          tone("triangle", f * 2, f * 2, step * 0.6, 0.05, at);
          at += step + rand(0, 0.025);
        });
      },
    };
    return api;
  })();

  wrap.classList.add("is-eraser");
  api.setBrush(eraserBrush);

  /* ---------- sizing ---------- */
  let DW = 96, DH = 160, dpr = 1, pw = 1, ph = 1;
  const sizeUp = () => {
    const r = wrap.getBoundingClientRect();
    pw = Math.max(1, r.width); ph = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    DW = Math.round(Math.min(100, Math.max(70, ph * 0.105)));
    DH = Math.round(DW * SPRITE_H / SPRITE_W);
    el.style.setProperty("--ew", DW + "px");
    el.style.setProperty("--eh", DH + "px");
    body.style.left = -CONTACT.x * DW + "px";
    body.style.top = -CONTACT.y * DH + "px";
    body.style.transformOrigin = CONTACT.x * DW + "px " + CONTACT.y * DH + "px";
    // sound button sits just above the part of the portrait the hero shows
    const heroEl = wrap.closest(".hero");
    const visH = heroEl ? Math.min(ph, heroEl.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top) : ph;
    sfx.btn.style.top = Math.max(14, visH - 52) + "px";
    crumbCv.width = pw * dpr; crumbCv.height = ph * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildSilhouette();
    drawCrumbs();
  };

  /* ---------- coverage grid (only cells where the real photo has pixels count) ---------- */
  const GX = 64, GY = 48;
  const touched = new Uint8Array(GX * GY);
  let inside = null, insideCount = 0;
  const photo = new Image(); photo.src = wrap.dataset.reveal;
  const buildSilhouette = () => {
    if (!photo.complete || !photo.naturalWidth) return;
    const c = document.createElement("canvas"); c.width = GX; c.height = GY;
    const x = c.getContext("2d", { willReadFrequently: true });
    const s = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
    const dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
    x.drawImage(photo, ((pw - dw) / 2) * GX / pw, ((ph - dh) / 2) * GY / ph, dw * GX / pw, dh * GY / ph);
    const a = x.getImageData(0, 0, GX, GY).data;
    // ignore the part of the portrait the hero clips off (it can never be rubbed)
    const hero = wrap.closest(".hero"), wr = wrap.getBoundingClientRect();
    const clipRows = hero ? Math.ceil(((hero.getBoundingClientRect().bottom - wr.top) / ph) * GY) : GY;
    inside = new Uint8Array(GX * GY); insideCount = 0;
    for (let i = 0; i < GX * GY; i++) if (a[i * 4 + 3] > 120 && ((i / GX) | 0) < clipRows) { inside[i] = 1; insideCount++; }
    if (insideCount < 20) { inside.fill(1); insideCount = GX * GY; } // opaque photo → whole frame
  };
  photo.addEventListener("load", () => { buildSilhouette(); });
  const coverage = () => {
    if (!inside) return 0;
    let n = 0;
    for (let i = 0; i < GX * GY; i++) if (inside[i] && touched[i]) n++;
    return n / insideCount;
  };
  const touch = (x, y) => {
    const r = eraserBrush * 0.36;
    const cw = pw / GX, ch = ph / GY;
    const x0 = Math.max(0, Math.floor((x - r) / cw)), x1 = Math.min(GX - 1, Math.floor((x + r) / cw));
    const y0 = Math.max(0, Math.floor((y - r) / ch)), y1 = Math.min(GY - 1, Math.floor((y + r) / ch));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const cx = (gx + 0.5) * cw - x, cy = (gy + 0.5) * ch - y;
      if (cx * cx + cy * cy <= r * r) touched[gy * GX + gx] = 1;
    }
  };

  /* ---------- crumbs ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const makeShape = () => {
    const n = 3 + ((Math.random() * 4) | 0), pts = [[0, 0]];
    let ang = rand(0, Math.PI * 2), x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      ang += rand(-1.1, 1.1);
      const step = rand(2.6, 4.8);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step; pts.push([x, y]);
    }
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { pts: pts.map((p) => [p[0] - mx, p[1] - my]), w: rand(3, 4.6) };
  };
  const paintCrumb = (ctx, c, x, y, rot, alpha = 1, scale = 1) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    c.shape.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = HAIR; ctx.lineWidth = c.shape.w; ctx.stroke();
    ctx.translate(-0.5, -0.6);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = c.shape.w * 0.32; ctx.stroke();
    ctx.restore();
  };
  // Crumbs never rest: each gets a small sideways push away from the stroke,
  // falls under gravity while spinning slowly, and fades + shrinks to ~60%
  // over 0.6–1.2 s before it is removed.
  let crumbs = [];          // portrait coords
  const spawnCrumb = (x, y, dx, dy, burst) => {
    const side = burst ? rand(-1, 1) : -Math.sign(dx || rand(-1, 1));
    crumbs.push({
      shape: makeShape(), x, y,
      vx: side * (burst ? rand(0.8, 2.4) : rand(0.5, 1.6)),
      vy: burst ? rand(-2.2, -0.6) : rand(-0.6, 0.2),
      rot: rand(0, Math.PI * 2), vr: rand(0.02, 0.07) * (Math.random() < 0.5 ? -1 : 1),
      born: performance.now(), life: rand(600, 1200), a: 1, s: 1,
    });
    if (crumbs.length > MAX_CRUMBS) crumbs.shift();
    wake();
  };
  const drawCrumbs = () => {
    cctx.clearRect(0, 0, pw, ph);
    for (const c of crumbs) paintCrumb(cctx, c, c.x, c.y, c.rot, c.a, c.s);
  };

  /* ---------- eraser transform helpers ---------- */
  const st = {
    x: 0, y: 0, tx: 0, ty: 0,          // contact point, client coords (current / target)
    ang: 0, tang: 0, sq: 0,
    vx: 0, vy: 0,
    over: false, shown: false, stage: 1, done: false, pose: "park",
    lastX: null, lastY: null, travel: 0,
    lastT: 0, speed: 0, rage: 0, shake: 0, saidAt: -1e9, panicAt: -1e9, said: 0, lastLine: -1,
    greeted: false, rubbedAt: 0, stillSaidAt: -1e9, idleSaid: 0, baldSaidAt: -1e9, leaveSaidAt: -1e9,
  };
  const parkSpot = () => {
    const r = wrap.getBoundingClientRect();
    const hero = wrap.closest(".hero") || wrap;
    const visBottom = Math.min(r.bottom, hero.getBoundingClientRect().bottom, window.innerHeight);
    return { x: r.left + r.width * 0.8, y: Math.max(r.top + 40, visBottom - DH - 150) };
  };

  /* ---------- stages ---------- */
  const setStage = (n) => {
    if (n <= st.stage) return;
    st.stage = n;
    sprite.src = src(n);
    sfx.pop();
    if (!reduce) {
      sprite.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.14, 0.9)" }, { transform: "scale(0.95, 1.06)" }, { transform: "scale(1)" }],
        { duration: 420, easing: "cubic-bezier(.3,.7,.4,1)" }
      );
      const r = wrap.getBoundingClientRect();
      for (let i = 0; i < 9; i++) spawnCrumb(st.x - r.left, st.y - r.top, rand(-1, 1), rand(-1, 1), true);
    }
    if (n === STAGES) finale();
    else if (STAGE_SAY[n]) setTimeout(() => speak(STAGE_SAY[n], n >= 4, 1200), 180);
  };

  /* ---------- finale: bald → fill → bounce + stand → note → rub ---------- */
  const finale = () => {
    st.done = true;
    const r = wrap.getBoundingClientRect();
    const fx = st.x - r.left, fy = st.y - r.top;
    setTimeout(() => {
      api.setHeal(0);
      sfx.whoosh();
      api.fill(fx, fy, reduce ? 1 : 1100, showNote);
    }, reduce ? 0 : 380);
  };
  const showNote = () => {
    // small bounce, then stand upright for ~2.6 s
    st.pose = "stand";
    sfx.boing(false);
    if (!reduce) {
      sprite.animate(
        [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(4px) scale(1.08, 0.92)", offset: 0.18 },
          { transform: "translateY(-16px) scale(0.96, 1.05)", offset: 0.5 },
          { transform: "translateY(2px) scale(1.04, 0.96)", offset: 0.8 },
          { transform: "translateY(0) scale(1)" },
        ],
        { duration: 560, easing: "ease-out" }
      );
    }
    wake();
    setTimeout(() => {
      note.classList.add("is-on");
      sfx.uhoh();
      setTimeout(() => sfx.blip("oops, sorry dude"), 480);
      setTimeout(() => { st.pose = st.over ? "rub" : "park"; wake(); }, 600);
      setTimeout(() => note.classList.remove("is-on"), 3200);
    }, 2600);
  };

  /* ---------- chatter ---------- */
  let sayTimer = 0;
  const lastPick = {};
  const pick = (bank) => {
    const list = SAY[bank];
    let i; do { i = (Math.random() * list.length) | 0; } while (i === lastPick[bank] && list.length > 1);
    lastPick[bank] = i; return list[i];
  };
  // gap = how long since the last line before this one may interrupt
  const speak = (line, excited = false, gap = CHAT_GAP) => {
    if (note.classList.contains("is-on") || performance.now() - st.saidAt < gap) return false;
    st.saidAt = performance.now();
    say.textContent = line;
    say.classList.remove("is-on"); void say.offsetWidth; say.classList.add("is-on");
    if (excited) sfx.boing();
    setTimeout(() => sfx.blip(line, excited), excited ? 220 : 60);
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => say.classList.remove("is-on"), SAY_MS + line.length * 18);
    if (!reduce) {
      sprite.animate(
        excited
          ? [{ transform: "rotate(0)" }, { transform: "rotate(-9deg) scale(1.05)" }, { transform: "rotate(8deg)" },
             { transform: "rotate(-6deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0)" }]
          : [{ transform: "translateY(0)" }, { transform: "translateY(-6px) scale(1.03, 0.98)" }, { transform: "translateY(0)" }],
        { duration: excited ? 520 : 320, easing: "ease-out" }
      );
    }
    return true;
  };
  // "don't move so fast!"
  const complain = () => {
    st.said++; st.rage = 0;
    let line;
    if (st.said % 5 === 0) line = LAST_STRAW;
    else {
      let i; do { i = (Math.random() * LINES.length) | 0; } while (i === st.lastLine && LINES.length > 1);
      st.lastLine = i; line = LINES[i];
    }
    speak(line, true, 0);
  };

  /* ---------- pointer ---------- */
  const onMove = (e) => {
    st.tx = e.clientX; st.ty = e.clientY;
    if (!st.over) { st.over = true; if (st.pose === "park") st.pose = "rub"; }
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (st.lastX != null) {
      const dx = x - st.lastX, dy = y - st.lastY, d = Math.hypot(dx, dy);
      // how fast is the rubbing? (smoothed px/ms)
      const dt = Math.max(1, Math.min(80, e.timeStamp - st.lastT));
      st.speed = st.speed * 0.6 + (d / dt) * 0.4;
      if (st.speed > FAST && st.pose === "rub") st.rage += dt;
      else st.rage = Math.max(0, st.rage - dt * 0.5);
      if (st.rage > PANIC_MS && performance.now() - st.panicAt > SAY_COOLDOWN && !note.classList.contains("is-on")) { st.panicAt = performance.now(); complain(); }
      // fill the gap between events so fast strokes count fully
      const steps = Math.max(1, Math.ceil(d / 12));
      for (let i = 1; i <= steps; i++) touch(st.lastX + (dx * i) / steps, st.lastY + (dy * i) / steps);
      if (d > 0.5) {
        sfx.rub(st.speed);
        st.rubbedAt = performance.now();
        // still rubbing after he went bald
        if (st.done && st.pose === "rub" && performance.now() - st.baldSaidAt > 14000 && speak(pick("bald"))) st.baldSaidAt = performance.now();
      }
      if (!st.done && !reduce) {
        st.travel += d;
        while (st.travel > 22) { st.travel -= 22; spawnCrumb(x + rand(-6, 6), y + rand(-6, 6), dx, dy, false); }
      }
    } else touch(x, y);
    st.lastX = x; st.lastY = y; st.lastT = e.timeStamp;
    if (!st.done) {
      const cov = coverage();
      let n = 1;
      THRESHOLDS.forEach((t, i) => { if (cov >= t) n = i + 2; });
      if (n > st.stage) for (let k = st.stage + 1; k <= n; k++) setStage(k);
    }
    wake();
  };
  let stillTimer = 0;
  wrap.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!st.shown) { st.x = e.clientX; st.y = e.clientY; }
    onMove(e);
    if (!st.greeted) { st.greeted = true; setTimeout(() => { if (st.over) speak(pick("hello"), false, 0); }, 450); }
  });
  // hovering the photo but not rubbing → nudge (at most every 12 s)
  wrap.addEventListener("pointermove", () => {
    clearTimeout(stillTimer);
    stillTimer = setTimeout(() => {
      if (st.over && st.pose === "rub" && performance.now() - st.stillSaidAt > 12000 && speak(pick("still"))) st.stillSaidAt = performance.now();
    }, 2600);
  });
  wrap.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") onMove(e); });
  wrap.addEventListener("pointerleave", () => {
    clearTimeout(stillTimer);
    // left in the middle of rubbing → "wait, come back!" (sometimes)
    if (!st.done && performance.now() - st.rubbedAt < 900 && performance.now() - st.leaveSaidAt > 15000 && Math.random() < 0.6) {
      st.leaveSaidAt = performance.now(); setTimeout(() => speak(pick("leave"), false, 1200), 250);
    }
    st.over = false; st.lastX = null; st.rage = 0; st.speed = 0;
    sfx.rubStop();
    if (st.pose === "rub") st.pose = "park";
    wake();
  });

  /* ---------- animation loop (runs only while something moves) ---------- */
  let raf = 0, visible = true;
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
  const tick = (now) => {
    raf = 0;
    let busy = false;

    // target position + angle for the current pose
    if (st.pose === "park") {
      const p = parkSpot(); st.tx = p.x; st.ty = p.y;
      st.tang = reduce ? 0 : Math.sin(now / 600) * 3; busy = !reduce;
    } else if (st.pose === "stand") {
      st.tang = 0;
    } else {
      const lean = Math.max(-14, Math.min(14, st.vx * 0.9));
      st.tang = RUB_ANGLE + (reduce ? 0 : lean);
    }
    // position: snappy on the cursor, softer when travelling to/from the park spot
    const k = st.over ? 0.55 : 0.16;
    const px = st.x, py = st.y;
    st.x += (st.tx - st.x) * k; st.y += (st.ty - st.y) * k;
    st.vx = st.vx * 0.7 + (st.x - px) * 0.3; st.vy = st.vy * 0.7 + (st.y - py) * 0.3;
    st.ang += (st.tang - st.ang) * (reduce ? 1 : 0.2);
    const speed = Math.hypot(st.vx, st.vy);
    st.sq += ((reduce || st.pose !== "rub" ? 0 : Math.min(speed / 45, 1) * 0.08) - st.sq) * 0.3;
    if (Math.abs(st.tx - st.x) > 0.3 || Math.abs(st.ty - st.y) > 0.3 || Math.abs(st.tang - st.ang) > 0.2 || st.sq > 0.002) busy = true;

    // panic shake while he's being rubbed too fast
    const panic = !reduce && st.pose === "rub" && st.over ? Math.min(1, st.rage / PANIC_MS) : 0;
    st.shake += (panic - st.shake) * 0.25;
    if (st.shake > 0.02) busy = true;
    const jx = st.shake ? rand(-1, 1) * st.shake * 2.5 : 0, jy = st.shake ? rand(-1, 1) * st.shake * 2.5 : 0;
    const ja = st.shake ? rand(-1, 1) * st.shake * 5 : 0;

    el.style.transform = "translate3d(" + (st.x + jx).toFixed(1) + "px," + (st.y + jy).toFixed(1) + "px,0)";
    body.style.transform = "rotate(" + (st.ang + ja).toFixed(2) + "deg) scale(" + (1 + st.sq * 0.6).toFixed(3) + "," + (1 - st.sq).toFixed(3) + ")";
    if (!st.shown) { st.shown = true; el.classList.add("is-on"); }

    // falling, fading crumbs
    if (crumbs.length) {
      crumbs = crumbs.filter((c) => {
        const t = (now - c.born) / c.life;
        if (t >= 1) return false;
        c.vy += GRAVITY;
        c.x += c.vx; c.y += c.vy; c.rot += c.vr;
        c.vx *= 0.98;
        c.a = 1 - t;
        c.s = 1 - 0.4 * t;
        return true;
      });
      drawCrumbs();
      busy = true;
    }
    if (busy) wake();
  };

  new ResizeObserver(sizeUp).observe(wrap);
  sizeUp();
  window.addEventListener("scroll", wake, { passive: true });
  // parked and nobody's playing → an occasional nudge (max 3 per visit)
  setInterval(() => {
    if (!visible || st.over || st.pose !== "park" || st.idleSaid >= 3 || document.hidden) return;
    if (performance.now() - Math.max(st.saidAt, st.rubbedAt) < 9000) return;
    if (speak(pick("idle"))) st.idleSaid++;
  }, 1500);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    el.style.visibility = visible ? "" : "hidden";
    if (visible) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(wrap);
  const p0 = parkSpot(); st.x = st.tx = p0.x; st.y = st.ty = p0.y;
  wake();
})();
