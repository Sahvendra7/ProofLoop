"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  FREQUENCY_OPTIONS,
  PROFILE_NOT_SAVED,
  REACTIVE_OPTIONS,
  REGION_LABELS,
  STABILITY_COPY,
  USER_VIEW_COPY,
  USER_VIEW_OPTIONS,
  describeAnswers,
  shortDate,
} from "@/lib/format";
import type { Frequency, Reactive, SelfReport, SkinRegion, Trial, UserView } from "@/lib/types";
import { Button, Notice, Segmented } from "@/components/ui";

const REGIONS: SkinRegion[] = ["whole", "t_zone", "u_zone"];

function labels(r: Partial<Record<SkinRegion, string | null>>): string {
  return REGIONS.map((k) => `${REGION_LABELS[k].name.toLowerCase()} ${r[k]?.toLowerCase() ?? "not returned"}`).join(" · ");
}

/** The profile frozen with the plan. Context only: it is never next to the verdict and never changes it. */
export function ProfileBlock({ trial, onUpdate }: { trial: Trial; onUpdate: (t: Trial) => void }) {
  const profile = trial.profile;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  if (!profile) {
    // Only for trials that started with skin profiles available; older trials never had the option.
    if (trial.baseline.skin_type === null) return null;
    return (
      <details className="mt-8 rounded-[var(--radius-xl)] bg-card p-6 ring-1 ring-line sm:p-8">
        <summary className="cursor-pointer select-none text-lg font-semibold text-ink">Profile at the start</summary>
        <p className="mt-4 text-sm text-ink-2">{PROFILE_NOT_SAVED}</p>
      </details>
    );
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onUpdate(await api.trial(trial.id));
      setEditing(false);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("unknown", "Couldn't save that change.", 0));
    } finally {
      setBusy(false);
    }
  }

  const start = profile.at_start;
  const lastCheckin = [...trial.checkins].reverse().find((c) => c.status === "complete" && c.skin_type);
  return (
    <details className="mt-8 rounded-[var(--radius-xl)] bg-card p-6 ring-1 ring-line sm:p-8">
      <summary className="cursor-pointer select-none text-lg font-semibold text-ink">
        Profile at the start{start && <span className="text-sm font-normal text-ink-3"> · {shortDate(start.created_at)}</span>}
      </summary>
      {profile.withdrawn || !start ? (
        <p className="mt-4 text-sm text-ink-2">You removed your answers and the skin-type readings from this trial. Your scores, plan and result are unchanged.</p>
      ) : (
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
          <p><span className="font-semibold text-ink">In your words:</span> {describeAnswers(start.self_report)}</p>
          <p>
            <span className="font-semibold text-ink">Camera:</span>{" "}
            {start.camera ? labels(start.camera) : start.camera_rejected ? "not used, at your choice" : "no reading"}
          </p>
          {start.user_view && <p>You said the camera&apos;s reading {USER_VIEW_COPY[start.user_view]}.</p>}
          {profile.notes.map((n) => (
            <p key={n.rule_id}>{n.text}</p>
          ))}
          <p><span className="font-semibold text-ink">Skin-type reading on your instrument check:</span> {STABILITY_COPY[profile.stability]}</p>
          {lastCheckin?.skin_type && start.camera && (
            <p>
              Camera at your latest check-in: {labels(lastCheckin.skin_type)}. A different reading isn&apos;t a result and isn&apos;t caused by
              the product. Your result comes from the {trial.goal.metric_label.toLowerCase()} score only.
            </p>
          )}
          {profile.latest && (
            <Notice title="Changed after your plan was fixed">
              Latest answers ({shortDate(profile.latest.at)}): {describeAnswers(profile.latest.self_report)}. This trial keeps the profile it
              started with; your new answers would shape a new trial.
            </Notice>
          )}
          <p className="text-ink-3">This profile never affects your plan or your result.</p>
          {error && <p role="alert" className="text-worse">{error.message}</p>}
          {editing ? (
            <AmendForm
              initial={profile.latest?.self_report ?? start.self_report}
              initialView={profile.latest?.user_view ?? start.user_view}
              hasCamera={start.camera !== null}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={(report, view) =>
                run(async () => {
                  await api.amendProfile(trial.id, { self_report: report, user_view: view, expected_amendments: profile.amendments });
                })
              }
            />
          ) : confirming ? (
            <div className="rounded-[var(--radius-md)] bg-sunken p-4">
              <p className="text-ink">Remove your answers and the skin-type readings from this trial? Your scores, plan and result stay.</p>
              <div className="mt-3 flex gap-3">
                <Button size="sm" loading={busy} onClick={() => run(() => api.withdrawProfile(trial.id))}>Remove</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 pt-1">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit answers</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>Remove profile</Button>
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function AmendForm({
  initial,
  initialView,
  hasCamera,
  busy,
  onCancel,
  onSave,
}: {
  initial: SelfReport | null;
  initialView: UserView | null;
  hasCamera: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (report: SelfReport, view: UserView | null) => void;
}) {
  const [report, setReport] = useState<SelfReport>(initial ?? { shine: null, tightness: null, reactive: null, priorities: [] });
  const [view, setView] = useState<UserView | null>(initialView);
  const set = <K extends keyof SelfReport>(key: K, value: SelfReport[K]) => setReport((r) => ({ ...r, [key]: value }));
  return (
    <form
      className="space-y-4 rounded-[var(--radius-md)] bg-sunken p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(report, hasCamera ? view : null);
      }}
    >
      <p className="text-ink">New answers are saved beside the profile at the start. They won&apos;t change this trial&apos;s plan.</p>
      <Segmented<Frequency> label="Shine through the day" value={report.shine ?? ("" as Frequency)} options={FREQUENCY_OPTIONS} onChange={(v) => set("shine", v)} />
      <Segmented<Frequency> label="Tight or flaky" value={report.tightness ?? ("" as Frequency)} options={FREQUENCY_OPTIONS} onChange={(v) => set("tightness", v)} />
      <Segmented<Reactive> label="Reacts easily to new products" value={report.reactive ?? ("" as Reactive)} options={REACTIVE_OPTIONS} onChange={(v) => set("reactive", v)} />
      {hasCamera && (
        <Segmented<UserView> label="Does the camera's reading sound like you?" value={view ?? ("" as UserView)} options={USER_VIEW_OPTIONS} onChange={setView} />
      )}
      <div className="flex gap-3">
        <Button type="submit" size="sm" loading={busy}>Save answers</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
