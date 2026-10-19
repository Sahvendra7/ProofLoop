"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGo } from "@/lib/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { loadCapture } from "@/lib/capture-store";
import { countsAsChange, shortDate, summarise } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { Goal, Metric, Scan } from "@/lib/types";
import { BandLegend, MetricBar, ProvenanceNote } from "@/components/measure";
import { Button, ButtonLink, Card, Notice, Skeleton } from "@/components/ui";

export function ResultsView() {
  const params = useSearchParams();
  const scanId = params.get("scan");
  const scan = useResource(scanId ? `scan:${scanId}` : null, () => api.scan(scanId!));
  const goals = useResource("goals", api.goals);

  if (!scanId) return <Missing />;
  if (scan.error) {
    return (
      <Shell>
        <Notice tone="error" title={scan.error.message} action={<ButtonLink href="/scan" variant="secondary">Start a new scan</ButtonLink>}>
          {scan.error.hint}
        </Notice>
      </Shell>
    );
  }
  if (!scan.data) return <Loading />;
  const s = scan.data;
  if (s.status === "processing") {
    return (
      <Shell>
        <Notice title="This scan is still being measured." action={<Button variant="secondary" onClick={scan.reload}>Refresh</Button>} />
      </Shell>
    );
  }
  if (s.status === "failed") {
    return (
      <Shell>
        <Notice tone="error" title={s.failure?.message} action={<ButtonLink href="/scan">Try another photo</ButtonLink>}>
          {s.failure?.hint}
        </Notice>
      </Shell>
    );
  }
  return <Snapshot scan={s} goals={goals.data} />;
}

function Snapshot({ scan, goals }: { scan: Scan; goals: Goal[] | null }) {
  const capture = useMemo(() => loadCapture(scan.id), [scan.id]);
  return (
    <Shell>
      <header className="max-w-3xl">
        <p className="mb-4 inline-flex rounded-full bg-berry-milk px-3 py-1 text-xs font-semibold text-berry-deep">Step 2 of 4 · Understand · {shortDate(scan.observed_at)}</p>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] text-espresso">Your skin snapshot</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">{summarise(scan.metrics)}</p>
      </header>
      <div className="mt-6 max-w-3xl">
        <ProvenanceNote provenance={scan.provenance} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Eight measured concerns</h2>
            <p className="text-xs text-ink-3">Scores 1–100 · higher looks better</p>
          </div>
          <ul className="mt-6 space-y-6">
            {scan.metrics.map((m) => (
              <li key={m.key}>
                <MetricBar metric={m} />
              </li>
            ))}
          </ul>
          {scan.missing_metrics.length > 0 && (
            <Notice tone="warn" className="mt-6" title="Some concerns weren't returned">
              YouCam didn&apos;t return {scan.missing_metrics.join(", ")} for this photo, so ProofLoop shows nothing for
              them rather than guessing.
            </Notice>
          )}
          <div className="mt-6 border-t border-line pt-4">
            <BandLegend />
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              The bands are ProofLoop&apos;s way of grouping scores, not a clinical scale. YouCam describes its scores as
              adjusted to be encouraging, so compare them with your own earlier scans rather than with other people.
            </p>
          </div>
          {scan.provider_run && (
            <details className="mt-4 text-sm text-ink-3">
              <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">Technical details</summary>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt>Provider</dt><dd className="text-ink-2">{scan.provider_run.name}</dd>
                <dt>Request</dt><dd className="font-mono text-xs text-ink-2">{scan.provider_run.endpoint}</dd>
                <dt>Concerns</dt><dd className="font-mono text-xs text-ink-2">{scan.provider_run.concerns_requested.join(", ")}</dd>
                <dt>Units</dt><dd className="text-ink-2">{scan.provider_run.units} (documented SD price for 5–8 concerns)</dd>
                {scan.provider_run.duration_s !== null && (<><dt>Time</dt><dd className="text-ink-2">{scan.provider_run.duration_s.toFixed(1)} s</dd></>)}
              </dl>
            </details>
          )}
        </Card>

        <div className="space-y-8">
          <MaskViewer scan={scan} capture={capture} />
          <GoalPicker scan={scan} goals={goals} />
        </div>
      </div>
    </Shell>
  );
}

function MaskViewer({ scan, capture }: { scan: Scan; capture: string | null }) {
  const withMasks = scan.metrics.filter((m) => m.mask_url);
  const [active, setActive] = useState<Metric | null>(withMasks[0] ?? null);
  const [broken, setBroken] = useState(false);
  if (!scan.masks_available || !capture || withMasks.length === 0 || broken) {
    return null;
  }
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Eye aria-hidden className="size-4 text-accent" />
        <h2 className="text-lg font-semibold text-ink">Where YouCam looked</h2>
      </div>
      <p className="mt-1 text-sm text-ink-3">Detection masks returned by YouCam for this scan, over your photo. Links expire within hours and aren&apos;t stored.</p>
      <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={capture} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
        {active?.mask_url && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned provider URL
          <img
            key={active.key}
            src={active.mask_url}
            alt={`${active.label} detection mask`}
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose a mask">
        {withMasks.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={active?.key === m.key}
            onClick={() => setActive(m)}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${active?.key === m.key ? "bg-ink text-paper ring-ink" : "text-ink-2 ring-line-strong hover:bg-sunken"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function GoalPicker({ scan, goals }: { scan: Scan; goals: Goal[] | null }) {
  const go = useGo();
  const scores = Object.fromEntries(scan.metrics.map((m) => [m.key, m]));
  // Testable focuses first (a gain could register), lowest score first; ceiling
  // focuses next; unmeasured last. A focus at the ceiling can still be chosen to
  // watch for a drop, but it can never show an improvement.
  const rank = (m?: Metric) => (!m ? 2 : m.improve_at === null ? 1 : 0);
  const ordered = (goals ?? [])
    .map((g) => ({ goal: g, metric: scores[g.metric] as Metric | undefined }))
    .sort((a, b) => rank(a.metric) - rank(b.metric) || (a.metric?.ui_score ?? 999) - (b.metric?.ui_score ?? 999));
  const [choice, setChoice] = useState<string>("");
  const selected = choice || ordered[0]?.goal.key || "";
  const selectedMetric = ordered.find((o) => o.goal.key === selected)?.metric;

  return (
    <Card className="p-6 sm:p-8">
      <p className="eyebrow">Step 3 of 4 · Choose</p>
      <h2 className="mt-2 font-display text-2xl text-ink">Pick one focus to test</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Each focus is tied to one measured score. Before you start, ProofLoop shows the score a later check-in would need for
        it to call a change, so the test is decided in advance.
      </p>
      {!goals ? (
        <div className="mt-5 space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : (
        <fieldset className="mt-5">
          <legend className="sr-only">Focus</legend>
          <div className="space-y-2">
            {ordered.map(({ goal, metric }, i) => (
              <label
                key={goal.key}
                className={`flex cursor-pointer items-center gap-4 rounded-[var(--radius-md)] p-3.5 ring-1 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  !metric ? "cursor-not-allowed opacity-50 ring-line" : selected === goal.key ? "bg-accent-soft ring-accent/40" : "ring-line hover:bg-sunken"
                }`}
              >
                <input type="radio" name="goal" value={goal.key} className="sr-only" disabled={!metric} checked={selected === goal.key} onChange={() => setChoice(goal.key)} />
                <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full ring-2 ${selected === goal.key ? "ring-accent" : "ring-line-strong"}`}>
                  {selected === goal.key && <span className="size-2.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{goal.label}</span>
                  <span className="block text-xs text-ink-3">
                    {metric ? `${goal.metric_label} ${metric.ui_score} · ${metric.band_label.toLowerCase()}` : "Not measured in this scan"}
                  </span>
                  {metric && (
                    <span className="mt-0.5 block text-xs text-ink-2">
                      {countsAsChange(metric)}
                      {metric.band_evidence === "assumed" && <span className="text-ink-3"> · band assumed</span>}
                    </span>
                  )}
                </span>
                {i === 0 && metric && metric.improve_at !== null && <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[0.7rem] font-semibold text-accent ring-1 ring-accent/30">Most room</span>}
                {metric && metric.improve_at === null && <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">Can&apos;t show gains</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {selectedMetric && selectedMetric.improve_at === null && (
        <Notice tone="warn" className="mt-5" title={`${selectedMetric.label} is already at ${selectedMetric.ui_score}.`}>
          A later scan can&apos;t score high enough to count as an improvement — the scale stops at 100 and the change would
          have to exceed ±{selectedMetric.noise_band}. This focus can only show a drop, so it suits keeping an eye on a
          new product rather than testing whether it helps.
        </Notice>
      )}
      <Button className="mt-6 w-full" disabled={!selected} onClick={() => go(`/matches?scan=${scan.id}&goal=${selected}`)}>
        See matching products <ArrowRight aria-hidden className="size-4" />
      </Button>
    </Card>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>;
}

function Loading() {
  return (
    <Shell>
      <Skeleton className="h-12 w-2/3 max-w-lg" />
      <Skeleton className="mt-4 h-6 w-full max-w-2xl" />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[520px]" />
      </div>
    </Shell>
  );
}

function Missing() {
  return (
    <Shell>
      <Notice title="No scan selected." action={<Link className="font-semibold underline" href="/scan">Start a scan</Link>} />
    </Shell>
  );
}
