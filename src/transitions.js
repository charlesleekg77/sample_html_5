/**
 * Project navigation controller.
 *
 * Two entry points share the same machinery:
 *  1. openDetail()  - click a grid row: the row's WebGL plane inflates to
 *                     full-bleed while the DOM detail panel fades in.
 *  2. goTo()        - the "pull up" next-project mechanism: the outgoing
 *                     fullscreen plane cross-dissolves into the incoming one
 *                     with a slight scale pop, then metadata swaps.
 *
 * No route changes, no reloads: `state.activeId` is the source of truth and
 * the WebGL planes + DOM simply re-render from it.
 */
import { gsap } from "./gsap.js";
import { state, PROJECTS } from "./data.js";

export function createTransitions({ webgl, smooth, hoverPreview, ui }) {
  const { detail, detailContent, detailIndex, detailTitle, detailTags } = ui;
  let busy = false;

  function projectById(id) {
    return PROJECTS.find((p) => p.id === id);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
  }

  function renderMeta(project) {
    detailIndex.textContent = `${project.id} / ${String(PROJECTS.length).padStart(2, "0")}`;
    detailTitle.textContent = project.title;
    detailTags.innerHTML = project.tags
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");
    detailContent.innerHTML = `
      <div class="detail__grid">
        <div class="detail__col">
          <p class="detail__lead">${project.description}</p>
        </div>
        <div class="detail__col mono">
          <dl>
            <dt>Client</dt><dd>${project.client}</dd>
            <dt>Year</dt><dd>${project.year}</dd>
            <dt>Role</dt><dd>${project.role}</dd>
            <dt>Awards</dt><dd>${project.awards.join(", ")}</dd>
          </dl>
        </div>
      </div>`;
  }

  /** Toggle the overlay's interactive state (pointer-events + a11y). */
  function setDetailInteractive(on) {
    detail.classList.toggle("is-open", on);
    detail.setAttribute("aria-hidden", on ? "false" : "true");
  }

  /** Inflate a grid plane into a full-bleed hero. */
  function openDetail(id) {
    if (busy || state.detailOpen) return;
    const project = projectById(id);
    const record = webgl.planes.get(id);
    if (!project || !record) return;

    busy = true;
    state.activeId = id;
    state.detailOpen = true;
    state.transition.active = true;
    state.hoverId = null;
    hoverPreview.hide();
    smooth.stop();
    applyTheme(project.theme);

    record.override = webgl.fullscreenOverride();
    record.transitionT = 0;
    record.zOffset = 40; // start slightly forward, settle to 0

    renderMeta(project);
    setDetailInteractive(true);

    const tl = gsap.timeline({
      onComplete: () => {
        busy = false;
        state.transition.active = false;
      },
    });

    tl.to(record, { transitionT: 1, duration: 1.15, ease: "silk" }, 0)
      .to(record, { zOffset: 0, duration: 1.15, ease: "silk" }, 0)
      .to(record.uniforms.uRGBSplit, { value: 0.055, duration: 0.5, ease: "power2.out" }, 0)
      .to(record.uniforms.uRGBSplit, { value: 0.012, duration: 0.9, ease: "power2.inOut" }, 0.5)
      .to(ui.grid, { autoAlpha: 0, duration: 0.55, ease: "power2.inOut" }, 0)
      .to(ui.header, { autoAlpha: 0, duration: 0.4 }, 0)
      .to(detail, { autoAlpha: 1, duration: 0.8, ease: "power2.out" }, 0.45)
      .fromTo(
        detailContent,
        { y: 60, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, ease: "silk" },
        0.55
      );
  }

  /** Return to the grid from a detail view. */
  function closeDetail() {
    if (busy || !state.detailOpen) return;
    const record = webgl.planes.get(state.activeId);
    if (!record) return;

    busy = true;
    state.transition.active = true;
    applyTheme("light");
    setDetailInteractive(false);

    const tl = gsap.timeline({
      onComplete: () => {
        state.detailOpen = false;
        state.transition.active = false;
        record.override = null;
        record.transitionT = 0;
        busy = false;
        smooth.start();
      },
    });

    tl.to(detail, { autoAlpha: 0, duration: 0.4, ease: "power2.in" }, 0)
      .to(record, { transitionT: 0, duration: 1.0, ease: "silk" }, 0.15)
      .to(ui.grid, { autoAlpha: 1, duration: 0.6, ease: "power2.out" }, 0.35)
      .to(ui.header, { autoAlpha: 1, duration: 0.5 }, 0.4);
  }

  /**
   * Seamless next/prev project. The incoming plane is instantly placed
   * fullscreen but transparent; we cross-dissolve the two textures while a
   * subtle scale pop covers the swap.
   */
  function goTo(id) {
    if (busy || !state.detailOpen) return;
    const from = webgl.planes.get(state.activeId);
    const to = webgl.planes.get(id);
    const project = projectById(id);
    if (!from || !to || !project) return;

    busy = true;
    state.transition.active = true;
    state.activeId = id;

    // Prepare the incoming plane as a fullscreen plate, fully transparent.
    to.override = webgl.fullscreenOverride();
    to.transitionT = 1;
    to.zOffset = 0;
    to.opacity = 0;

    applyTheme(project.theme);

    // Fade metadata out, swap content at the midpoint, fade back in.
    const tl = gsap.timeline({
      onComplete: () => {
        from.override = null;
        from.transitionT = 0;
        from.opacity = 1;
        to.opacity = 1;
        busy = false;
        state.transition.active = false;
      },
    });

    tl.to(from, { opacity: 0, duration: 0.75, ease: "power2.inOut" }, 0)
      .to(to, { opacity: 1, duration: 0.9, ease: "power2.inOut" }, 0.25)
      .to(detailContent, { autoAlpha: 0, y: -40, duration: 0.35, ease: "power2.in" }, 0)
      .add(() => {
        renderMeta(project);
      })
      .fromTo(
        detailContent,
        { autoAlpha: 0, y: 50 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "silk" },
        0.5
      )
      .fromTo(
        to.uniforms.uRGBSplit,
        { value: 0.06 },
        { value: 0.012, duration: 1.0, ease: "power2.out" },
        0.25
      );
  }

  function nextProject() {
    const i = PROJECTS.findIndex((p) => p.id === state.activeId);
    goTo(PROJECTS[(i + 1) % PROJECTS.length].id);
  }

  function prevProject() {
    const i = PROJECTS.findIndex((p) => p.id === state.activeId);
    goTo(PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length].id);
  }

  return { openDetail, closeDetail, goTo, nextProject, prevProject, applyTheme };
}
