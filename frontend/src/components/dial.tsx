"use client";

import { useInView } from "./reveal";

/**
 * The variation dial: a tick-mark gauge centred on the baseline. Ticks inside
 * ±band are "normal variation"; a check-in outside them is a measured change.
 * Always pair it with a text explanation — the SVG is decorative to AT, and
 * the component renders its own sr-only summary.
 *
 * Text placement follows the gauge geometry so it never collides with ticks:
 * `children` (the headline value) sits in the tick-free interior below the hub
 * (x 33–167 of 200 in the viewBox), and `caption` sits in the full-width clear
 * band under the lowest ticks (y > 146 of 172).
 */
export function Dial({
  baseline,
  band,
  current,
  span = 15,
  label,
  tone = "light",
  children,
  caption,
  className = "",
  beyond,
  summary: summaryOverride,
}: {
  baseline: number;
  band: number;
  current?: number;
  /** points shown either side of the baseline */
  span?: number;
  label: string;
  tone?: "light" | "dark";
  /** headline value, drawn inside the gauge */
  children?: React.ReactNode;
  /** secondary line, drawn under the gauge */
  caption?: React.ReactNode;
  className?: string;
  /** Whether the check-in is beyond the band, as decided by the server. Without it the dial classifies its own
   * illustration values (homepage examples only). */
  beyond?: boolean;
  /** Replaces the screen-reader sentence. Trial pages pass one without any classification of their own. */
  summary?: string;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const start = -120; // degrees, 0 = up
  const end = 120;
  const toAngle = (v: number) => start + ((v - (baseline - span)) / (2 * span)) * (end - start);
  const ticks = Array.from({ length: 2 * span + 1 }, (_, i) => baseline - span + i);
  const polar = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    // Rounded so server and browser render identical attributes (no hydration mismatch).
    const round = (n: number) => Math.round(n * 100) / 100;
    return [round(100 + r * Math.cos(rad)), round(100 + r * Math.sin(rad))] as const;
  };
  const inBand = (v: number) => Math.abs(v - baseline) <= band;
  const outside = current !== undefined && (beyond ?? !inBand(current));
  const muted = tone === "dark" ? "rgb(255 255 255 / 0.35)" : "var(--color-line-strong)";
  const bandColor = tone === "dark" ? "#fcd7f3" : "var(--color-band-moderate)";
  const ink = tone === "dark" ? "#ffffff" : "var(--color-espresso)";
  const arcFrom = polar(toAngle(baseline - band), 66);
  const arcTo = polar(toAngle(baseline + band), 66);

  const summary =
    summaryOverride ??
    (current === undefined
      ? `${label}: baseline ${baseline}, normal variation plus or minus ${band} points.`
      : `${label}: baseline ${baseline}, check-in ${current}, a change of ${current - baseline > 0 ? "+" : ""}${current - baseline}. Normal variation is plus or minus ${band}, so this is ${outside ? "beyond" : "within"} normal variation.`);

  return (
    <div ref={ref} data-visible={visible} className={`relative ${className}`}>
      <svg viewBox="0 0 200 172" className="h-auto w-full" aria-hidden>
        {ticks.map((v) => {
          const a = toAngle(v);
          const major = (v - baseline) % 5 === 0;
          const [x1, y1] = polar(a, major ? 78 : 81);
          const [x2, y2] = polar(a, 92);
          const isCurrent = current !== undefined && v === current;
          return (
            <line
              key={v}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isCurrent ? "var(--color-strawberry)" : inBand(v) ? bandColor : muted}
              strokeWidth={isCurrent ? 4 : major ? 2.4 : 1.6}
              strokeLinecap="round"
            />
          );
        })}
        <path
          className="dial-draw"
          d={`M ${arcFrom[0]} ${arcFrom[1]} A 66 66 0 0 1 ${arcTo[0]} ${arcTo[1]}`}
          fill="none"
          stroke={bandColor}
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* baseline needle */}
        <line x1="100" y1="100" x2={polar(toAngle(baseline), 58)[0]} y2={polar(toAngle(baseline), 58)[1]} stroke={ink} strokeWidth="3" strokeLinecap="round" />
        {current !== undefined && (
          <line
            x1="100"
            y1="100"
            x2={polar(toAngle(Math.max(baseline - span, Math.min(baseline + span, current))), 70)[0]}
            y2={polar(toAngle(Math.max(baseline - span, Math.min(baseline + span, current))), 70)[1]}
            stroke="var(--color-strawberry)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={outside ? undefined : "4 4"}
          />
        )}
        <circle cx="100" cy="100" r="6" fill={ink} />
      </svg>
      <span className="sr-only">{summary}</span>
      {children && (
        // Bottom edge at y = 148/172 of the SVG; sides at x = 33 and 167 of 200.
        <div className="pointer-events-none absolute inset-x-[17%] top-0 flex aspect-[134/148] items-end justify-center text-center">
          <div className="w-full">{children}</div>
        </div>
      )}
      {caption && <div className="relative -mt-[11%] px-2 text-center">{caption}</div>}
    </div>
  );
}
