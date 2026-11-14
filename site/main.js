// Motion for the WA Export website. Everything on the page is readable without this file: hidden
// starting states in style.css only apply once the "js" class below is on <html>.
document.documentElement.classList.add("js");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades sections in as they scroll into view, and types the ZIP tree out line by line. */
function revealOnScroll() {
  const targets = [...document.querySelectorAll(".reveal, .tree")];
  document.querySelectorAll(".tree .ln").forEach((line, i) => (line.style.transitionDelay = `${i * 90}ms`));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("on"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("on");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15 },
  );
  targets.forEach((el) => observer.observe(el));
}

/** Tilts the product window back, then flattens it as it scrolls up into view. */
function flattenWindowOnScroll() {
  const win = document.getElementById("window");
  if (!win || reduceMotion) return;
  let queued = false;
  const update = () => {
    queued = false;
    const top = win.getBoundingClientRect().top;
    const progress = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * 0.7)));
    win.style.setProperty("--tilt", `${(18 * (1 - progress)).toFixed(2)}deg`);
    win.style.setProperty("--scale", (0.94 + 0.06 * progress).toFixed(3));
  };
  addEventListener("scroll", () => queued || ((queued = true), requestAnimationFrame(update)), { passive: true });
  addEventListener("resize", update);
  update();
}

/** Lets the floating file icons drift a little away from the mouse. */
function driftFilesFromPointer() {
  if (reduceMotion || !matchMedia("(pointer: fine)").matches) return;
  const files = [...document.querySelectorAll(".file")];
  addEventListener("pointermove", (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    files.forEach((file, i) => {
      const depth = 10 + (i % 3) * 8;
      file.style.translate = `${(-x * depth).toFixed(1)}px ${(-y * depth).toFixed(1)}px`;
    });
  });
}

/** Highlights each format in turn, until the visitor points at or focuses the list. */
function cycleFormats() {
  const list = document.getElementById("flist");
  if (!list) return;
  const cards = [...list.children];
  let current = 0;
  let paused = reduceMotion;
  const select = (i) => {
    cards[current].classList.remove("on");
    current = i;
    cards[current].classList.add("on");
  };
  list.addEventListener("pointerenter", () => (paused = true));
  list.addEventListener("focusin", () => (paused = true));
  cards.forEach((card, i) => card.addEventListener("pointerenter", () => select(i)));
  setInterval(() => paused || document.hidden || select((current + 1) % cards.length), 2400);
}

// Loaded without defer, so the class above is set before first paint; the rest needs the page.
document.addEventListener("DOMContentLoaded", () => {
  revealOnScroll();
  flattenWindowOnScroll();
  driftFilesFromPointer();
  cycleFormats();
});
