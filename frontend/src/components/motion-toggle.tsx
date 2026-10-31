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

export function MotionToggle({ className = "" }: { className?: string }) {
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
      className={`motion-toggle inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-ink-2 underline decoration-ink-3/40 underline-offset-4 hover:text-ink ${className}`}
    >
      <Pause aria-hidden className="size-4" />
      Pause animations
      <span aria-hidden className="text-ink-3 no-underline">{paused ? "· paused" : ""}</span>
    </button>
  );
}
