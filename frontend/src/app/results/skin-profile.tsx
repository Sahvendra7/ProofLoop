"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import {
  FREQUENCY_OPTIONS,
  REACTIVE_OPTIONS,
  READING_ISNT,
  READING_MISSING,
  READING_NOT_REQUESTED,
  READING_REMOVED,
  READING_SNAPSHOT,
  REGION_LABELS,
  USER_VIEW_OPTIONS,
  shortDate,
} from "@/lib/format";
import type { ProfileDraft } from "@/lib/profile-store";
import type { FocusPlan, Frequency, Goal, Reactive, SelfReport, SkinRegion, SkinType, UserView } from "@/lib/types";
import { Button, Card, Notice, Segmented } from "@/components/ui";

const REGIONS: SkinRegion[] = ["whole", "t_zone", "u_zone"];
const MAX_PRIORITIES = 2;

/** What YouCam's skin-type reading said about this photo. Dated, zoned, never a diagnosis. */
export function SkinTypeCard({ reading, observedAt }: { reading: SkinType; observedAt: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Layers aria-hidden className="size-4 text-accent" />
        <h2 className="text-lg font-semibold text-ink">How the camera read this photo</h2>
      </div>
      <p className="mt-1 text-xs text-ink-3">{shortDate(observedAt)} · YouCam skin-type reading</p>
      {reading.status === "missing" || reading.status === "removed" ? (
        <p className="mt-4 text-sm text-ink-2">{reading.status === "removed" ? READING_REMOVED : READING_MISSING}</p>
      ) : (
        <dl className="mt-4 divide-y divide-line rounded-[var(--radius-md)] ring-1 ring-line">
          {REGIONS.map((r) => (
            <div key={r} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <dt className="text-sm text-ink-2">
                {REGION_LABELS[r].name}
                {REGION_LABELS[r].detail && <span className="text-ink-3"> ({REGION_LABELS[r].detail})</span>}
              </dt>
              <dd className="text-sm font-semibold text-ink">{reading[r] ?? <span className="font-normal text-ink-3">Not returned</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {reading.note && <p className="mt-3 text-xs text-ink-3">{reading.note}</p>}
      {(reading.status === "complete" || reading.status === "partial") && <p className="mt-3 text-sm text-ink-2">{READING_SNAPSHOT}</p>}
      <details className="mt-3 text-sm text-ink-3">
        <summary className="cursor-pointer select-none text-ink-2 hover:text-ink">What this reading isn&apos;t</summary>
        <p className="mt-2 leading-relaxed">{READING_ISNT}</p>
      </details>
    </Card>
  );
}

/** Flag on, but this scan never asked for a reading (taken before it was switched on). */
export function NoReadingNote() {
  return <p className="rounded-[var(--radius-md)] bg-sunken p-4 text-sm text-ink-2">{READING_NOT_REQUESTED}</p>;
}

const EMPTY: SelfReport = { shine: null, tightness: null, reactive: null, priorities: [] };

/** Optional self-report. The user's words win; nothing leaves the tab unless they choose to save it with a trial. */
export function InYourWords({
  goals,
  hasReading,
  draft,
  plan,
  onApply,
  onSkip,
}: {
  goals: Goal[];
  hasReading: boolean;
  draft: ProfileDraft | null;
  plan: FocusPlan | null;
  onApply: (draft: ProfileDraft) => void;
  onSkip: () => void;
}) {
  const [editing, setEditing] = useState(draft === null);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<SelfReport>(draft?.profile.self_report ?? EMPTY);
  const [view, setView] = useState<UserView | null>(draft?.profile.user_view ?? null);
  const [useReading, setUseReading] = useState(draft?.profile.use_camera_reading ?? true);
  const [save, setSave] = useState(draft?.save ?? false);

  const set = <K extends keyof SelfReport>(key: K, value: SelfReport[K]) => setReport((r) => ({ ...r, [key]: value }));
  const togglePriority = (key: string) =>
    set(
      "priorities",
      report.priorities.includes(key)
        ? report.priorities.filter((p) => p !== key)
        : report.priorities.length < MAX_PRIORITIES
          ? [...report.priorities, key]
          : report.priorities,
    );

  if (!editing && draft) {
    const notes = plan?.profile_notes ?? [];
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">In your words</h2>
        {notes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Your answers are used to order the focuses below.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
            {notes.map((n) => (
              <li key={n.rule_id}>{n.text}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-3">
          {draft.save ? "These answers will be saved with your trial when you start it." : "Not saved: these answers stay in this tab."}
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(true)}>
          Edit answers
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-ink">In your words <span className="text-sm font-normal text-ink-3">(optional)</span></h2>
      <p className="mt-1 text-sm text-ink-2">The camera sees one photo. You know how your skin behaves day to day.</p>
      {!open ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Add your answers
          </Button>
        </div>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onApply({ profile: { self_report: report, user_view: hasReading && useReading ? view : null, use_camera_reading: hasReading && useReading }, save });
            setEditing(false);
          }}
        >
          <Segmented<Frequency> label="Shine through the day" value={report.shine ?? ("" as Frequency)} options={FREQUENCY_OPTIONS} onChange={(v) => set("shine", v)} />
          <Segmented<Frequency> label="Tight or flaky" value={report.tightness ?? ("" as Frequency)} options={FREQUENCY_OPTIONS} onChange={(v) => set("tightness", v)} />
          <Segmented<Reactive> label="Reacts easily to new products" value={report.reactive ?? ("" as Reactive)} options={REACTIVE_OPTIONS} onChange={(v) => set("reactive", v)} />
          <fieldset>
            <legend className="eyebrow mb-2">What matters most (up to {MAX_PRIORITIES})</legend>
            <div className="flex flex-wrap gap-2">
              {goals.map((g) => {
                const on = report.priorities.includes(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePriority(g.key)}
                    className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${on ? "bg-ink text-paper ring-ink" : "text-ink-2 ring-line-strong hover:bg-sunken"}`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            <p aria-live="polite" className="mt-2 text-xs text-ink-3">
              {report.priorities.length === MAX_PRIORITIES ? `${MAX_PRIORITIES} of ${MAX_PRIORITIES} selected` : ""}
            </p>
          </fieldset>
          {hasReading && (
            <>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={useReading} onChange={(e) => setUseReading(e.target.checked)} />
                <span>Use the camera&apos;s reading in my profile. Untick to keep only your own answers.</span>
              </label>
              {useReading && (
                <Segmented<UserView> label="Does the camera's reading sound like you?" value={view ?? ("" as UserView)} options={USER_VIEW_OPTIONS} onChange={setView} />
              )}
            </>
          )}
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] bg-sunken p-4 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={save} onChange={(e) => setSave(e.target.checked)} />
            <span className="text-ink">
              Save my answers with this trial
              <span className="block text-ink-3">Kept with the trial and deleted with it. Untick to use them only on this page.</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="sm">Use my answers</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** A plain notice when the user's own priority can't show an improvement. */
export function PriorityNote({ plan }: { plan: FocusPlan | null }) {
  if (!plan?.priority_note) return null;
  return (
    <Notice tone="warn" className="mt-5">
      {plan.priority_note.text}
    </Notice>
  );
}
