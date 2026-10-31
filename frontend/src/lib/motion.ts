/** localStorage key for the "Pause animations" choice; read before first paint by the script in layout.tsx. */
export const MOTION_KEY = "pl:motion";

/** JS copies of the motion tokens in globals.css (@theme --ease-* / --duration-*), for Motion and GSAP. */
export const EASE = {
  outSoft: [0.22, 1, 0.36, 1],
  instrument: [0.34, 1.36, 0.64, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
} as const;

/** Seconds, as Motion and GSAP take them. */
export const DURATION = {
  fast: 0.16,
  base: 0.32,
  slow: 0.64,
  scene: 1.1,
} as const;

/** True when the user asked the OS for less motion, or paused animations with the site's own control. */
export function motionReduced() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "paused";
}
