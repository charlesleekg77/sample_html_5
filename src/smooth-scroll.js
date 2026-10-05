/**
 * Smooth scroll engine.
 *
 * Lenis owns the page scroll: it intercepts wheel/touch input, applies
 * momentum + easing, and writes the result to the real scroll position each
 * frame. Everything else (WebGL sync, ScrollTrigger, velocity-driven shaders)
 * reads from it, so all systems stay in lock-step.
 *
 * Velocity is exposed both raw (px/frame) and normalised (-1..1) because the
 * shaders want a bounded, frame-rate independent value.
 */
import { state } from "./data.js";

// Lenis is a UMD bundle loaded as a classic script (see index.html).
const Lenis = window.Lenis;

const MAX_VELOCITY = 60; // px/frame considered "full speed" for normalisation

export function createSmoothScroll({ onScroll } = {}) {
  const lenis = new Lenis({
    duration: 1.15,          // seconds for a full settle
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    lerp: 0.09,              // secondary interpolation for micro-smoothness
  });

  let lastTime = performance.now();

  /**
   * Driven by the app's single master loop (see main.js) so that velocity is
   * updated *before* the WebGL sync reads it in the same frame. Self-running a
   * second rAF here would introduce a one-frame ordering race.
   */
  function raf(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    lenis.raf(time);

    // lenis.velocity is signed px per ~frame; smooth it for shader stability.
    const raw = lenis.velocity || 0;
    state.rawVelocity = raw;

    const normalised = clamp(raw / MAX_VELOCITY, -1, 1);
    // Exponential smoothing: fast attack, slower release -> springy feel.
    const smoothing = Math.abs(normalised) > Math.abs(state.velocity) ? 0.35 : 0.08;
    state.velocity += (normalised - state.velocity) * smoothing;

    if (typeof onScroll === "function") {
      onScroll({
        scroll: lenis.scroll,
        limit: lenis.limit,
        velocity: state.velocity,
        dt,
      });
    }

    return dt;
  }

  return {
    lenis,
    raf,
    stop() {
      lenis.stop();
      state.locked = true;
    },
    start() {
      lenis.start();
      state.locked = false;
    },
    scrollTo(target, opts = {}) {
      lenis.scrollTo(target, { duration: 1.2, ...opts });
    },
    destroy() {
      lenis.destroy();
    },
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
