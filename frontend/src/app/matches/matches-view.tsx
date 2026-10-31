"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDollarSign, Plus, SlidersHorizontal, Target } from "lucide-react";
import { api } from "@/lib/api";
import { money, TIER_COPY } from "@/lib/format";
import { useMounted, useResource } from "@/lib/hooks";
import { loadDraft } from "@/lib/profile-store";
import type { Match, RecommendationFilters, Reason } from "@/lib/types";
import { ProvenanceBadge } from "@/components/measure";
import { ProductArt } from "@/components/product-art";
import { useAnnounce } from "@/components/announcer";
import { ButtonLink, Card, Notice, Segmented, Skeleton, Toggle } from "@/components/ui";

type Budget = "any" | "25" | "35" | "50";
type Finish = "any" | "light" | "rich";

export function MatchesView() {
  const params = useSearchParams();
  const scanId = params.get("scan");
  const goal = params.get("goal");
  const [budget, setBudget] = useState<Budget>("any");
  const [finish, setFinish] = useState<Finish>("any");
  const [fragranceFree, setFragranceFree] = useState(false);

  const filters: RecommendationFilters = {
    budget_max: budget === "any" ? undefined : Number(budget),
    finish: finish === "any" ? undefined : finish,
    fragrance_free: fragranceFree || undefined,
  };
  const key = scanId && goal ? `recs:${scanId}:${goal}:${budget}:${finish}:${fragranceFree}` : null;
  const recs = useResource(key, () => api.recommendations(scanId!, goal!, filters));

  // After a filter change, one short sentence; the first load is covered by the page heading taking focus.
  const announce = useAnnounce();
  const firstKey = useRef(key);
  useEffect(() => {
    const d = recs.data;
    if (!d || key === firstKey.current || d.status === "no_measurement") return;
    const n = d.matches.length;
    const aside = d.excluded.length > 0 ? ` ${d.excluded.length} set aside by your filters.` : "";
    announce(n === 0 ? `No products match these filters.${aside}` : `${n} ${n === 1 ? "product matches" : "products match"}.${aside}`);
  }, [recs.data, key, announce]);

  if (!scanId || !goal) {
    return <Shell><Notice title="Choose a focus first." action={<Link className="font-semibold underline" href="/scan">Start a scan</Link>} /></Shell>;
  }
  const data = recs.data;

  return (
    <Shell>
      <Link href={`/results?scan=${scanId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Back to your snapshot
      </Link>
      <header className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-berry-milk px-3 py-1 text-xs font-semibold text-berry-deep">Step 3 of 4 · Choose a product</p>
          <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] text-espresso">{data ? data.goal.label : "Matching products"}</h1>
          {data && (
            <p className="mt-3 flex flex-wrap items-center gap-3 text-ink-2">
              <ProvenanceBadge provenance={data.provenance} size="sm" />
              <span>
                {data.goal.metric_label} score:{" "}
                <strong className="tabular text-ink">{data.measurement ?? "—"}</strong>
              </span>
            </p>
          )}
        </div>
        {data && (
          <ul className="space-y-1 text-sm leading-relaxed text-ink-2">
            {data.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
      </header>

      <section aria-label="Filters" className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-5 rounded-[var(--radius-lg)] bg-sunken/70 p-5">
        <SlidersHorizontal aria-hidden className="hidden size-5 self-center text-ink-3 sm:block" />
        <Segmented<Budget> label="Budget" value={budget} onChange={setBudget} options={[{ value: "any", label: "Any" }, { value: "25", label: "≤ $25" }, { value: "35", label: "≤ $35" }, { value: "50", label: "≤ $50" }]} />
        <Segmented<Finish> label="Finish" value={finish} onChange={setFinish} options={[{ value: "any", label: "Any" }, { value: "light", label: "Light" }, { value: "rich", label: "Rich" }]} />
        <div className="pb-1.5"><Toggle label="Fragrance-free only" checked={fragranceFree} onChange={setFragranceFree} /></div>
      </section>

      <div className="mt-8">
        {recs.error && <Notice tone="error" title={recs.error.message}>{recs.error.hint}</Notice>}
        {recs.loading && <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
        {data && data.status === "no_measurement" && <Notice tone="warn" title="This focus wasn't measured in your scan.">Choose another focus from your snapshot.</Notice>}
        {data && data.status === "no_matches" && (
          <Notice tone="warn" title="Nothing in the catalogue fits these filters.">Loosen a filter — the products set aside are listed below with the reason.</Notice>
        )}
        {data && data.matches.length > 0 && (
          <>
            <p className="mb-4 text-sm text-ink-3">{data.matches.length} {data.matches.length === 1 ? "product" : "products"} · {data.ranking_explanation}</p>
            <ProfileMatchNote scanId={scanId} />
            <ol className="space-y-5">
              {data.matches.map((m) => <MatchCard key={m.product.id} match={m} scanId={scanId} goal={goal} />)}
            </ol>
          </>
        )}
        {data && data.excluded.length > 0 && (
          <details className="mt-8 rounded-[var(--radius-md)] p-4 ring-1 ring-line">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">Set aside by your filters ({data.excluded.length})</summary>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-3">
              {data.excluded.map((e) => <li key={e.product_id}><span className="text-ink-2">{e.product_name}</span> — {e.reason}</li>)}
            </ul>
          </details>
        )}
        {data && <p className="mt-10 text-xs leading-relaxed text-ink-3">{data.catalog_disclaimer}</p>}
      </div>
    </Shell>
  );
}

const REASON_ICON: Record<string, typeof Check> = {
  goal: Target,
  also: Plus,
  preference: Check,
  constraint: CircleDollarSign,
  caution: AlertTriangle,
};

function ReasonItem({ reason }: { reason: Reason }) {
  const Icon = REASON_ICON[reason.kind] ?? Check;
  const caution = reason.kind === "caution";
  return (
    <li className={`flex gap-2.5 text-sm leading-relaxed ${caution ? "text-demo" : "text-ink-2"}`}>
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${caution ? "text-demo" : "text-accent"}`} />
      <span><span className="sr-only">{reason.kind}: </span>{reason.text}</span>
    </li>
  );
}

/** Shown when skin-profile answers will be saved: matching never reads them. */
function ProfileMatchNote({ scanId }: { scanId: string }) {
  const mounted = useMounted();
  if (!mounted || !loadDraft(scanId)?.save) return null;
  return <p className="-mt-2 mb-4 text-sm text-ink-3">Matches use your focus and preferences, not your skin-type reading.</p>;
}

function MatchCard({ match, scanId, goal }: { match: Match; scanId: string; goal: string }) {
  const p = match.product;
  const tier = TIER_COPY[match.tier];
  const tierStyle = match.tier === "strong" ? "bg-better-soft text-better" : match.tier === "good" ? "bg-sunken text-ink" : "bg-demo-soft text-demo";
  return (
    <li>
      <Card className="grid grid-cols-[84px_1fr] gap-4 p-4 sm:grid-cols-[180px_1fr] sm:gap-6 sm:p-6">
        <ProductArt product={p} className="aspect-[5/6] w-full" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{p.brand} · {p.category}</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{p.name}</h2>
              <p className="mt-1 text-sm text-ink-3">{p.texture} · {p.size_ml} ml · {p.fragrance_free ? "fragrance-free" : "contains fragrance"}</p>
            </div>
            <div className="text-right">
              <p className="tabular font-display text-2xl text-ink">{money(p.price)}</p>
              <span title={tier.detail} className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tierStyle}`}>
                #{match.rank} · {tier.label}
              </span>
            </div>
          </div>
          <div className="mt-4 rounded-[var(--radius-md)] bg-paper p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Why it&apos;s here</p>
            <ul className="mt-2.5 space-y-2">{match.reasons.map((r) => <ReasonItem key={r.text} reason={r} />)}</ul>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-3">{tier.detail}</p>
            <ButtonLink href={`/product?id=${p.id}&scan=${scanId}&goal=${goal}`} variant="secondary" size="sm">
              Details &amp; trial <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Card>
    </li>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>;
}
