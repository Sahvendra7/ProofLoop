import { NEXT_STEP_COPY, OUTCOME_COPY } from "@/lib/format";
import type { Comparison, Trial } from "@/lib/types";

const FAIRNESS: Record<Comparison["comparability"]["level"], string> = {
  good: "Comparable conditions.",
  fair: "Comparable, with caveats.",
  poor: "Not comparable.",
};

const BAND_NOTE = { measured: "", assumed: " (an assumed band)", personal: " (widened by your instrument check)" } as const;

/**
 * The verdict in plain sentences, visible to everyone (docs/innovation/28 §10). Every value is a server field, or
 * the fixed wording for a server code: nothing here decides an outcome, a band or a next step, and the numbers are
 * only described as a result when the server's outcome is one that uses them.
 */
export function ResultInWords({ trial, comparison, synthetic }: { trial: Trial; comparison: Comparison; synthetic: boolean }) {
  const outcome = comparison.focus_outcome;
  const focus = comparison.changes.find((c) => c.metric === comparison.focus_metric);
  const label = trial.goal.metric_label;
  const { level, issues } = comparison.comparability;
  const usesNumbers = outcome === "measured_improvement" || outcome === "measured_decline" || outcome === "no_clear_change";

  let numbers: string;
  if (outcome === "insufficient_data") numbers = OUTCOME_COPY.insufficient_data.body;
  else if (outcome === "inconclusive") numbers = "The scores are in the table below for context only. They don't count as a result.";
  else if (usesNumbers && focus && focus.baseline !== null && focus.current !== null && focus.delta !== null)
    numbers = `${label} was ${focus.baseline} at baseline and ${focus.current} at this check-in, a change of ${focus.delta > 0 ? "+" : ""}${focus.delta} ${Math.abs(focus.delta) === 1 ? "point" : "points"}.`;
  else numbers = `The ${label.toLowerCase()} measurement isn't available for this comparison.`;

  const rows: [string, string][] = [];
  if (comparison.early)
    rows.push(["Timing", `Early look: day ${Math.round(comparison.comparability.days_apart)} of a planned ${trial.protocol.planned_checkin_days}-day test.`]);
  rows.push(["Result", OUTCOME_COPY[outcome].headline]);
  rows.push(["The numbers", numbers]);
  if (focus) rows.push(["The rule in your plan", `A change counts only beyond ±${focus.noise_band} points${BAND_NOTE[focus.band_evidence]}, decided before the check-in.`]);
  rows.push(["Fairness", [FAIRNESS[level], ...issues].join(" ")]);
  rows.push(["Next step", NEXT_STEP_COPY[comparison.next_step.action].title]);

  return (
    <section
      aria-labelledby="result-words-title"
      className="mt-6 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line forced-colors:border forced-colors:border-[CanvasText] sm:p-8"
    >
      <h2 id="result-words-title" className="font-display text-2xl text-ink">Result in words</h2>
      {synthetic && <p className="mt-2 text-sm font-semibold text-demo">Synthetic demo, not a measurement.</p>}
      <dl className="mt-4 space-y-3 text-sm leading-relaxed">
        {rows.map(([term, text]) => (
          <div key={term} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-8">
            <dt className="font-semibold text-ink">{term}</dt>
            <dd className="text-ink-2">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
