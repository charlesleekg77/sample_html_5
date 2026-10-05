/**
 * Magnetic hover preview.
 *
 * Hovering a project row summons a floating image plate that is attracted to
 * the cursor with a spring (GSAP quickTo), skews with scroll velocity, and
 * swaps texture as the pointer travels between rows. The image source is the
 * same asset the WebGL grid plane uses, so the preview and the grid feel like
 * one continuous material.
 */
import { gsap } from "./gsap.js";
import { state } from "./data.js";

export function createHoverPreview({ root }) {
  const el = document.createElement("div");
  el.className = "hover-preview";
  el.innerHTML = `
    <div class="hover-preview__inner">
      <img class="hover-preview__img" alt="" />
      <span class="hover-preview__meta"></span>
    </div>`;
  root.appendChild(el);

  const img = el.querySelector(".hover-preview__img");
  const meta = el.querySelector(".hover-preview__meta");

  // quickTo gives us allocation-free, frame-synced springs for the
  // high-frequency pointer follow. Scale changes rarely, so a plain tween is
  // cheaper and avoids GSAP's transform-reset bookkeeping warnings.
  const xTo = gsap.quickTo(el, "x", { duration: 0.65, ease: "power3" });
  const yTo = gsap.quickTo(el, "y", { duration: 0.65, ease: "power3" });
  const skewTo = gsap.quickTo(el, "skewY", { duration: 0.4, ease: "power2" });

  let visible = false;
  let currentId = null;

  function show(project, ev) {
    if (currentId !== project.id) {
      currentId = project.id;
      // Cross-fade texture swap to avoid a hard pop between projects.
      gsap.fromTo(
        img,
        { opacity: 0, scale: 1.08 },
        { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" }
      );
      img.src = project.src;
      meta.textContent = `${project.id} — ${project.title}`;
    }
    if (!visible) {
      visible = true;
      gsap.to(el, { autoAlpha: 1, duration: 0.35, ease: "power2.out" });
      gsap.to(el, { scale: 1, duration: 0.5, ease: "power3" });
    }
    move(ev);
  }

  function move(ev) {
    // Offset the plate so the cursor sits near its corner, not dead centre.
    xTo(ev.clientX - el.offsetWidth * 0.15);
    yTo(ev.clientY - el.offsetHeight * 0.5);
  }

  function hide() {
    if (!visible) return;
    visible = false;
    currentId = null;
    gsap.to(el, { autoAlpha: 0, duration: 0.3, ease: "power2.in" });
    gsap.to(el, { scale: 0.85, duration: 0.5, ease: "power3" });
  }

  /** Called every frame so the plate can react to scroll velocity. */
  function update() {
    if (!visible) return;
    skewTo(state.velocity * 14);
  }

  return { show, move, hide, update, el };
}
