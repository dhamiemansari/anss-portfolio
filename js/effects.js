/* ANSS — hero portrait reveal + scroll-fill text (ported from the Framer code components) */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     PortraitReveal: shows the engraving; the pointer paints the real
     photo through a soft brush, which slowly heals back.
     <div class="reveal" data-base="…" data-reveal="…" data-brush="260"
          data-softness="0.55" data-heal="0.008"><img …><canvas></canvas></div>
     ------------------------------------------------------------------ */
  document.querySelectorAll(".reveal").forEach((wrap) => {
    const canvas = wrap.querySelector("canvas");
    const fallback = wrap.querySelector("img");
    const ctx = canvas.getContext("2d");
    const mask = document.createElement("canvas"), mctx = mask.getContext("2d");
    const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
    const erase = document.createElement("canvas"), ectx = erase.getContext("2d");
    let brushSize = +wrap.dataset.brush || 220;
    const softness = +wrap.dataset.softness || 0.55;
    let healSpeed = +wrap.dataset.heal || 0.018;
    let fillAnim = null; // { x, y, t0, ms, done }

    const baseImg = new Image(); baseImg.decoding = "async"; baseImg.src = wrap.dataset.base;
    const img = new Image(); img.decoding = "async"; img.src = wrap.dataset.reveal;

    let w = 0, h = 0, dpr = 1, raf = 0, active = false, last = null;

    const cover = (im) => {
      const iw = im.naturalWidth || 1, ih = im.naturalHeight || 1;
      const s = Math.max(w / iw, h / ih);
      return { dw: iw * s, dh: ih * s, dx: (w - iw * s) / 2, dy: (h - ih * s) / 2 };
    };
    const stamp = (x, y) => {
      const r = brushSize / 2;
      const g = mctx.createRadialGradient(x, y, r * (1 - softness), x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.globalCompositeOperation = "source-over";
      mctx.fillStyle = g;
      mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
    };
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!(baseImg.complete && baseImg.naturalWidth && img.complete && img.naturalWidth)) return;
      const r = cover(img);
      // erase mask = brush minus the real photo's silhouette
      ectx.setTransform(1, 0, 0, 1, 0, 0);
      ectx.globalCompositeOperation = "source-over";
      ectx.clearRect(0, 0, erase.width, erase.height);
      ectx.drawImage(mask, 0, 0);
      ectx.globalCompositeOperation = "destination-out";
      ectx.drawImage(img, r.dx * dpr, r.dy * dpr, r.dw * dpr, r.dh * dpr);
      // engraving, cut away only where the photo has no pixels
      const b = cover(baseImg);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(baseImg, b.dx * dpr, b.dy * dpr, b.dw * dpr, b.dh * dpr);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(erase, 0, 0);
      // real photo, only inside the brushed area
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.drawImage(img, r.dx * dpr, r.dy * dpr, r.dw * dpr, r.dh * dpr);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(layer, 0, 0);
      if (fallback) fallback.style.visibility = "hidden";
    };
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width)); h = Math.max(1, Math.round(rect.height));
      for (const c of [canvas, mask, layer, erase]) { c.width = w * dpr; c.height = h * dpr; }
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const loop = (now) => {
      if (healSpeed > 0) {
        mctx.globalCompositeOperation = "destination-out";
        mctx.fillStyle = "rgba(0,0,0," + healSpeed + ")";
        mctx.fillRect(0, 0, w, h);
      }
      if (fillAnim) {
        // flood the real photo outwards from (x, y)
        const f = fillAnim;
        if (f.t0 == null) f.t0 = now;
        const p = Math.min(1, (now - f.t0) / f.ms);
        const e = 1 - Math.pow(1 - p, 3);
        const far = Math.hypot(Math.max(f.x, w - f.x), Math.max(f.y, h - f.y)) + brushSize;
        mctx.globalCompositeOperation = "source-over";
        mctx.fillStyle = "#000";
        mctx.beginPath(); mctx.arc(f.x, f.y, Math.max(1, far * e), 0, Math.PI * 2); mctx.fill();
        if (p >= 1) { fillAnim = null; if (f.done) f.done(); }
      }
      draw();
      // once healing is off and nothing is animating, the frame is static
      raf = healSpeed > 0 || fillAnim ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (last) {
        const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / (brushSize * 0.15)));
        for (let i = 1; i <= steps; i++) stamp(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      } else stamp(x, y);
      last = { x, y }; active = true; kick();
    };
    img.onload = draw;
    baseImg.onload = draw;
    new ResizeObserver(resize).observe(wrap);
    resize();
    // Pause the heal loop while the hero is off-screen
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (e.isIntersecting && active) kick();
    }).observe(wrap);
    // Hooks for the eraser cursor (js/eraser.js)
    wrap.revealApi = {
      get brush() { return brushSize; },
      setBrush(v) { brushSize = v; },
      setHeal(v) { healSpeed = v; },
      fill(x, y, ms, done) { fillAnim = { x, y, ms, done, t0: null }; active = true; kick(); },
    };
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerdown", onMove);
    wrap.addEventListener("pointerleave", () => { last = null; });
  });

  /* ------------------------------------------------------------------
     ScrollFillText: characters fill in as you scroll, with a lively
     leading band that tilts and scales. Pins with a sticky ancestor.
     <p class="scroll-fill" data-unread="…" data-lead="…" data-band="10"
        data-scale="1.12" data-rotate="2.6">
       <span data-color="#fff">text…</span>…
     </p>
     ------------------------------------------------------------------ */
  const parse = (c) => {
    const s = (c || "").trim();
    if (s.startsWith("#")) {
      let h = s.slice(1);
      if (h.length === 3) h = h.split("").map((x) => x + x).join("");
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(",").map(parseFloat); return [p[0] || 0, p[1] || 0, p[2] || 0, isNaN(p[3]) ? 1 : p[3]]; }
    return [0, 0, 0, 1];
  };
  const mix = (a, b, t) => "rgba(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + "," + (a[3] + (b[3] - a[3]) * t).toFixed(3) + ")";
  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  document.querySelectorAll(".scroll-fill").forEach((root) => {
    const unreadC = root.dataset.unread || "rgba(10,10,10,0.14)";
    const unread = parse(unreadC), lead = parse(root.dataset.lead || "#FFB094");
    const band = +root.dataset.band || 10;
    const maxScale = +root.dataset.scale || 1.12;
    const maxRotate = +root.dataset.rotate || 2.6;

    // Split segments into per-character spans, grouped into words
    const segs = [...root.querySelectorAll("[data-color]")].map((s) => ({ text: s.textContent, color: s.dataset.color }));
    const label = segs.map((s) => s.text).join("");
    root.textContent = "";
    root.setAttribute("aria-label", label);
    const chars = [], targets = [];
    let word = null;
    const newWord = () => { word = document.createElement("span"); word.className = "w"; word.setAttribute("aria-hidden", "true"); root.appendChild(word); };
    newWord();
    for (const seg of segs) for (const ch of Array.from(seg.text)) {
      if (ch === " ") { root.appendChild(document.createTextNode(" ")); newWord(); continue; }
      const sp = document.createElement("span");
      sp.className = "c"; sp.textContent = ch;
      sp.style.color = reduce ? seg.color : unreadC;
      word.appendChild(sp); chars.push(sp); targets.push(parse(seg.color));
    }
    if (reduce) return;

    const count = chars.length;
    const rot = targets.map((_, i) => ((((i * 9301 + 49297) % 233280) / 233280) * 2 - 1) * maxRotate);
    const lastT = new Float32Array(count).fill(-1);
    let sticky = null;
    const findSticky = () => {
      sticky = null;
      let p = root.parentElement;
      for (let k = 0; k < 14 && p; k++) { if (getComputedStyle(p).position === "sticky") { sticky = p; break; } p = p.parentElement; }
    };
    const getTarget = () => {
      const vh = window.innerHeight;
      if (sticky && sticky.parentElement) {
        const pr = sticky.parentElement.getBoundingClientRect();
        const range = pr.height - sticky.offsetHeight;
        if (range > 40) return clamp(-pr.top / range);
      }
      const r = root.getBoundingClientRect();
      return clamp((vh * 0.85 - r.top) / (r.height + vh * 0.4));
    };
    findSticky();
    let cur = getTarget(), target = cur, raf = 0;
    const paint = () => {
      const head = cur * (count + band);
      for (let i = 0; i < count; i++) {
        const el = chars[i];
        const t = clamp((head - i) / band);
        if (t === lastT[i]) continue;
        lastT[i] = t;
        if (t <= 0) { el.style.color = mix(unread, unread, 0); el.style.transform = "none"; el.style.textShadow = "none"; continue; }
        if (t >= 1) { el.style.color = mix(targets[i], targets[i], 0); el.style.transform = "none"; el.style.textShadow = "none"; continue; }
        el.style.color = t < 0.18 ? mix(unread, lead, t / 0.18) : mix(lead, targets[i], (t - 0.18) / 0.82);
        const bell = Math.sin(Math.PI * t);
        el.style.transform = "rotate(" + (rot[i] * bell).toFixed(2) + "deg) scale(" + (1 + (maxScale - 1) * bell).toFixed(3) + ")";
        el.style.textShadow = (0.6 * bell).toFixed(2) + "px " + (0.6 * bell).toFixed(2) + "px 0 rgba(0,0,0," + (0.22 * bell).toFixed(2) + ")";
      }
    };
    const tick = () => {
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      paint();
      raf = cur === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => { target = getTarget(); if (!raf) raf = requestAnimationFrame(tick); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { findSticky(); onScroll(); });
  });
})();
