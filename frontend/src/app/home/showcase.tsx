"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { BaselineScreen, MatchScreen, PhoneFrame, SnapshotScreen, VerdictScreen } from "@/components/previews";

type Item = { title: string; body: string; label: string; screen: ReactNode; depth: number };

const ITEMS: Item[] = [
  {
    title: "Scores you can read",
    body: "Eight YouCam concerns on one scale, a summary written from your numbers, and YouCam's own detection masks over your photo, on your device only.",
    label: "Preview of the snapshot screen: eight skin scores from sample data",
    screen: <SnapshotScreen />,
    depth: 0,
  },
  {
    title: "Reasons, not percentages",
    body: "Tiers from explicit rules, with cautions drawn from your own scores and anything your filters set aside.",
    label: "Preview of the matches screen: two products from the sample catalogue",
    screen: <MatchScreen />,
    depth: 1,
  },
  {
    title: "A plan fixed in advance",
    body: "The baseline, the band and the scores that would count as up or down are saved before the first check-in.",
    label: "Preview of a trial plan from sample data: baseline hydration 69",
    screen: <BaselineScreen />,
    depth: 2,
  },
  {
    title: "A verdict that shows its working",
    body: "Before and after, the band, and every concern for context, with only your focus deciding the answer.",
    label: "Preview of a verdict screen from a synthetic demo, not a measurement",
    screen: <VerdictScreen />,
    depth: 1,
  },
];

/**
 * Four app screens as a staggered row. On wide screens with motion allowed the columns drift at different rates
 * as the row passes (Motion scroll hooks, transform only); on phones it is a swipeable strip.
 */
export function Showcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = !reduce && wide;

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        ref={ref}
        // A keyboard-scrollable strip on phones; a plain grid on wide screens.
        tabIndex={wide ? undefined : 0}
        role={wide ? undefined : "region"}
        aria-label={wide ? undefined : "Four app screens. Scroll horizontally."}
        className="no-scrollbar relative -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-5 px-5 pb-4 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0"
      >
        {ITEMS.map((item) => (
          <Column key={item.title} item={item} progress={scrollYProgress} drift={drift} />
        ))}
      </div>
    </LazyMotion>
  );
}

function Column({ item, progress, drift }: { item: Item; progress: MotionValue<number>; drift: boolean }) {
  const range = 30 + item.depth * 30;
  const y = useTransform(progress, [0, 1], [range, -range]);
  return (
    <m.div style={drift ? { y } : undefined} className={`w-[16rem] shrink-0 snap-start lg:w-auto ${item.depth === 2 ? "lg:mt-16" : item.depth === 1 ? "lg:mt-8" : ""}`}>
      <PhoneFrame label={item.label} className="mx-auto w-[15rem] lg:w-full lg:max-w-[15.5rem] [&>div]:aspect-[9/17.5]">
        {item.screen}
      </PhoneFrame>
      <h3 className="mt-6 font-display text-xl font-bold leading-tight tracking-[-0.015em] text-espresso">{item.title}</h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{item.body}</p>
    </m.div>
  );
}
