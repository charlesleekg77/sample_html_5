/**
 * Project content + the single mutable app state object shared across modules.
 * Keeping state in one place is what allows "transitions without reloads":
 * any module can read/advance the active project and the DOM + WebGL simply
 * re-sync on the next frame.
 */

export const PROJECTS = [
  {
    id: "01",
    title: "Kinetic",
    client: "Aurora Studio",
    year: "2024",
    role: "Creative Development",
    awards: ["Awwwards SOTD", "FWA of the Day"],
    tags: ["WebGL", "GSAP", "Nuxt"],
    src: "public/img/p1.jpg",
    theme: "light",
    description:
      "A real-time kinetic type system where every glyph is a WebGL plane reacting to pointer velocity.",
  },
  {
    id: "02",
    title: "Aeon",
    client: "Monolith",
    year: "2024",
    role: "Art Direction / Dev",
    awards: ["CSSDA WOTD", "Awwwards Honorable"],
    tags: ["Three.js", "GLSL", "Next.js"],
    src: "public/img/p2.jpg",
    theme: "dark",
    description:
      "An immersive brand scroll where concentric geometry unfolds in sync with inertial scrolling physics.",
  },
  {
    id: "03",
    title: "Modular",
    client: "Gridworks",
    year: "2023",
    role: "Front-end Architecture",
    awards: ["Awwwards SOTD"],
    tags: ["Lenis", "TypeScript", "WebGL"],
    src: "public/img/p3.jpg",
    theme: "light",
    description:
      "A component-driven editorial platform with layout morphing and shader-masked page transitions.",
  },
  {
    id: "04",
    title: "Current",
    client: "Tidal Labs",
    year: "2023",
    role: "Creative Development",
    awards: ["FWA of the Month"],
    tags: ["GLSL", "Canvas", "GSAP"],
    src: "public/img/p4.jpg",
    theme: "dark",
    description:
      "Fluid simulation aesthetics applied to product imagery, bending planes along scroll velocity vectors.",
  },
  {
    id: "05",
    title: "Monolith",
    client: "Studio Nocturne",
    year: "2022",
    role: "Design & Development",
    awards: ["Awwwards SOTD", "Independent of the Year"],
    tags: ["Three.js", "Nuxt", "WebGL"],
    src: "public/img/p5.jpg",
    theme: "light",
    description:
      "Brutalist blocks rebuilt as instanced geometry with hover-driven magnetic texture reveals.",
  },
  {
    id: "06",
    title: "Mono",
    client: "Type Foundry Co.",
    year: "2022",
    role: "Interaction Design",
    awards: ["CSSDA WOTD"],
    tags: ["GSAP", "TypeScript", "Shaders"],
    src: "public/img/p6.jpg",
    theme: "dark",
    description:
      "A typographic playground pairing display letterforms with structured monospace metadata systems.",
  },
  {
    id: "07",
    title: "Static",
    client: "Signal",
    year: "2021",
    role: "Creative Development",
    awards: ["FWA of the Day"],
    tags: ["Canvas", "GLSL", "WebGL"],
    src: "public/img/p7.jpg",
    theme: "light",
    description:
      "Generative noise fields rendered on the GPU, exposed through a minimal monochrome interface.",
  },
  {
    id: "08",
    title: "Orbital",
    client: "Helios",
    year: "2021",
    role: "Design & Development",
    awards: ["Awwwards SOTD"],
    tags: ["Three.js", "GSAP", "Lenis"],
    src: "public/img/p8.jpg",
    theme: "dark",
    description:
      "Depth-stacked radial forms with parallax scroll and pull-to-next navigation between chapters.",
  },
];

/**
 * Shared mutable runtime state.
 * velocity  : smoothed normalised scroll velocity, consumed by every shader.
 * hoverId   : id of the project currently under the pointer (or null).
 * transition: { active, progress } driven by the detail GSAP timeline.
 * theme     : 'light' | 'dark', mirrors the active project section.
 * locked    : true while a transition runs; freezes scroll + input.
 */
export const state = {
  velocity: 0,
  rawVelocity: 0,
  hoverId: null,
  activeId: PROJECTS[0].id,
  detailOpen: false,
  theme: "light",
  locked: false,
  transition: { active: false, progress: 0 },
};
