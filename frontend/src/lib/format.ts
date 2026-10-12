import type { Band, FocusOutcome, Metric, Tier, Verdict } from "./types";

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/** Darker variants of the band colours for text (WCAG AA on card and paper). */
export const BAND_TEXT: Record<Band, string> = {
  attention: "#b8001f",
  moderate: "#9b2c5e",
  strength: "#2c1a1a",
};

export const BAND_COLOR: Record<Band, string> = {
  attention: "var(--color-band-attention)",
  moderate: "var(--color-band-moderate)",
  strength: "var(--color-band-strength)",
};

export const TIER_COPY: Record<Tier, { label: string; detail: string }> = {
  strong: { label: "Strong match", detail: "Built for your focus, no cautions for your measurements." },
  good: { label: "Good match", detail: "Fits your focus with a trade-off, or supports it as a secondary target." },
  possible: { label: "Possible match", detail: "Supports your focus indirectly and has a trade-off." },
};

export const VERDICT_COPY: Record<Verdict, { label: string; tone: "better" | "worse" | "within" }> = {
  better: { label: "Beyond normal variation, up", tone: "better" },
  worse: { label: "Beyond normal variation, down", tone: "worse" },
  within_variation: { label: "Within normal variation", tone: "within" },
  missing: { label: "Not measured in both scans", tone: "within" },
};

export const OUTCOME_COPY: Record<FocusOutcome, { headline: string; body: string; tone: "better" | "worse" | "within" }> = {
  measured_improvement: {
    headline: "Measured change: up, beyond normal variation.",
    body: "The score moved further than normal scan-to-scan variation. ProofLoop can't tell you why: the product, the season, sleep or the rest of your routine could all play a part.",
    tone: "better",
  },
  measured_decline: {
    headline: "Measured change: down, beyond normal variation.",
    body: "The score dropped further than normal scan-to-scan variation. This doesn't mean the product caused it — but it's a reason to look at your routine, and to check in again.",
    tone: "worse",
  },
  no_clear_change: {
    headline: "No clear change yet.",
    body: "The difference is within the variation we see between two scans of unchanged skin. That's an honest answer, not a failure: many products take longer, and some don't change what a camera can measure.",
    tone: "within",
  },
  inconclusive: {
    headline: "We can't call this one.",
    body: "The two photos were taken in conditions too different to compare fairly. Re-scan in similar light to get a usable answer.",
    tone: "within",
  },
  insufficient_data: {
    headline: "Not enough data to compare.",
    body: "One of the scans didn't return a measurement for your focus.",
    tone: "within",
  },
};

/** One honest sentence summarising a scan from its actual scores. */
export function summarise(metrics: Metric[]): string {
  if (metrics.length === 0) return "This scan returned no measurements.";
  const sorted = [...metrics].sort((a, b) => a.ui_score - b.ui_score);
  const low = sorted.filter((m) => m.band === "attention");
  const strong = sorted.filter((m) => m.band === "strength");
  const names = (ms: Metric[]) =>
    ms.map((m) => `${m.label.toLowerCase()} (${m.ui_score})`).reduce((acc, s, i, arr) => (i === 0 ? s : i === arr.length - 1 ? `${acc} and ${s}` : `${acc}, ${s}`), "");
  if (low.length > 0) {
    return `Your lowest scores are ${names(low.slice(0, 2))}. ${strong.length ? `${capitalise(names(strong.slice(-2)))} look strong.` : ""}`.trim();
  }
  const lowest = sorted.slice(0, 2);
  return `Nothing scored in the lowest band. Your most room to improve is in ${names(lowest)}.`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
