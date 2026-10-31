"use client";

import { useSyncExternalStore } from "react";
import { Pause } from "lucide-react";
import { MOTION_KEY } from "@/lib/motion";

// The homepage ticker and floating chips move on their own for longer than five seconds, beside other content, so
// they need a pause (WCAG 2.2.2). The choice is kept on <html data-motion> and in localStorage, and applied before
// first paint by the script in layout.tsx, so motion never restarts on another page or a reload. Under
// prefers-reduced-motion nothing moves, and globals.css hides this control.
const EVENT = "pl:motion-change";

const isPaused = () => document.documentElement.dataset.motion === "paused";
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function MotionToggle({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const paused = useSyncExternalStore(subscribe, isPaused, () => false);
  function toggle() {
    const next = !isPaused();
    if (next) document.documentElement.dataset.motion = "paused";
    else delete document.documentElement.dataset.motion;
    try {
      if (next) localStorage.setItem(MOTION_KEY, "paused");
      else localStorage.removeItem(MOTION_KEY);
    } catch {
      // storage unavailable: the choice holds for this page
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={toggle}
      className={`motion-toggle inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold underline underline-offset-4 ${
        tone === "dark" ? "text-white/85 decoration-white/40 hover:text-white" : "text-ink-2 decoration-ink-3/40 hover:text-ink"
      } ${className}`}
    >
      <Pause aria-hidden className="size-4" />
      Pause animations
      <span aria-hidden className={`no-underline ${tone === "dark" ? "text-white/70" : "text-ink-3"}`}>{paused ? "· paused" : ""}</span>
    </button>
  );
}
