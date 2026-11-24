/* ANSS — shared behaviour: smart nav + appear-on-scroll */
(() => {
  /* Smart nav: hides on scroll down, returns on scroll up, hides again after 10 s. */
  const nav = document.querySelector(".nav");
  if (nav) {
    const HIDE_AFTER_MS = 10000;
    const TOP_ZONE = 120;
    let lastY = window.scrollY;
    let hover = false;
    let timer = null;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const show = (v) => nav.classList.toggle("is-hidden", !v);
    const schedule = () => {
      clear();
      timer = setTimeout(() => { if (!hover && window.scrollY > TOP_ZONE) show(false); }, HIDE_AFTER_MS);
    };
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) < 4) return;
      if (y <= TOP_ZONE) { clear(); show(true); }
      else if (dy > 0) { clear(); if (!hover) show(false); }
      else { show(true); schedule(); }
      lastY = y;
    }, { passive: true });
    nav.addEventListener("mouseenter", () => { hover = true; show(true); clear(); });
    nav.addEventListener("mouseleave", () => { hover = false; if (window.scrollY > TOP_ZONE) schedule(); });
    nav.addEventListener("focusin", () => show(true));
  }

  /* Appear effect: fade + rise when 20% in view; replays on re-entry. */
  const items = document.querySelectorAll("[data-appear]");
  if (items.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-in", e.isIntersecting);
    }, { threshold: 0.2 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }

  /* Back to top */
  document.querySelectorAll("[data-top]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); })
  );
})();
