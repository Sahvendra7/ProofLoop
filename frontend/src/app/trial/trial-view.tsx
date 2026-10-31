"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Camera, ClipboardCheck, FlaskConical, Gauge, Minus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EVIDENCE_COPY, NEXT_STEP_COPY, OUTCOME_COPY, shortDate, VERDICT_COPY } from "@/lib/format";
import { focusWhenRendered } from "@/lib/focus";
import { useDocumentTitle, useResource } from "@/lib/hooks";
import type { Change, Comparison, InstrumentCheck as Check, Protocol, Trial } from "@/lib/types";
import { useAnnounce } from "@/components/announcer";
import { BandChart } from "@/components/band-chart";
import { Dial } from "@/components/dial";
import { ProvenanceNote } from "@/components/measure";
import { ProductArt } from "@/components/product-art";
import { Button, ButtonLink, CapsText, Card, FlowProgress, Notice, Skeleton, pageTitleClass } from "@/components/ui";
import { AssistantPanel } from "./assistant-panel";
import { ProfileBlock } from "./profile-block";
import { ResultInWords } from "./result-in-words";

export function TrialView() {
  const id = useSearchParams().get("id");
  const trial = useResource(id ? `trial:${id}` : null, () => api.trial(id!));
  if (!id) return <Shell><Notice title="No trial selected." action={<Link className="font-semibold underline" href="/trials">See my trials</Link>} /></Shell>;
  if (trial.error) return <Shell><Notice tone="error" title={trial.error.message}>{trial.error.hint}</Notice></Shell>;
  if (!trial.data) return <Shell><Skeleton className="h-16 w-2/3" /><Skeleton className="mt-8 h-96" /></Shell>;
  return <TrialDetail trial={trial.data} onUpdate={trial.setData} />;
}

function TrialDetail({ trial, onUpdate }: { trial: Trial; onUpdate: (t: Trial) => void }) {
  const focusBand = trial.focus_noise_band;
  const pendingCheckin = trial.checkins.find((c) => c.status === "processing");
  useDocumentTitle(
    `${trial.comparison ? OUTCOME_COPY[trial.comparison.focus_outcome].headline.replace(/\.$/, "") : "Waiting for check-in"} · ${trial.goal.label} · ProofLoop`,
  );
  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <header className="max-w-3xl">
          <FlowProgress step={4} note={`started ${shortDate(trial.baseline.observed_at)}`} />
          <h1 className={pageTitleClass}>{trial.goal.label}</h1>
          <p className="mt-3 text-lg text-ink-2">with {trial.product.name} <span className="text-ink-3">by {trial.product.brand}</span></p>
        </header>
        <ProductArt product={trial.product} className="hidden aspect-[5/6] w-32 lg:block" />
      </div>
      <div className="mt-6 max-w-3xl"><ProvenanceNote provenance={trial.provenance} /></div>

      {trial.comparison ? (
        <Verdict trial={trial} comparison={trial.comparison} band={focusBand} />
      ) : (
        <Waiting trial={trial} onUpdate={onUpdate} />
      )}

      <AssistantPanel trial={trial} onUpdate={onUpdate} />

      <InstrumentCheck trial={trial} check={trial.protocol.instrument_check} onUpdate={onUpdate} />

      <ProtocolCard trial={trial} protocol={trial.protocol} decided={trial.comparison !== null} />

      <ProfileBlock trial={trial} onUpdate={onUpdate} />

      {pendingCheckin && (
        <Notice
          className="mt-6"
          title="A check-in is still being measured."
          action={<CheckAgain trial={trial} onUpdate={onUpdate} pending={(t) => t.checkins.some((c) => c.status === "processing")} then="verdict" />}
        >
          It usually takes 8–15 seconds.
        </Notice>
      )}

      {trial.history.length > 0 && (
        <Card className="mt-8 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">{trial.goal.metric_label} over this trial</h2>
          <div className="mt-4">
            <BandChart
              metricLabel={trial.goal.metric_label}
              band={focusBand}
              points={trial.history
                .filter((h) => h.focus_score !== null)
                .map((h) => ({
                  label: h.is_baseline
                    ? `Baseline · ${shortDate(h.observed_at)}`
                    : h.synthetic
                      ? `Day ${daysBetween(trial.baseline.observed_at, h.observed_at)} · synthetic`
                      : shortDate(h.observed_at),
                  score: h.focus_score!,
                  baseline: h.is_baseline,
                  synthetic: h.synthetic,
                }))}
            />
          </div>
        </Card>
      )}
    </Shell>
  );
}

function Waiting({ trial, onUpdate }: { trial: Trial; onUpdate: (t: Trial) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const demo = trial.provenance.kind === "demo";
  const base = trial.baseline.metrics.find((m) => m.key === trial.goal.metric);

  async function demoFollowup() {
    setBusy(true);
    try {
      onUpdate(await api.demoCheckin(trial.id));
      // The verdict replaces this card (and the button that was pressed): its heading takes focus.
      focusWhenRendered("verdict");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Couldn't create the demo follow-up.", 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="p-6 sm:p-8">
        <p className="eyebrow"><CapsText>Baseline saved</CapsText></p>
        <p className="tabular mt-3 font-condensed text-7xl font-bold leading-none text-ink">{base?.ui_score ?? "—"}</p>
        <p className="mt-1 text-ink-2">{trial.goal.metric_label} score on {shortDate(trial.baseline.observed_at)}</p>
        <h2 className="mt-8 text-lg font-semibold text-ink">Check in on or after {shortDate(trial.protocol.planned_checkin_at)}</h2>
        <ul className="mt-3 space-y-2 text-ink-2">
          <li>• Same spot and similar light as today — before any units are spent, ProofLoop checks the new photo&apos;s lighting against this baseline</li>
          <li>• Same camera — pores and texture scores are sensitive to image sharpness</li>
          <li>• No makeup, hair off your forehead, glasses off</li>
          <li>• Keep the rest of your routine steady so the test stays fair</li>
        </ul>
        {!demo && trial.protocol.instrument_check.status !== "processing" && (
          <ButtonLink href={`/scan?trial=${trial.id}`} className="mt-6">
            <Camera aria-hidden className="size-4" /> Check in now
          </ButtonLink>
        )}
      </Card>
      {demo && (
        <div className="hatch rounded-[var(--radius-xl)] bg-demo-soft p-6 ring-1 ring-demo/25 sm:p-8">
          <FlaskConical aria-hidden className="size-6 text-demo" />
          <h2 className="mt-4 font-display text-2xl text-ink">See how a verdict works</h2>
          <p className="mt-2 leading-relaxed text-ink-2">
            Sample-data trials can show a <strong>synthetic</strong> follow-up dated 21 days later. Its changes are fixed and mixed —
            some beyond normal variation, some within, one going the wrong way — so you can see every kind of answer. It is not a
            measurement and never appears in a real trial.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-worse">{error.message}</p>}
          <Button className="mt-5" onClick={demoFollowup} loading={busy}>Show synthetic 21-day follow-up</Button>
        </div>
      )}
    </div>
  );
}

function Verdict({ trial, comparison, band }: { trial: Trial; comparison: Comparison; band: number }) {
  const outcome = OUTCOME_COPY[comparison.focus_outcome];
  const focus = comparison.changes.find((c) => c.metric === comparison.focus_metric);
  const synthetic = trial.checkins.some((c) => c.id === comparison.current_scan_id && c.synthetic_timeline);
  // A beyond-band change gets the strongest treatment whichever way it moved;
  // direction is carried by words and arrows, not by a "good news" colour.
  const changed = comparison.focus_outcome === "measured_improvement" || comparison.focus_outcome === "measured_decline";
  const unclear = comparison.focus_outcome === "inconclusive" || comparison.focus_outcome === "insufficient_data";
  const panel = changed
    ? "night-stage grain text-white"
    : unclear
      ? "border-2 border-dashed border-line-strong bg-white text-espresso"
      : "bg-berry-milk text-espresso";
  const sub = changed ? "text-white/85" : "text-ink-2";
  const hasNumbers = focus && focus.baseline !== null && focus.current !== null;

  return (
    <>
      {/* Not a named region: VoiceOver read the headline twice ("…heading, …region") when focus moved to it. */}
      <section className={`mt-10 overflow-hidden rounded-[var(--radius-stage)] p-7 sm:p-12 ${changed ? "on-night" : ""} ${panel}`}>
        <div className="grid gap-10 md:grid-cols-[1.25fr_1fr] md:items-center">
          <div>
            {synthetic && (
              <p className="hatch mb-5 inline-flex items-center gap-2 rounded-full bg-demo-soft px-3 py-1 text-xs font-semibold text-demo ring-1 ring-demo/25">
                <FlaskConical aria-hidden className="size-3.5" /> Synthetic follow-up — not a measurement
              </p>
            )}
            <p className={`text-xs font-semibold ${sub}`}>
              <CapsText>{synthetic ? "Demo verdict" : "Verdict"} · {trial.goal.metric_label} · {comparison.comparability.days_apart} days apart</CapsText>
            </p>
            {comparison.early && (
              <p className={`mt-2 text-sm font-semibold ${sub}`}>
                Early look: day {Math.round(comparison.comparability.days_apart)} of a planned {trial.protocol.planned_checkin_days}-day test.
              </p>
            )}
            <h2 id="verdict" tabIndex={-1} className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-bold leading-[0.95] tracking-[-0.03em] [font-variation-settings:'wdth'_80]">
              {outcome.headline}
            </h2>
            <p className={`mt-5 max-w-xl text-lg leading-relaxed ${sub}`}>{outcome.body}</p>
          </div>
          {hasNumbers && (
            <div className={`mx-auto w-full max-w-sm ${unclear ? "opacity-60 grayscale" : ""}`}>
              <Dial
                baseline={focus.baseline!}
                band={band}
                current={unclear ? undefined : focus.current!}
                span={Math.max(12, band * 2 + 4, Math.abs(focus.delta ?? 0) + 4)}
                label={`${trial.goal.metric_label} verdict`}
                tone={changed ? "dark" : "light"}
                beyond={changed}
                summary={`${trial.goal.metric_label} dial: baseline ${focus.baseline}${unclear ? "" : `, check-in ${focus.current}`}, normal variation plus or minus ${band} points. The result is described in words below.`}
                caption={
                  <p className={`text-sm font-semibold ${sub}`}>
                    {focus.delta! > 0 ? "+" : ""}
                    {focus.delta} {Math.abs(focus.delta ?? 0) === 1 ? "point" : "points"} · normal variation ±{band}
                    {focus.band_evidence === "assumed" ? " (assumed)" : ""}
                  </p>
                }
              >
                <p className="tabular whitespace-nowrap font-condensed text-[clamp(2rem,10vw,2.6rem)] font-bold leading-none">
                  {focus.baseline} <span className="opacity-50">→</span> {focus.current}
                </p>
              </Dial>
            </div>
          )}
        </div>
      </section>

      <ResultInWords trial={trial} comparison={comparison} synthetic={synthetic} />

      <NextStep trial={trial} comparison={comparison} synthetic={synthetic} />

      <Comparability comparison={comparison} />

      <Card className="mt-8 overflow-hidden">
        <div className="p-6 pb-2 sm:px-8">
          <h2 className="text-lg font-semibold text-ink">Every measured concern</h2>
          <p className="mt-1 text-sm text-ink-3">
            Only your focus was decided in advance, so only it gives the verdict. The others are context: with eight scores, one
            can cross its band by chance.
          </p>
        </div>
        {/* Focusable so keyboard users can scroll the table horizontally on small screens. */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Every measured concern, scrollable table">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold sm:px-8"><CapsText>Concern</CapsText></th>
                <th scope="col" className="px-3 py-3 text-right font-semibold"><CapsText>Baseline</CapsText></th>
                <th scope="col" className="px-3 py-3 text-right font-semibold"><CapsText>Now</CapsText></th>
                <th scope="col" className="px-3 py-3 text-right font-semibold"><CapsText>Change</CapsText></th>
                <th scope="col" className="px-6 py-3 font-semibold sm:px-8"><CapsText>Reading</CapsText></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {comparison.changes.map((c) => <ChangeRow key={c.metric} change={c} focus={c.metric === comparison.focus_metric} />)}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function NextStep({ trial, comparison, synthetic }: { trial: Trial; comparison: Comparison; synthetic: boolean }) {
  const step = comparison.next_step;
  const copy = NEXT_STEP_COPY[step.action];
  const live = trial.provenance.kind !== "demo";
  return (
    <section aria-labelledby="next-step" className="mt-6 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <p className="eyebrow inline-flex items-center gap-2">
        <ArrowRight aria-hidden className="size-4" /> <CapsText>{synthetic ? "Next step (demo)" : "Next step"} · follows from your plan</CapsText>
      </p>
      <h2 id="next-step" className="mt-2 font-display text-2xl text-ink">{copy.title}</h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-ink-2">{copy.body}</p>
      {step.action === "consider_switching" && (
        <ButtonLink href={`/matches?scan=${step.baseline_scan_id}&goal=${step.goal}`} variant="secondary" className="mt-5">
          See other matches for {trial.goal.label.toLowerCase()}
        </ButtonLink>
      )}
      {step.action === "retake" && live && (
        <ButtonLink href={`/scan?trial=${trial.id}`} variant="secondary" className="mt-5">
          <Camera aria-hidden className="size-4" /> Retake the check-in
        </ButtonLink>
      )}
    </section>
  );
}

/** Measure how much this user's own score moves on unchanged skin, before the trial counts anything. */
function InstrumentCheck({ trial, check, onUpdate }: { trial: Trial; check: Check; onUpdate: (t: Trial) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const metric = trial.goal.metric_label;
  const metricLower = metric.toLowerCase();

  async function runSample() {
    setBusy(true);
    setError(null);
    try {
      onUpdate(await api.demoRepeat(trial.id));
      // The result heading replaces the question it asked; focus moves there.
      focusWhenRendered("instrument-title");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Couldn't run the sample instrument check.", 0));
    } finally {
      setBusy(false);
    }
  }

  if (check.status === "unavailable") {
    return (
      <p className="mt-8 max-w-3xl text-sm text-ink-3">
        No instrument check was taken before the first check-in, so this trial uses the standard ±{check.table_band}-point band.
      </p>
    );
  }

  const start =
    check.status === "available" || check.status === "failed" ? (
      check.sample ? (
        <Button className="mt-5" onClick={runSample} loading={busy}>
          <Gauge aria-hidden className="size-4" /> Run the sample instrument check (recorded, free)
        </Button>
      ) : (
        <ButtonLink href={`/scan?trial=${trial.id}&repeat=1`} className="mt-5">
          <Camera aria-hidden className="size-4" /> Take a second photo now ({check.units} units)
        </ButtonLink>
      )
    ) : null;

  return (
    // Not a named region, like the verdict: its heading takes focus, and naming the section after it reads it twice.
    <section className="mt-8 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <p className="eyebrow inline-flex items-center gap-2">
        <Gauge aria-hidden className="size-4" /> <CapsText>Instrument check{check.sealed ? " · part of the plan" : " · optional, before your first check-in"}</CapsText>
      </p>
      <h2 id="instrument-title" tabIndex={-1} className="mt-2 font-display text-2xl text-ink">
        {check.status === "complete" && check.spread !== null
          ? check.widened
            ? `Your two scans differed by ${check.spread} on ${metricLower}. Your band is now ±${check.personal_band}.`
            : `Your two scans differed by ${check.spread} on ${metricLower}: your band stays ±${check.table_band}.`
          : "How much does your own score move when nothing has changed?"}
      </h2>

      {(check.status === "available" || check.status === "failed") && (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
          ProofLoop&apos;s ±{check.table_band}-point band was measured on one stock photo. Step away, come back and take a fresh photo in
          the same spot: if your two scans disagree by more than that, your band widens to fit them before anything counts. It can only
          make the test stricter, never easier.
        </p>
      )}
      {check.status === "failed" && (
        <Notice tone="warn" className="mt-4" title="Your instrument check didn't complete.">
          Your band is unchanged, and you can try again.
        </Notice>
      )}
      {check.status === "processing" && (
        <div className="mt-3 space-y-3">
          <p className="text-ink-2">Your second photo is being measured. Check-ins wait until it&apos;s done.</p>
          <CheckAgain trial={trial} onUpdate={onUpdate} pending={(t) => t.protocol.instrument_check.status === "processing"} then="instrument-title" />
        </div>
      )}

      {check.status === "complete" && (
        <>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
            {check.widened
              ? `Wider than the standard ±${check.table_band} band, so your plan's lines moved out to match it. A later scan now has to move further before ProofLoop calls a change.`
              : `That's within the standard ±${check.table_band} band, so your plan is unchanged.`}{" "}
            This check can only widen a band, never narrow it. Because the photos are minutes apart, day-to-day differences in light and skin
            can still add more.
          </p>
          {check.changes.length > 0 && (
            <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Instrument check, scrollable table">
              <table className="w-full min-w-[460px] text-left text-sm">
                <caption className="sr-only">Baseline scan and second scan of unchanged skin, by concern</caption>
                <thead className="text-xs text-ink-3">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold"><CapsText>Concern</CapsText></th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold"><CapsText>Baseline</CapsText></th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold"><CapsText>Second scan</CapsText></th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold"><CapsText>Difference</CapsText></th>
                    <th scope="col" className="py-2 pl-3 font-semibold"><CapsText>Standard band</CapsText></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {check.changes.map((c) => (
                    <tr key={c.metric} className={c.metric === trial.goal.metric ? "bg-accent-soft/50" : undefined}>
                      <th scope="row" className="py-2 pr-3 font-medium text-ink">
                        {c.label}
                        {c.metric === trial.goal.metric && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold text-white">Focus</span>}
                      </th>
                      <td className="tabular px-3 py-2 text-right text-ink-2">{c.baseline ?? "—"}</td>
                      <td className="tabular px-3 py-2 text-right text-ink">{c.current ?? "—"}</td>
                      <td className="tabular px-3 py-2 text-right font-semibold text-ink">
                        {c.delta === null ? "—" : `${c.delta > 0 ? "+" : ""}${c.delta}`}
                      </td>
                      <td className="py-2 pl-3 text-ink-2">
                        {c.delta === null ? "Not measured twice" : c.verdict === "within_variation" ? `Within ±${c.noise_band}` : `Beyond ±${c.noise_band}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {check.sample && check.note && (
        <p className="hatch mt-5 rounded-[var(--radius-md)] bg-demo-soft p-3 text-xs leading-relaxed text-ink-2 ring-1 ring-demo/25">
          <FlaskConical aria-hidden className="mr-1 inline size-3.5 text-demo" /> {check.note}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-worse">{error.message}</p>}
      {start}
    </section>
  );
}

function ChangeRow({ change, focus }: { change: Change; focus: boolean }) {
  const v = VERDICT_COPY[change.verdict];
  const Icon = change.verdict === "better" ? ArrowUpRight : change.verdict === "worse" ? ArrowDownRight : Minus;
  const color = v.tone === "better" ? "text-better" : v.tone === "worse" ? "text-worse" : "text-ink-3";
  return (
    <tr className={focus ? "bg-accent-soft/50" : undefined}>
      <th scope="row" className="px-6 py-3 font-medium text-ink sm:px-8">
        {change.label} {focus && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold text-white">Focus</span>}
      </th>
      <td className="tabular px-3 py-3 text-right text-ink-2">{change.baseline ?? "—"}</td>
      <td className="tabular px-3 py-3 text-right text-ink">{change.current ?? "—"}</td>
      <td className={`tabular px-3 py-3 text-right font-semibold ${color}`}>
        {change.delta === null ? "—" : `${change.delta > 0 ? "+" : ""}${change.delta}`}
      </td>
      <td className={`px-6 py-3 sm:px-8 ${color}`}>
        <span className="inline-flex items-center gap-1.5"><Icon aria-hidden className="size-4" />{v.label}</span>
        <span className="ml-1 text-xs text-ink-3">
          (±{change.noise_band}
          {change.band_evidence === "assumed" ? ", assumed" : ""})
        </span>
      </td>
    </tr>
  );
}

function Comparability({ comparison }: { comparison: Comparison }) {
  const { level, issues } = comparison.comparability;
  const title = level === "good" ? "Comparable conditions" : level === "fair" ? "Comparable, with caveats" : "Not comparable";
  return (
    <Notice tone={level === "good" ? "info" : level === "fair" ? "warn" : "error"} live={false} className="mt-6" title={`${title}: how fair is this comparison?`}>
      {issues.length === 0 ? (
        "Lighting and capture method were similar in both photos."
      ) : (
        <ul className="list-disc space-y-1 pl-4">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
      )}
    </Notice>
  );
}

function ProtocolCard({ trial, protocol, decided }: { trial: Trial; protocol: Protocol; decided: boolean }) {
  const base = protocol.baseline_score;
  const evidence = EVIDENCE_COPY[protocol.band_evidence];
  const lum = protocol.baseline_capture.luminance_mean;
  const zones = [
    {
      key: "down",
      label: "Measured change, down",
      value: protocol.decline_at !== null ? `${protocol.decline_at} or lower` : "Can't register",
    },
    {
      key: "none",
      label: "No clear change",
      value:
        base === null
          ? "—"
          : `${protocol.decline_at !== null ? protocol.decline_at + 1 : 0}–${protocol.improve_at !== null ? protocol.improve_at - 1 : 100}`,
    },
    {
      key: "up",
      label: "Measured change, up",
      value: protocol.improve_at !== null ? `${protocol.improve_at} or higher` : "Can't register",
    },
  ];
  return (
    <section aria-labelledby="protocol-title" className="mt-8 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow inline-flex items-center gap-2">
            <ClipboardCheck aria-hidden className="size-4" /> <CapsText>{decided ? "The plan this verdict was judged against" : "Your fair-test plan"}</CapsText>
          </p>
          <h2 id="protocol-title" className="mt-2 font-display text-2xl text-ink">
            Decided before the check-in, not after
          </h2>
        </div>
        <p className="rounded-full bg-sunken px-3 py-1 text-xs font-semibold text-ink-2">
          {protocol.registered ? `Fixed ${shortDate(trial.created_at)}` : "Reconstructed: trial predates saved plans"}
        </p>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
        From your baseline {trial.goal.metric_label.toLowerCase()} score of <strong className="text-ink">{base ?? "—"}</strong>, a later scan has to
        move further than ±{protocol.noise_band} points before ProofLoop calls it a change. These lines don&apos;t move after the trial starts.
      </p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="What the check-in score would mean">
        {zones.map((z) => (
          <li key={z.key} className={`rounded-[var(--radius-md)] p-4 ring-1 ${z.key === "none" ? "bg-berry-milk/60 ring-line" : "bg-paper ring-line"}`}>
            <p className="text-xs font-semibold text-ink-3"><CapsText>{z.label}</CapsText></p>
            <p className="tabular mt-1 font-condensed text-3xl font-bold text-ink">{z.value}</p>
          </li>
        ))}
      </ol>
      {protocol.detectable === "decline_only" && (
        <p className="mt-3 text-sm text-ink-2">
          Your baseline is near the top of the scale, so this trial can only detect a drop. It watches for a downside; it can&apos;t show a gain.
        </p>
      )}
      <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-ink">Normal variation</dt>
          <dd className="mt-1 text-ink-2">
            ±{protocol.noise_band} points, <span className="font-semibold">{evidence.label}</span>. {evidence.detail}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Planned check-in</dt>
          <dd className="mt-1 text-ink-2">
            {shortDate(protocol.planned_checkin_at)} (day {protocol.planned_checkin_days}). An earlier check-in is labelled an early look.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Conditions to match</dt>
          <dd className="mt-1 text-ink-2">
            {protocol.baseline_capture.source === "camera" ? "Camera photo" : protocol.baseline_capture.source === "upload" ? "Uploaded photo" : "Sample data"}
            {lum !== null ? `, brightness ${Math.round(lum)} of 255` : ""}.{" "}
            {protocol.baseline_capture.source === "sample"
              ? "Sample trials take no real check-ins."
              : "Check-in photos are compared with this before any units are spent."}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Re-reads the trial in place of "refresh the page": says so if it's still measuring, else focuses the result. */
function CheckAgain({ trial, onUpdate, pending, then }: { trial: Trial; onUpdate: (t: Trial) => void; pending: (t: Trial) => boolean; then: string }) {
  const [busy, setBusy] = useState(false);
  const announce = useAnnounce();
  async function check() {
    setBusy(true);
    try {
      const fresh = await api.trial(trial.id);
      onUpdate(fresh);
      if (pending(fresh)) announce("Still being measured. Try again in a few seconds.");
      else focusWhenRendered(then);
    } catch {
      announce("Couldn't check just now. Try again in a few seconds.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={check} loading={busy}>
      Check again
    </Button>
  );
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">{children}</div>;
}
