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
          <span aria-hidden className="tabular font-display text-2xl text-ink">{metric.ui_score}</span>
          <span aria-hidden className="ml-2 text-xs font-medium" style={{ color: BAND_TEXT[metric.band] }}>
            {metric.band_label}
          </span>
        </p>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-sunken" aria-hidden>
        <div className="absolute inset-y-0 left-[60%] w-px bg-line-strong" />
        <div className="absolute inset-y-0 left-[80%] w-px bg-line-strong" />
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${metric.ui_score}%`, background: BAND_COLOR[metric.band] }}
        />
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
