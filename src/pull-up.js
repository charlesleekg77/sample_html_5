/**
 * Seamless "next project pull-up" controller.
 *
 * Inside a detail view, when the user reaches the bottom of the metadata the
 * page stops scrolling (Lenis is clamped to `limit`). We then listen for
 * continued downward input and treat it as *intent to pull*:
 *
 *   1. Accumulate overscroll pressure from wheel deltas.
 *   2. Map that pressure to a visible resistance (the footer nudges up with a
 *      rubber-band easing, and a progress ring fills).
 *   3. Past a threshold, release: prefetch the next project's asset, then hand
 *      off to the transition controller to cross-dissolve into it.
 *
 * Releasing before the threshold snaps the rubber-band back to rest.
 */
import { gsap } from "./gsap.js";
import { state, PROJECTS } from "./data.js";

const THRESHOLD = 260;      // accumulated wheel delta required to trigger
const DECAY = 0.9;          // pressure lost per frame once the gesture pauses
const IDLE_MS = 250;        // grace period before the rubber-band relaxes
const MAX_VISUAL = 120;     // max px the footer plate lifts (resistance cap)

export function createPullUp({ transitions, footer, ring, detailEl }) {
  let pressure = 0;
  let fired = false;
  let atBottom = true;
  let lastInput = 0;
  const prefetched = new Set();

  function nextProject() {
    const i = PROJECTS.findIndex((p) => p.id === state.activeId);
    return PROJECTS[(i + 1) % PROJECTS.length];
  }

  function prefetch(id) {
    if (prefetched.has(id)) return;
    const project = PROJECTS.find((p) => p.id === id);
    if (!project) return;
    prefetched.add(id);
    // Warm the browser cache so the cross-dissolve has pixels ready.
    const im = new Image();
    im.decoding = "async";
    im.src = project.src;
  }

  function applyVisual(progress) {
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic resistance
    if (footer) {
      footer.style.setProperty("--pull", progress.toFixed(3));
      gsap.set(footer, { y: -eased * MAX_VISUAL });
    }
    if (ring) ring.style.setProperty("--pull", progress.toFixed(3));
  }

  function reset() {
    pressure = 0;
    fired = false;
    lastInput = 0;
    applyVisual(0);
  }

  /**
   * "At the bottom" is measured on the detail overlay itself (it is the scroll
   * region in detail mode). When its content fits the viewport, it is always
   * at the bottom, so the very next scroll gesture pulls to the next project.
   */
  function computeAtBottom() {
    if (!detailEl) return true;
    const overflow = detailEl.scrollHeight - detailEl.clientHeight;
    if (overflow <= 2) return true;
    return detailEl.scrollTop >= overflow - 2;
  }

  function onScroll() {
    if (!state.detailOpen || state.transition.active) {
      if (pressure > 0) reset();
      return;
    }
    const nowBottom = computeAtBottom();
    if (atBottom && !nowBottom && pressure > 0) reset();
    atBottom = nowBottom;
  }

  /** Accumulate pull pressure from a downward wheel/touch delta. */
  function addPressure(delta) {
    if (!state.detailOpen || state.transition.active || !atBottom) return;
    if (delta <= 0) return;
    pressure = Math.max(0, pressure + delta);
    lastInput = performance.now();
  }

  /**
   * Wheel and touch are pure *intent* signals: once the detail region is at its
   * bottom the gesture no longer moves anything, so it reads as pull pressure.
   */
  function bind() {
    window.addEventListener(
      "wheel",
      (e) => {
        addPressure(e.deltaY * 0.5);
        if (e.deltaY < 0) pressure = Math.max(0, pressure + e.deltaY * 0.5);
      },
      { passive: true }
    );

    let touchStartY = 0;
    window.addEventListener(
      "touchstart",
      (e) => {
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        const dy = touchStartY - e.touches[0].clientY;
        if (dy > 0) addPressure(dy * 0.6);
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );
  }

  /** Per-frame: apply resistance visuals, decay, and release past threshold. */
  function update() {
    if (!state.detailOpen || state.transition.active) return;

    atBottom = computeAtBottom();

    if (atBottom && pressure > 0) {
      const progress = Math.min(pressure / THRESHOLD, 1);
      applyVisual(progress);

      // Prefetch once the user clearly commits, before the actual release.
      if (progress > 0.5) prefetch(nextProject().id);

      if (progress >= 1 && !fired) {
        fired = true;
        release();
        return;
      }
    }

    // Relax the rubber-band only once the gesture has actually paused.
    if (pressure > 0 && performance.now() - lastInput > IDLE_MS) {
      pressure *= DECAY;
      if (pressure < 1) pressure = 0;
      if (atBottom) applyVisual(Math.min(pressure / THRESHOLD, 1));
    }
  }

  function release() {
    const next = nextProject();
    prefetch(next.id);

    if (footer) {
      // Snap the resistance back, then hand off to the cross-dissolve.
      gsap.to(footer, {
        y: 0,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          transitions.goTo(next.id);
          reset();
        },
      });
    } else {
      transitions.goTo(next.id);
      reset();
    }
  }

  bind();
  return {
    onScroll,
    update,
    reset,
    prefetch,
    addPressure,
    debug: () => ({ pressure, fired, atBottom, lastInput }),
  };
}
