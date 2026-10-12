"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clearCaptures } from "@/lib/capture-store";
import { shortDate } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import { ProvenanceBadge } from "@/components/measure";
import { Button, ButtonLink, Card, Notice, PageIntro, Skeleton } from "@/components/ui";

export function TrialsView() {
  const trials = useResource("trials", api.trials);
  const scans = useResource("scans", api.scans);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function deleteAll() {
    setDeleting(true);
    try {
      await api.deleteEverything();
      clearCaptures();
      setDeleted(true);
      setConfirming(false);
      trials.reload();
      scans.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Deletion failed.", 0));
    } finally {
      setDeleting(false);
    }
  }

  const baselines = new Set((trials.data ?? []).map((t) => t.baseline_scan_id));
  const scansNotInTrials = (scans.data ?? []).filter(
    (s) => s.status === "complete" && !s.trial_id && !s.synthetic_timeline && !baselines.has(s.id),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageIntro eyebrow="Your data" title="My trials">
        Trials and scans in this browser&apos;s session. ProofLoop stores scores and capture metadata — never your photos.
      </PageIntro>

      {deleted && <Notice className="mt-8" title="Everything was deleted.">Your session, scans, scores and trials are gone from the server, and photos were cleared from this tab.</Notice>}
      {error && <Notice tone="error" className="mt-8" title={error.message}>{error.hint}</Notice>}

      <section aria-labelledby="trials-h" className="mt-10">
        <h2 id="trials-h" className="text-lg font-semibold text-ink">Trials</h2>
        {trials.loading && <Skeleton className="mt-4 h-24" />}
        {trials.data && trials.data.length === 0 && (
          <Card className="mt-4 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink-2">No trials yet. A trial starts from a scan, a focus and a product.</p>
            <ButtonLink href="/scan" size="sm">Start with a scan</ButtonLink>
          </Card>
        )}
        <ul className="mt-4 space-y-3">
          {trials.data?.map((t) => (
            <li key={t.id}>
              <Link href={`/trial?id=${t.id}`} className="group flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-card)] ring-1 ring-line hover:ring-ink/30">
                <div>
                  <p className="font-semibold text-ink">{t.goal.label} · {t.product_name}</p>
                  <p className="mt-1 text-sm text-ink-3">Started {shortDate(t.created_at)} · {t.checkin_count} check-in{t.checkin_count === 1 ? "" : "s"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ProvenanceBadge provenance={t.provenance} size="sm" />
                  <ArrowRight aria-hidden className="size-4 text-ink-3 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {scansNotInTrials.length > 0 && (
        <section aria-labelledby="scans-h" className="mt-12">
          <h2 id="scans-h" className="text-lg font-semibold text-ink">Scans not yet in a trial</h2>
          <ul className="mt-4 space-y-2">
            {scansNotInTrials.map((s) => (
              <li key={s.id}>
                <Link href={`/results?scan=${s.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] p-4 ring-1 ring-line hover:bg-card">
                  <span className="text-ink-2">{shortDate(s.observed_at)} · {s.metrics.length} measurements</span>
                  <ProvenanceBadge provenance={s.provenance} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="delete-h" className="mt-16 rounded-[var(--radius-lg)] p-6 ring-1 ring-worse/25">
        <h2 id="delete-h" className="font-semibold text-ink">Delete all my data</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Removes this session and every scan, score and trial in it from the server, and clears photos held in this tab. This can&apos;t be undone.
        </p>
        {confirming ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="!bg-worse hover:!bg-worse/90" onClick={deleteAll} loading={deleting}>
              <Trash2 aria-hidden className="size-4" /> Yes, delete everything
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-4" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden className="size-4" /> Delete all my data
          </Button>
        )}
      </section>
    </div>
  );
}
