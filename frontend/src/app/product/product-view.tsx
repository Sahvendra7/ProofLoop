"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useGo } from "@/lib/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarCheck, Check, Plus, Sparkles, Target } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { dataUrlToBlob, loadCapture } from "@/lib/capture-store";
import { money, TIER_COPY } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import { clearDraft, loadDraft } from "@/lib/profile-store";
import type { Goal, Match, Product, Scan, Simulation } from "@/lib/types";
import { ProvenanceBadge } from "@/components/measure";
import { ProductArt } from "@/components/product-art";
import { Button, Card, Notice, Segmented, Skeleton } from "@/components/ui";

const SIM_PHRASE: Record<string, string> = {
  calm_redness: "less visible redness",
  smooth_texture: "smoother-looking texture",
  refine_pores: "less visible pores",
  clearer_look: "fewer visible blemishes",
  radiance: "more radiance",
  brighter_eyes: "less visible dark circles",
};

const METRIC_LABEL: Record<string, string> = {
  moisture: "Hydration", oiliness: "Oil balance", redness: "Redness", texture: "Texture",
  pore: "Pores", acne: "Blemishes", radiance: "Radiance", dark_circle: "Under-eye",
};

export function ProductView() {
  const params = useSearchParams();
  const id = params.get("id");
  const scanId = params.get("scan");
  const goal = params.get("goal");
  const product = useResource(id ? `product:${id}` : null, () => api.product(id!));
  const scan = useResource(scanId ? `scan:${scanId}` : null, () => api.scan(scanId!));
  const recs = useResource(scanId && goal ? `recs:${scanId}:${goal}` : null, () => api.recommendations(scanId!, goal!));

  if (!id) return <Shell><Notice title="No product selected." /></Shell>;
  if (product.error) return <Shell><Notice tone="error" title={product.error.message} /></Shell>;
  if (!product.data) return <Shell><Skeleton className="h-[560px]" /></Shell>;
  const p = product.data;
  const match = recs.data?.matches.find((m) => m.product.id === p.id) ?? null;

  return (
    <Shell>
      {scanId && goal && (
        <Link href={`/matches?scan=${scanId}&goal=${goal}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> Back to matches
        </Link>
      )}
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <ProductArt product={p} className="aspect-[5/6] w-full" />
          <Facts product={p} />
        </div>
        <div className="space-y-6">
          <header>
            <p className="eyebrow">{p.brand} · {p.category}</p>
            <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] text-espresso">{p.name}</h1>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="tabular font-display text-3xl text-ink">{money(p.price)}</span>
              <span className="text-ink-3">{p.size_ml} ml</span>
            </p>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">{p.description}</p>
          </header>
          {scanId && goal && <MatchLogic match={match} loading={recs.loading} goalLabel={recs.data?.goal.label} scan={scan.data} />}
          {scan.data && recs.data && <SimulationCard scan={scan.data} goal={recs.data.goal} />}
          {scan.data && recs.data && match && <TrialCard scan={scan.data} goal={recs.data.goal} product={p} />}
          <p className="text-xs leading-relaxed text-ink-3">Sample catalogue: this is a fictional product used to demonstrate matching. It isn&apos;t for sale.</p>
        </div>
      </div>
    </Shell>
  );
}

function Facts({ product: p }: { product: Product }) {
  return (
    <section aria-labelledby="facts" className="mt-8">
      <h2 id="facts" className="eyebrow">Product facts · from the catalogue</h2>
      <dl className="mt-4 divide-y divide-line rounded-[var(--radius-lg)] ring-1 ring-line">
        {[
          ["Texture", `${p.texture} · ${p.finish} finish`],
          ["Routine step", p.routine_step],
          ["Fragrance", p.fragrance_free ? "Fragrance-free" : "Contains fragrance"],
          ["Targets", [...p.primary_targets.map((t) => METRIC_LABEL[t]), ...p.secondary_targets.map((t) => `${METRIC_LABEL[t]} (secondary)`)].join(", ")],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3 text-sm">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink first-letter:uppercase">{v}</dd>
          </div>
        ))}
        <div className="px-4 py-3 text-sm">
          <dt className="text-ink-3">Key ingredients</dt>
          <dd className="mt-2">
            <ul className="space-y-1.5">
              {p.key_ingredients.map((i) => (
                <li key={i.name} className="flex flex-wrap justify-between gap-2"><span className="text-ink">{i.name}</span><span className="text-ink-3">{i.role}</span></li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-3">Ingredient roles are their common cosmetic functions, not claims about results.</p>
    </section>
  );
}

function MatchLogic({ match, loading, goalLabel, scan }: { match: Match | null; loading: boolean; goalLabel?: string; scan: Scan | null }) {
  if (loading) return <Skeleton className="h-40" />;
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">Match logic · from your scan</h2>
        {scan && <ProvenanceBadge provenance={scan.provenance} size="sm" />}
      </div>
      {!match ? (
        <p className="mt-3 text-ink-2">This product isn&apos;t a match for this focus{goalLabel ? ` (${goalLabel})` : ""}.</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold text-ink">{TIER_COPY[match.tier].label} · {goalLabel}</p>
          <p className="text-sm text-ink-3">{TIER_COPY[match.tier].detail}</p>
          <ul className="mt-4 space-y-2">
            {match.reasons.map((r) => {
              const Icon = r.kind === "caution" ? AlertTriangle : r.kind === "goal" ? Target : r.kind === "also" ? Plus : Check;
              return (
                <li key={r.text} className={`flex gap-2.5 text-sm leading-relaxed ${r.kind === "caution" ? "text-demo" : "text-ink-2"}`}>
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />{r.text}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function SimulationCard({ scan, goal }: { scan: Scan; goal: Goal }) {
  const capture = useMemo(() => loadCapture(scan.id), [scan.id]);
  const [intensity, setIntensity] = useState<"0.2" | "0.4">("0.4");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; sim: Simulation } | { kind: "error"; err: ApiError }>({ kind: "idle" });

  let unavailable: string | null = null;
  if (!goal.simulation_available) unavailable = `YouCam's AI Skin Simulation doesn't support ${goal.metric_label.toLowerCase()}, so there's no goal preview for this focus. ProofLoop shows nothing rather than an imitation.`;
  else if (scan.provenance.kind !== "youcam") unavailable = "Previews are generated from your own photo, so they need a live scan. Sample data has no photo.";
  else if (!capture) unavailable = "Your photo is no longer held in this browser tab. Scan again to generate a preview.";

  async function run() {
    if (!capture) return;
    setState({ kind: "loading" });
    try {
      const sim = await api.simulate(await dataUrlToBlob(capture), goal.key, Number(intensity));
      setState({ kind: "done", sim });
    } catch (err) {
      setState({ kind: "error", err: err instanceof ApiError ? err : new ApiError("unknown", "The preview failed.", 0) });
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-accent" />
        <h2 className="text-lg font-semibold text-ink">Preview the goal</h2>
      </div>
      {goal.simulation_available && (
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          YouCam&apos;s AI Skin Simulation can render your photo with {SIM_PHRASE[goal.key] ?? "this concern less visible"}. It shows
          what the goal looks like — not what this product will do.
        </p>
      )}
      {unavailable ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-sunken p-3 text-sm text-ink-2">{unavailable}</p>
      ) : state.kind === "done" && capture ? (
        <BeforeAfter before={capture} after={state.sim.image_url} label={goal.metric_label} sim={state.sim} />
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Segmented<"0.2" | "0.4"> label="Strength" value={intensity} onChange={setIntensity} options={[{ value: "0.2", label: "Subtle" }, { value: "0.4", label: "Balanced" }]} />
          <Button variant="secondary" onClick={run} loading={state.kind === "loading"}>
            {state.kind === "loading" ? "Generating with YouCam…" : "Generate preview"}
          </Button>
          <p className="w-full text-xs text-ink-3">Sends your framed photo to YouCam once more · uses 4 API units.</p>
          {state.kind === "error" && <Notice tone="error" className="w-full" title={state.err.message}>{state.err.hint}</Notice>}
        </div>
      )}
    </Card>
  );
}

function BeforeAfter({ before, after, label, sim }: { before: string; after: string; label: string; sim: Simulation }) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="mt-4">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- provider-hosted, short-lived */}
        <img src={after} alt={`YouCam simulation with less visible ${label.toLowerCase()}`} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={before} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div aria-hidden className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${split}%` }} />
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Your photo</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">YouCam simulation</span>
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare your photo with the simulation" className="mt-3 w-full accent-[var(--color-accent)]" />
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-3">
        Generated by {sim.provider} ({sim.endpoint}, {sim.concern} at {sim.intensity}). An appearance preview, not a prediction of
        product results. {sim.expires_note}
      </figcaption>
    </figure>
  );
}

function TrialCard({ scan, goal, product }: { scan: Scan; goal: Goal; product: Product }) {
  const go = useGo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const demo = scan.provenance.kind === "demo";
  // Sent only if the user chose to save their answers; frozen with the plan from this moment on.
  const [draft] = useState(() => loadDraft(scan.id));
  const saving = draft?.save === true;
  async function start() {
    setBusy(true);
    try {
      const trial = await api.createTrial({
        scan_id: scan.id,
        goal: goal.key,
        product_id: product.id,
        ...(saving && draft ? { profile: draft.profile } : {}),
      });
      if (saving) clearDraft(scan.id);
      go(`/trial?id=${trial.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Couldn't start the trial.", 0));
      setBusy(false);
    }
  }
  return (
    <div className="rounded-[var(--radius-xl)] bg-ink p-6 text-paper sm:p-7">
      <CalendarCheck aria-hidden className="size-6 text-paper/70" />
      <h2 className="mt-4 font-display text-2xl">Start a trial with this product</h2>
      <p className="mt-2 leading-relaxed text-paper/75">
        This scan becomes your baseline for “{goal.label}”. Use the product as directed, then check in after 3–4 weeks in
        similar light. ProofLoop will compare the two scans and tell you whether {goal.metric_label.toLowerCase()} moved beyond normal variation.
      </p>
      {demo && <p className="mt-3 text-sm text-paper/70">This is a sample-data trial. You&apos;ll be able to view a clearly labelled synthetic follow-up.</p>}
      {saving && (
        <p className="mt-3 text-sm text-paper/75">
          Your plan is fixed when you start. Your answers and the camera&apos;s reading are saved with it as they are today;
          changing them later won&apos;t change the plan.
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-[#ffb4a2]">{error.message}</p>}
      <Button className="mt-5 bg-paper !text-ink hover:!bg-white" onClick={start} loading={busy}>
        Save baseline &amp; start trial
      </Button>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>;
}
