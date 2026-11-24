/* ANSS — case study: section-nav scroll-spy on #cs-* sections */
(() => {
  const links = [...document.querySelectorAll(".sec-nav a[href*='#cs-']")];
  if (!links.length) return;
  const sections = links
    .map((a) => document.getElementById(a.hash.slice(1)))
    .filter(Boolean);
  let current = null;

  const update = () => {
    const line = window.innerHeight * 0.3;
    let active = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) active = s;
    if (active === current) return;
    current = active;
    links.forEach((a) => {
      const on = a.hash === "#" + active.id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  };

  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
