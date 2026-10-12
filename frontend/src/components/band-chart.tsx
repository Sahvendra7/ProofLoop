type Point = { label: string; score: number; synthetic?: boolean; baseline?: boolean };

/**
 * Focus-metric history with the noise band drawn around the baseline.
 * A point outside the band is a measured change; inside it is not.
 * Rendered as a figure with a visually hidden data table for screen readers.
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
      {/* sr-only on the wrapper: overflow:hidden does not clip a table box, which caused page-wide overflow on phones. */}
      <div className="sr-only">
        <table>
          <caption>{metricLabel} scores</caption>
          <thead>
            <tr><th>When</th><th>Score</th><th>Compared with baseline</th></tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.label}{p.synthetic ? " (synthetic demo)" : ""}</td>
                <td>{p.score}</td>
                <td>
                  {p.baseline
                    ? "Baseline"
                    : Math.abs(p.score - base.score) > band
                      ? `${p.score - base.score > 0 ? "+" : ""}${p.score - base.score}, beyond normal variation`
                      : `${p.score - base.score > 0 ? "+" : ""}${p.score - base.score}, within normal variation`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
