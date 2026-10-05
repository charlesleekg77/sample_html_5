/**
 * GSAP bootstrap.
 *
 * GSAP's UMD bundles are loaded as classic scripts in index.html, so the
 * constructors live on `window`. We register the plugins used across the app
 * and define the custom eases that make up the site's motion signature.
 */
const { gsap, ScrollTrigger, CustomEase } = window;

if (!gsap) {
  throw new Error("[portfolio] GSAP failed to load before the module graph.");
}

gsap.registerPlugin(ScrollTrigger, CustomEase);

// "silk"   : the primary entrance ease, slow start then confident settle.
// "inExpo" : used for exits so elements leave faster than they arrive.
CustomEase.create("silk", "0.16, 1, 0.3, 1");
CustomEase.create("inExpo", "0.7, 0, 0.84, 0");

export { gsap, ScrollTrigger, CustomEase };
