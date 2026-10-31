/** `compared`: the check-in the server's verdict is based on (from `comparison.current_scan_id`). */
type Point = { label: string; score: number; synthetic?: boolean; baseline?: boolean; compared?: boolean };

const signedPoints = (d: number) => `${d > 0 ? "+" : ""}${d} ${Math.abs(d) === 1 ? "point" : "points"}`;

/**
 * Focus-metric history with the noise band drawn around the baseline.
 * A point outside the band is a measured change; inside it is not.
 * Rendered as a figure with a "Show the numbers" table that carries the same values in text.
 */
export function BandChart({
  points,
  band,
  metricLabel,
  caption,
  illustrative = false,
}: {
  points: Point[];
  band: number;
  metricLabel: string;
  caption?: string;
  illustrative?: boolean;
}) {
  if (points.length === 0) return null;
  const base = points.find((p) => p.baseline) ?? points[0];
  const synthetic = points.some((p) => p.synthetic);

  return (
    <figure className="w-full">
      {/* Legend lives outside the plot so it can never collide with points or the trend line. */}
      <ul aria-hidden className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-3">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-within-soft ring-1 ring-line-strong" />
          Normal variation ±{band}
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-px w-5 bg-line-strong" />
          Baseline {base.score}
        </li>
        {synthetic && (
          <li className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full ring-2 ring-ink-3" />
            Synthetic demo point
          </li>
        )}
      </ul>
      {/* Two viewBoxes so labels stay legible: a narrower one for phones. */}
      <Plot points={points} base={base} band={band} W={340} className="sm:hidden" />
      <Plot points={points} base={base} band={band} W={560} className="hidden sm:block" />
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-3">
        {caption ?? `${metricLabel} score over time. The shaded band is ±${band} points around the baseline — changes inside it are within normal scan-to-scan variation.`}
        {illustrative && " Illustration with example numbers."}
        {synthetic && " Hollow points are synthetic demo data, not measurements."}
      </figcaption>
      {/* The plot is aria-hidden, so this table is its equivalent for everyone: screen readers, magnifiers and
          anyone who can't tell the point colours apart (A11Y-15). Closed by default to keep the figure compact. */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none font-semibold text-ink-2 hover:text-ink">Show the numbers</summary>
        <table className="mt-3 w-full border-collapse text-left">
          <caption className="sr-only">{metricLabel} scores, oldest first</caption>
          <thead>
            <tr className="border-b border-line-strong text-ink-2">
              <th scope="col" className="py-2 pr-3 font-semibold">When</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Score</th>
              <th scope="col" className="py-2 font-semibold">Difference from baseline</th>
            </tr>
          </thead>
          <tbody className="tabular text-ink">
            {points.map((p, i) => (
              <tr key={i} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 pr-3 font-normal text-ink-2 [overflow-wrap:anywhere]">
                  {p.label}
                  {p.synthetic && !/synthetic/i.test(p.label) ? " (synthetic demo)" : ""}
                  {p.compared && <span className="block text-xs text-ink-3">Used for the result above</span>}
                </th>
                <td className="py-2 pr-3">{p.score}</td>
                {/* Numbers only: whether a change counts is the server's verdict, given in words above the chart. */}
                <td className="py-2">{p.baseline ? "Baseline" : signedPoints(p.score - base.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-3">Normal variation is ±{band} points around the baseline score of {base.score}.</p>
      </details>
    </figure>
  );
}

function Plot({ points, base, band, W, className }: { points: Point[]; base: Point; band: number; W: number; className: string }) {
  const compact = W < 400;
  const scores = points.map((p) => p.score);
  const lo = Math.max(0, Math.floor(Math.min(...scores, base.score - band) - 6));
  const hi = Math.min(100, Math.ceil(Math.max(...scores, base.score + band) + 6));
  const H = 230;
  const fs = compact ? 13 : 12;
  const pad = { l: compact ? 32 : 40, r: compact ? 14 : 24, t: 22, b: 46 };
  // Points sit inset from the plot edges so their score labels clear the y-axis tick labels.
  const inset = 20;
  const x = (i: number) =>
    points.length === 1
      ? (pad.l + W - pad.r) / 2
      : pad.l + inset + (i * (W - pad.l - pad.r - 2 * inset)) / (points.length - 1);
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / Math.max(1, hi - lo);
  const ticks = niceTicks(lo, hi);
  // End labels anchor inward so they never run off the edge of the plot.
  const anchor = (i: number) =>
    points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
  const labelX = (i: number) => (anchor(i) === "start" ? x(i) - 8 : anchor(i) === "end" ? x(i) + 8 : x(i));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full ${className}`} aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={fs} fill="var(--color-ink-3)" className="tabular">
            {t}
          </text>
        </g>
      ))}
      <rect
        x={pad.l}
        width={W - pad.l - pad.r}
        y={y(base.score + band)}
        height={y(base.score - band) - y(base.score + band)}
        fill="var(--color-within-soft)"
      />
      <line x1={pad.l} x2={W - pad.r} y1={y(base.score)} y2={y(base.score)} stroke="var(--color-line-strong)" />
      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")}
          fill="none"
          stroke="var(--color-ink-2)"
          strokeWidth="1.5"
          strokeDasharray={points.some((p) => p.synthetic) ? "5 5" : undefined}
        />
      )}
      {points.map((p, i) => {
        const outside = !p.baseline && Math.abs(p.score - base.score) > band;
        const up = p.score > base.score;
        const fill = p.baseline ? "var(--color-ink)" : outside ? (up ? "var(--color-better)" : "var(--color-worse)") : "var(--color-within)";
        const lines = p.label.split(" · ");
        return (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.score)} r={p.baseline ? 6 : 7} fill={p.synthetic ? "var(--color-card)" : fill} stroke={fill} strokeWidth={p.synthetic ? 2.5 : 0} />
            <text x={x(i)} y={y(p.score) - 13} textAnchor="middle" fontSize={fs + 2} fontWeight="600" fill="var(--color-ink)" className="tabular">
              {p.score}
            </text>
            <text x={labelX(i)} y={H - pad.b + 20} textAnchor={anchor(i)} fontSize={fs} fill="var(--color-ink-3)">
              {lines.map((line, j) => (
                <tspan key={j} x={labelX(i)} dy={j === 0 ? 0 : fs + 3}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 40 ? 20 : span > 20 ? 10 : 5;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out;
}
