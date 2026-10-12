"use client";

import { useRef } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Camera, Hash, ShoppingBag, SunMedium, Waves } from "lucide-react";

const PROBLEMS = [
  { icon: SunMedium, title: "The light changes", body: "Window light at 8am and a bathroom bulb at 11pm make the same skin look different.", style: "bg-strawberry-ink text-white", sub: "text-white" },
  { icon: Waves, title: "Scans wobble", body: "Two analyses of unchanged skin rarely match exactly. Some wobble is just the instrument.", style: "bg-espresso text-white", sub: "text-white/85" },
  { icon: ShoppingBag, title: "A match isn't proof", body: "A product recommended for your skin is a hypothesis, not evidence it's working.", style: "bg-berry-milk text-espresso", sub: "text-ink-2" },
  { icon: Hash, title: "Small numbers mislead", body: "Hydration up 3 can be real or can be noise. Without a band, you can't tell which.", style: "bg-white text-espresso ring-1 ring-line", sub: "text-ink-2" },
  { icon: Camera, title: "New phone, new skin?", body: "Pores and texture react to sharpness and compression, so a different camera can move them.", style: "bg-strawberry-ink text-white", sub: "text-white" },
  { icon: CalendarClock, title: "When do you stop?", body: "Quit too early and you'll never know. Keep going forever and you keep paying.", style: "bg-espresso text-white", sub: "text-white/85" },
];

export function ProblemRail() {
  const rail = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 420), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="mt-10">
      <div
        ref={rail}
        tabIndex={0}
        role="region"
        aria-label="Why the mirror can't tell you if a product works. Scroll horizontally."
        className="no-scrollbar -mx-5 snap-x snap-mandatory overflow-x-auto scroll-px-5 px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8"
      >
      <ul className="flex gap-4">
        {PROBLEMS.map((p, i) => (
          <li
            key={p.title}
            className={`flex min-h-[19rem] w-[78vw] max-w-[20rem] shrink-0 snap-start flex-col justify-between rounded-[2rem] p-7 sm:w-[20rem] ${p.style} ${i % 2 ? "sm:mt-10" : ""}`}
          >
            <span className="flex items-start justify-between">
              <p.icon aria-hidden className="size-8" />
              <span aria-hidden className="tabular font-display text-sm font-bold">0{i + 1}</span>
            </span>
            <span>
              <h3 className="font-display text-[1.75rem] font-bold leading-[1.05]">{p.title}</h3>
              <p className={`mt-3 leading-relaxed ${p.sub}`}>{p.body}</p>
            </span>
          </li>
        ))}
      </ul>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous problems" className="grid size-12 place-items-center rounded-full bg-white text-strawberry-ink ring-1 ring-line-strong hover:bg-berry-soft">
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <button type="button" onClick={() => scrollBy(1)} aria-label="Next problems" className="grid size-12 place-items-center rounded-full bg-strawberry-ink text-white hover:bg-berry-deep">
          <ArrowRight aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}
