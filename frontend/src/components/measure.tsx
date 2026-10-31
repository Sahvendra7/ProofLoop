import { FlaskConical, Radar } from "lucide-react";
import type { Metric, Provenance } from "@/lib/types";
import { BAND_COLOR, BAND_TEXT } from "@/lib/format";

/** Always-visible label saying where a number came from. */
export function ProvenanceBadge({ provenance, size = "md" }: { provenance: Provenance; size?: "sm" | "md" }) {
  const live = provenance.kind === "youcam";
  const pad = size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs";
  return (
    <span
      title={provenance.detail}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${pad} ${
        live ? "bg-live-soft text-live ring-live/20" : "hatch bg-demo-soft text-demo ring-demo/25"
      }`}
    >
      {live ? <Radar aria-hidden className="size-3.5" /> : <FlaskConical aria-hidden className="size-3.5" />}
      {provenance.label}
    </span>
  );
}

export function ProvenanceNote({ provenance }: { provenance: Provenance }) {
  const live = provenance.kind === "youcam";
  return (
    <div
      className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-[var(--radius-md)] p-3.5 text-sm ring-1 ${
        live ? "bg-live-soft/60 text-live ring-live/15" : "hatch bg-demo-soft text-demo ring-demo/20"
      }`}
    >
      <ProvenanceBadge provenance={provenance} size="sm" />
      <p className="min-w-0 flex-1 leading-relaxed">{provenance.detail}</p>
    </div>
  );
}

/** A 0-100 score bar with the three display bands marked underneath. */
export function MetricBar({ metric, compact = false }: { metric: Metric; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{metric.label}</p>
          {!compact && <p className="text-xs text-ink-3">Higher = {metric.plain}</p>}
        </div>
        <p className="shrink-0 text-right">
          {/* One phrase in reading order for screen readers; the visual number and label ran together ("69Room to improve"). */}
          <span className="sr-only">{`${metric.ui_score} out of 100, ${metric.band_label.toLowerCase()}`}</span>
          <span aria-hidden className="tabular font-condensed text-3xl font-bold leading-none text-ink">{metric.ui_score}</span>
          <span aria-hidden className="ml-2 text-xs font-medium" style={{ color: BAND_TEXT[metric.band] }}>
            {metric.band_label}
          </span>
        </p>
      </div>
      {/* A short scale: the bar, with the 60 and 80 band edges marked as ticks above and below it. */}
      <div className="relative mt-2.5 h-2.5 rounded-full bg-sunken" aria-hidden>
        <div
          className="h-full rounded-full transition-[width] duration-[var(--duration-scene)] ease-[var(--ease-out-soft)]"
          style={{ width: `${metric.ui_score}%`, background: BAND_COLOR[metric.band] }}
        />
        <div className="absolute -inset-y-1 left-[60%] w-px bg-ink-3/50" />
        <div className="absolute -inset-y-1 left-[80%] w-px bg-ink-3/50" />
      </div>
    </div>
  );
}

export function BandLegend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
      <span><Dot c="attention" /> Under 60 · worth focusing on</span>
      <span><Dot c="moderate" /> 60–79 · room to improve</span>
      <span><Dot c="strength" /> 80+ · looking strong</span>
    </p>
  );
}

function Dot({ c }: { c: keyof typeof BAND_COLOR }) {
  return <span aria-hidden className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: BAND_COLOR[c] }} />;
}
