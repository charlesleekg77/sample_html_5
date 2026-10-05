/**
 * GLSL shader sources for the DOM-synced image planes.
 *
 * Technique (Curtains.js / OGL style):
 *  - Each HTML <img> is measured every frame via getBoundingClientRect().
 *  - A unit PlaneGeometry is scaled to the rect and positioned in world units
 *    that map 1:1 to CSS pixels on the z=0 plane of a PerspectiveCamera.
 *  - The vertex shader bends the geometry on Z from scroll velocity, which the
 *    perspective camera turns into a visible "page curl" (bend toward viewer).
 *  - The fragment shader samples the DOM image texture with a cover-fit and
 *    adds velocity/hover driven chromatic aberration (RGB split).
 */

export const planeVertexShader = /* glsl */ `
  precision highp float;

  uniform float uVelocity;   // smoothed, normalised scroll velocity  (-1 .. 1)
  uniform float uHover;      // 0..1 hover progress for this plane
  uniform float uTime;       // seconds, for idle breathing motion
  uniform float uBend;       // per-plane bend multiplier (0 disables, e.g. detail)

  varying vec2  vUv;
  varying float vBend;       // forwarded to fragment for edge shading
  varying float vDepth;      // displaced z, used for subtle darkening

  void main() {
    vUv = uv;

    // Local plane geometry is a unit quad centred on the origin (-0.5 .. 0.5).
    vec3 pos = position;

    // Normalised -1..1 coordinates across the quad.
    float nx = uv.x * 2.0 - 1.0;
    float ny = uv.y * 2.0 - 1.0;

    // Primary scroll bend: parabolic falloff (1 - nx^2) keeps the left/right
    // edges pinned while the centre bulges, mimicking a flexed sheet of paper.
    float bend = (1.0 - nx * nx) * uVelocity * uBend;

    // Idle breathing wave keeps planes alive when the user is still.
    float idle = sin(nx * 3.14159 + uTime * 1.4) * 0.012;

    // Hover adds a liquid ripple across the surface.
    float liquid = sin(nx * 6.2831 + uTime * 2.0) * uHover * 0.05;

    pos.z += bend + idle + liquid;

    // Slight vertical squash on hover reads as the plane "leaning in".
    pos.y *= 1.0 + uHover * 0.02;

    vBend  = bend;
    vDepth = pos.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const planeFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2  uResolution;      // plane size in CSS px (w, h)
  uniform vec2  uImageResolution; // source image size in px (w, h)
  uniform float uVelocity;        // smoothed normalised scroll velocity
  uniform float uHover;           // 0..1 hover progress
  uniform float uTime;
  uniform float uOpacity;         // global plane fade
  uniform float uRGBSplit;        // base chromatic aberration strength
  uniform float uExposure;        // 1.0 = untouched; used for theme washes

  varying vec2  vUv;
  varying float vBend;
  varying float vDepth;

  // Cover-fit: preserve aspect ratio, crop the overflow (object-fit: cover).
  vec2 coverUv(vec2 uv, vec2 res, vec2 img) {
    float sa = res.x / res.y;
    float ia = img.x / img.y;
    vec2 scale = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv, uResolution, uImageResolution);

    // Chromatic aberration amount is driven by motion, not baked in.
    float amt = uRGBSplit * (abs(uVelocity) * 0.9 + uHover * 1.2 + 0.0006);

    // Radial falloff makes the split strongest at the edges (lens-like).
    vec2  dir  = uv - 0.5;
    float dist = length(dir) * 1.6;
    vec2  off  = dir * amt * dist;

    float r = texture2D(uTexture, uv + off).r;
    float g = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uv - off).b;
    vec3 col = vec3(r, g, b);

    // Cheap edge shading: displaced geometry darkens slightly, selling depth.
    col *= 1.0 - clamp(abs(vBend) * 0.35, 0.0, 0.35);
    col *= uExposure;

    // Film grain: tiny per-pixel hash, kept very low to avoid banding.
    float grain = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.015;

    gl_FragColor = vec4(col, uOpacity);
  }
`;
