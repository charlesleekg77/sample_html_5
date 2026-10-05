/**
 * Application entry point.
 *
 * Boot order matters:
 *   1. Build the DOM rows (so every image has a layout box to measure).
 *   2. Create the WebGL surface and register one plane per image.
 *   3. Create the smooth scroll engine and wire it to the pull-up controller.
 *   4. Start a SINGLE master rAF loop that ticks scroll -> shaders -> render.
 */
import { PROJECTS, state } from "./data.js";
import { createWebGL } from "./webgl-core.js";
import { createSmoothScroll } from "./smooth-scroll.js";
import { createHoverPreview } from "./hover-preview.js";
import { createTransitions } from "./transitions.js";
import { createPullUp } from "./pull-up.js";
import { gsap, ScrollTrigger } from "./gsap.js";

/* -------------------------------------------------------------------------- */
/* 1. DOM construction                                                        */
/* -------------------------------------------------------------------------- */

const grid = document.getElementById("work-grid");
document.getElementById("work-count").textContent = String(PROJECTS.length).padStart(2, "0");

function buildRows() {
  PROJECTS.forEach((project) => {
    const li = document.createElement("li");
    li.className = "work__row";
    li.dataset.id = project.id;
    li.dataset.theme = project.theme;
    li.innerHTML = `
      <a class="work__link" href="#project-${project.id}" aria-label="View project ${project.title}">
        <span class="work__idx mono">${project.id}</span>
        <span class="work__name">${project.title}</span>
        <span class="work__meta mono">${project.client} — ${project.year}</span>
        <figure class="work__media">
          <img
            class="work__img"
            data-plane="${project.id}"
            src="${project.src}"
            alt="${project.title} project artwork"
            loading="eager"
            decoding="async"
          />
        </figure>
      </a>`;
    grid.appendChild(li);
  });
}
buildRows();

/* -------------------------------------------------------------------------- */
/* 2. UI element references                                                   */
/* -------------------------------------------------------------------------- */

const ui = {
  grid: document.querySelector(".work"),
  header: document.getElementById("site-header"),
  detail: document.getElementById("detail"),
  detailContent: document.getElementById("detail-content"),
  detailIndex: document.getElementById("detail-index"),
  detailTitle: document.getElementById("detail-title"),
  detailTags: document.getElementById("detail-tags"),
};

const drawer = document.getElementById("about-drawer");
const scrim = document.getElementById("drawer-scrim");
const aboutToggle = document.getElementById("about-toggle");
const drawerClose = document.getElementById("drawer-close");

/* -------------------------------------------------------------------------- */
/* 3. WebGL surface + planes                                                  */
/* -------------------------------------------------------------------------- */

let webgl = null;
try {
  webgl = createWebGL({ container: document.getElementById("webgl") });
  document.querySelectorAll(".work__img").forEach((img) => {
    webgl.addPlane(img.dataset.plane, img, { bend: 1, rgbSplit: 0.02 });
  });
} catch (err) {
  // Graceful fallback: no WebGL -> show the DOM images directly.
  console.warn("[portfolio] WebGL unavailable, falling back to DOM images.", err);
  document.documentElement.classList.add("no-webgl");
}

/* -------------------------------------------------------------------------- */
/* 4. Motion systems                                                          */
/* -------------------------------------------------------------------------- */

const hoverPreview = createHoverPreview({ root: document.getElementById("hover-host") });

let transitions = null;
let pullUp = null;

const smooth = createSmoothScroll({
  onScroll: (payload) => {
    // Keep ScrollTrigger in sync with the virtualised scroll position.
    ScrollTrigger.update();
    // Pull-up reads the detail region's own scroll state.
    if (pullUp) pullUp.onScroll(payload);
  },
});

transitions = createTransitions({ webgl, smooth, hoverPreview, ui });
pullUp = createPullUp({
  transitions,
  footer: document.getElementById("detail-footer"),
  ring: document.getElementById("pull-ring"),
  detailEl: ui.detail,
});

// Lenis drives the scroll, ScrollTrigger just needs a nudge.
smooth.lenis.on("scroll", ScrollTrigger.update);

/* -------------------------------------------------------------------------- */
/* 5. Interaction wiring                                                      */
/* -------------------------------------------------------------------------- */

grid.querySelectorAll(".work__row").forEach((row) => {
  const id = row.dataset.id;
  const project = PROJECTS.find((p) => p.id === id);

  row.addEventListener("pointerenter", (e) => {
    if (state.transition.active) return;
    state.hoverId = id;
    hoverPreview.show(project, e);
  });
  row.addEventListener("pointermove", (e) => {
    if (state.hoverId !== id) return;
    hoverPreview.move(e);
  });
  row.addEventListener("pointerleave", () => {
    if (state.hoverId === id) state.hoverId = null;
    hoverPreview.hide();
  });
  row.addEventListener("click", (e) => {
    e.preventDefault();
    transitions.openDetail(id);
  });
});

document.getElementById("detail-close").addEventListener("click", () => {
  transitions.closeDetail();
});

function openDrawer() {
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  scrim.classList.add("is-open");
  aboutToggle.setAttribute("aria-expanded", "true");
  gsap.to(drawer, { xPercent: 0, autoAlpha: 1, duration: 0.9, ease: "silk" });
  gsap.to(drawer.querySelectorAll(".drawer__inner > *"), {
    y: 0,
    autoAlpha: 1,
    duration: 0.8,
    stagger: 0.06,
    ease: "silk",
    delay: 0.1,
  });
}
function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  scrim.classList.remove("is-open");
  aboutToggle.setAttribute("aria-expanded", "false");
  gsap.to(drawer, { xPercent: 100, autoAlpha: 0, duration: 0.7, ease: "inExpo" });
  gsap.to(drawer.querySelectorAll(".drawer__inner > *"), { autoAlpha: 0, y: 30, duration: 0.3 });
}
// Hidden off-canvas until first opened (kept out of the hit-testing tree).
gsap.set(drawer, { xPercent: 100, autoAlpha: 0 });
gsap.set(drawer.querySelectorAll(".drawer__inner > *"), { autoAlpha: 0, y: 30 });
aboutToggle.addEventListener("click", () =>
  drawer.classList.contains("is-open") ? closeDrawer() : openDrawer()
);
drawerClose.addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);

document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", (e) => {
    const target = el.dataset.nav;
    if (target === "work") {
      e.preventDefault();
      smooth.scrollTo("#work");
    } else if (target === "home") {
      e.preventDefault();
      smooth.scrollTo(0);
    }
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (drawer.classList.contains("is-open")) closeDrawer();
    else if (state.detailOpen) transitions.closeDetail();
  }
  if (state.detailOpen && !state.transition.active) {
    if (e.key === "ArrowRight") transitions.nextProject();
    if (e.key === "ArrowLeft") transitions.prevProject();
  }
});

/* -------------------------------------------------------------------------- */
/* 6. Entrance + scroll reveals                                               */
/* -------------------------------------------------------------------------- */

gsap.set(".hero__line", { yPercent: 120 });
gsap.set(".hero__foot", { autoAlpha: 0 });

const intro = gsap.timeline({ delay: 0.15 });
intro
  .to(".hero__line", { yPercent: 0, duration: 1.2, stagger: 0.08, ease: "silk" })
  .to(".hero__foot", { autoAlpha: 1, duration: 0.8, ease: "power2.out" }, "-=0.6")
  .from(".site-header", { yPercent: -100, duration: 0.9, ease: "silk" }, 0);

gsap.from(".work__row", {
  y: 80,
  autoAlpha: 0,
  duration: 1,
  stagger: 0.08,
  ease: "silk",
  scrollTrigger: { trigger: ".work", start: "top 75%" },
});

/* -------------------------------------------------------------------------- */
/* 7. Master render loop                                                      */
/* -------------------------------------------------------------------------- */

let last = performance.now();
function loop(time) {
  // scroll first (updates velocity), then systems that consume velocity,
  // then finally the GPU sync + render.
  const dt = smooth.raf(time);
  if (pullUp) pullUp.update(dt);
  hoverPreview.update();
  if (webgl) webgl.update(dt);
  last = time;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* -------------------------------------------------------------------------- */
/* 8. Resize                                                                  */
/* -------------------------------------------------------------------------- */

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (webgl) webgl.resize();
  ScrollTrigger.refresh();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
});

// Expose for debugging / E2E assertions.
window.__portfolio = { state, webgl, smooth, transitions, pullUp, PROJECTS };
