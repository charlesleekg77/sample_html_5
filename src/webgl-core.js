/**
 * WebGL core: mirrors DOM <img> elements onto Three.js planes.
 *
 * The trick that makes DOM + WebGL feel like one surface:
 *  - A PerspectiveCamera sits `perspectiveDistance` px from the z=0 plane.
 *  - At that distance the visible world height (in world units) is computed and
 *    mapped 1:1 to CSS pixels. `worldPerPixel` is therefore the only conversion
 *    factor needed to translate getBoundingClientRect() into world space.
 *  - Every frame each plane's scale + position are rewritten from its live rect,
 *    so Lenis-smoothed scrolling moves DOM text and WebGL imagery identically.
 */
import * as THREE from "../vendor/three.module.js";
import { planeVertexShader, planeFragmentShader } from "./shaders.js";
import { state } from "./data.js";

const FOV = 45;              // degrees
const PERSPECTIVE_DISTANCE = 1200; // camera distance in CSS px
const CULL_MARGIN = 200;     // px beyond viewport before a plane is hidden

export function createWebGL({ container }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.z = PERSPECTIVE_DISTANCE;

  const planes = new Map(); // id -> plane record
  const clock = new THREE.Clock();

  // Recomputed on resize: world size of the viewport at z=0 + px->world factor.
  let worldHeight = 0;
  let worldWidth = 0;
  let worldPerPixel = 1;

  function measure() {
    const vFov = (FOV * Math.PI) / 180;
    worldHeight = 2 * Math.tan(vFov / 2) * PERSPECTIVE_DISTANCE;
    worldWidth = worldHeight * camera.aspect;
    worldPerPixel = worldHeight / window.innerHeight;
  }

  /**
   * Register a DOM image as a GPU plane. The DOM <img> stays in the layout so
   * it reserves space, but is made transparent (opacity 0) — the WebGL plane is
   * what the user actually sees, drawn exactly on top of the reserved box.
   */
  function addPlane(id, imgEl, options = {}) {
    // Three sizes GPU textures from `image.width/height`. For a laid-out <img>
    // those are the *rendered* dimensions, so the real pixel data (natural
    // size) overflows the allocation. A detached Image reports its intrinsic
    // size instead, and shares the browser cache so it costs no extra network.
    const source = new Image();
    source.decoding = "async";
    source.src = imgEl.currentSrc || imgEl.src;

    const texture = new THREE.Texture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = true;

    const uniforms = {
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uImageResolution: { value: new THREE.Vector2(1, 1) },
      uVelocity: { value: 0 },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uBend: { value: options.bend ?? 1 },
      uOpacity: { value: 1 },
      uRGBSplit: { value: options.rgbSplit ?? 0.02 },
      uExposure: { value: 1 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: planeVertexShader,
      fragmentShader: planeFragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    // 20x20 segments give the vertex shader enough resolution to bend smoothly.
    const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // Hidden until decoded: rendering earlier would upload a 0-size texture.
    mesh.visible = false;
    scene.add(mesh);

    const record = {
      id,
      img: imgEl,
      mesh,
      uniforms,
      texture,
      hover: 0,
      bendBase: options.bend ?? 1,
      // Fullscreen override target, blended in during the detail transition.
      override: null,
      transitionT: 0,
      // Animated by GSAP; applied by the sync loop (which owns mesh.position).
      zOffset: 0,
      // Per-plane opacity multiplier, animated by the cross-dissolve.
      opacity: 1,
      ready: false,
    };

    const markReady = () => {
      record.ready = true;
      uniforms.uImageResolution.value.set(source.naturalWidth, source.naturalHeight);
      texture.needsUpdate = true;
    };

    if (source.complete && source.naturalWidth) {
      markReady();
    } else {
      source.addEventListener("load", markReady, { once: true });
      source.addEventListener("error", () => {
        console.warn(`[portfolio] image failed: ${source.src}`);
      });
    }

    planes.set(id, record);
    return record;
  }

  /** Live rect of a plane's DOM image, in CSS px. */
  function rectOf(img) {
    return img.getBoundingClientRect();
  }

  function updatePlane(record, dt) {
    const { img, mesh, uniforms } = record;

    // Skip until the source image is decoded (see addPlane).
    if (!record.ready) {
      mesh.visible = false;
      return;
    }

    const r = rectOf(img);

    // --- Visibility culling -------------------------------------------------
    const offscreen = r.bottom < -CULL_MARGIN || r.top > window.innerHeight + CULL_MARGIN;
    if (offscreen && !record.override) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // --- Base target derived from the DOM box -------------------------------
    let targetX = -worldWidth / 2 + (r.left + r.width / 2) * worldPerPixel;
    let targetY = worldHeight / 2 - (r.top + r.height / 2) * worldPerPixel;
    let targetW = Math.max(r.width, 1) * worldPerPixel;
    let targetH = Math.max(r.height, 1) * worldPerPixel;
    let targetOpacity = 1;
    let targetBend = record.bendBase;

    // --- Blend toward the fullscreen override during a transition -----------
    if (record.override && record.transitionT > 0) {
      const t = record.transitionT;
      targetX = lerp(targetX, record.override.x, t);
      targetY = lerp(targetY, record.override.y, t);
      targetW = lerp(targetW, record.override.w, t);
      targetH = lerp(targetH, record.override.h, t);
      targetOpacity = lerp(targetOpacity, record.override.opacity ?? 1, t);
      // Flatten the bend so the hero image reads as a clean full-bleed plate.
      targetBend = lerp(targetBend, 0, t);
    }

    mesh.scale.set(targetW, targetH, 1);
    mesh.position.set(targetX, targetY, record.zOffset);

    // --- Uniforms -----------------------------------------------------------
    uniforms.uResolution.value.set(r.width, r.height);
    uniforms.uVelocity.value = state.velocity;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uOpacity.value = targetOpacity * record.opacity;
    uniforms.uBend.value = targetBend;

    // Hover ramps in/out; disabled while a detail transition owns the surface.
    const hoverTarget =
      state.hoverId === record.id && !state.transition.active ? 1 : 0;
    record.hover += (hoverTarget - record.hover) * Math.min(1, dt * 8);
    uniforms.uHover.value = record.hover;

    // Dark sections dim the imagery slightly so white type stays legible.
    uniforms.uExposure.value = state.theme === "dark" ? 0.86 : 1;
  }

  /** Fullscreen override in world units, used by the transition controller. */
  function fullscreenOverride() {
    return {
      x: 0,
      y: 0,
      w: worldWidth,
      h: worldHeight,
      opacity: 1,
    };
  }

  function update(dt) {
    for (const record of planes.values()) updatePlane(record, dt);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    measure();
  }

  function dispose() {
    for (const record of planes.values()) {
      record.texture.dispose();
      record.mesh.geometry.dispose();
      record.mesh.material.dispose();
    }
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  measure();

  return {
    renderer,
    scene,
    camera,
    planes,
    addPlane,
    update,
    resize,
    dispose,
    fullscreenOverride,
    get worldWidth() {
      return worldWidth;
    },
    get worldHeight() {
      return worldHeight;
    },
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
