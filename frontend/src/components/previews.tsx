import { Check, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { NOISE_BANDS, SAMPLE_SCORES, SYNTHETIC_FOLLOWUP } from "@/lib/sample";

/**
 * Compact renders of real ProofLoop screens for the homepage. They reuse the
 * app's visual language and are fed only by recorded sample data or the
 * labelled synthetic demo — never by invented "results".
 */

/**
 * One image to assistive technology: `label` is its whole description and must say whether the screen holds sample
 * data, a synthetic demo or an illustration. The mock screen inside is hidden, so its demo numbers are never read as
 * if they were a result.
 */
export function PhoneFrame({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <figure className={`relative ${className}`} role="img" aria-label={label}>
      <div aria-hidden className="rounded-[2.6rem] bg-espresso p-2.5 shadow-[0_40px_80px_-30px_rgb(44_26_26/0.55)]">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-paper">
          <div aria-hidden className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-espresso" />
          <div className="h-full pt-9">{children}</div>
        </div>
      </div>
    </figure>
  );
}

export function SourceTag({ kind }: { kind: "sample" | "synthetic" | "illustration" }) {
  const text = kind === "sample" ? "Sample data" : kind === "synthetic" ? "Synthetic demo" : "Illustration";
  return (
    <span className="hatch inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-demo-soft px-2 py-0.5 text-[0.65rem] font-semibold text-demo ring-1 ring-demo/25">
      <FlaskConical aria-hidden className="size-3" /> {text}
    </span>
  );
}

const bandColor = (s: number) => (s < 60 ? "var(--color-band-attention)" : s < 80 ? "var(--color-band-moderate)" : "var(--color-band-strength)");

export function SnapshotScreen({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-4 pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="font-display text-base font-bold leading-tight text-espresso">Your snapshot</p>
        <SourceTag kind="sample" />
      </div>
      <p className="mt-1 text-[0.7rem] leading-snug text-ink-3">Scores 1–100 · higher looks better</p>
      <ul className="mt-3 space-y-2.5">
        {SAMPLE_SCORES.slice(0, rows).map((m) => (
          <li key={m.key}>
            <div className="flex items-baseline justify-between text-[0.72rem]">
              <span className="font-medium text-espresso">{m.label}</span>
              <span className="tabular font-display text-sm font-bold text-espresso">{m.score}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-sunken">
              <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: bandColor(m.score) }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FocusScreen() {
  const ordered = [...SAMPLE_SCORES].sort((a, b) => a.score - b.score).slice(0, 4);
  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-base font-bold leading-tight text-espresso">Pick one focus</p>
        <SourceTag kind="sample" />
      </div>
      <ul className="mt-3 space-y-2">
        {ordered.map((m, i) => (
          <li key={m.key} className={`flex items-center gap-3 rounded-2xl p-2.5 ring-1 ${i === 1 ? "bg-accent-soft ring-strawberry-ink/40" : "bg-white ring-line"}`}>
            <span className={`grid size-4 place-items-center rounded-full ring-2 ${i === 1 ? "ring-strawberry-ink" : "ring-line-strong"}`}>
              {i === 1 && <span className="size-2 rounded-full bg-strawberry-ink" />}
            </span>
            <span className="flex-1 text-[0.75rem] font-medium text-espresso">{m.label}</span>
            <span className="tabular text-[0.72rem] text-ink-3">{m.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchScreen() {
  const items = [
    { name: "Hydrating Milk Essence", brand: "Numa Field", price: "$22", palette: ["#f3ece4", "#b49a86"] },
    { name: "Water Reserve Gel Cream", brand: "Thale", price: "$28", palette: ["#cfe3e6", "#5f8d96"] },
  ];
  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-base font-bold leading-tight text-espresso">Matches</p>
        <SourceTag kind="sample" />
      </div>
      <p className="mt-1 text-[0.7rem] text-ink-3">Look more hydrated · hydration 69</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((p, i) => (
          <li key={p.name} className="flex gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-line">
            <span aria-hidden className="grid h-14 w-11 shrink-0 place-items-end justify-center rounded-xl pb-1.5" style={{ background: p.palette[0] }}>
              <span className="h-8 w-5 rounded-md" style={{ background: p.palette[1] }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.62rem] uppercase tracking-wider text-ink-3">{p.brand}</span>
              <span className="block text-[0.78rem] font-semibold leading-tight text-espresso">{p.name}</span>
              <span className="mt-1 inline-block rounded-full bg-berry-soft px-1.5 py-0.5 text-[0.6rem] font-semibold text-berry-deep">
                #{i + 1} · Strong match
              </span>
            </span>
            <span className="tabular text-[0.78rem] font-bold text-espresso">{p.price}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex gap-1.5 text-[0.68rem] leading-snug text-ink-2">
        <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-strawberry-ink" /> Hydration is one of its primary targets.
      </p>
    </div>
  );
}

export function BaselineScreen() {
  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-base font-bold leading-tight text-espresso">Trial started</p>
        <SourceTag kind="sample" />
      </div>
      <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-ink-3">Baseline saved</p>
        <p className="tabular font-display text-5xl font-bold text-espresso">69</p>
        <p className="text-[0.7rem] text-ink-3">Hydration · normal variation ±{NOISE_BANDS.moisture}</p>
      </div>
      <ul className="mt-3 space-y-1.5 text-[0.7rem] text-ink-2">
        <li>• Check in after 3–4 weeks</li>
        <li>• Same spot, similar light, same camera</li>
      </ul>
    </div>
  );
}

export function CheckinScreen({ title = "Check in" }: { title?: string }) {
  return (
    <div className="px-4 pb-5">
      <p className="font-display text-base font-bold leading-tight text-espresso">{title}</p>
      <div className="relative mx-auto mt-3 aspect-[3/4] w-[78%] overflow-hidden rounded-2xl bg-gradient-to-b from-berry-soft to-berry-milk">
        <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" aria-hidden>
          <ellipse cx="150" cy="185" rx="105" ry="140" fill="none" stroke="var(--color-strawberry)" strokeWidth="4" strokeDasharray="10 9" />
        </svg>
        <span className="absolute inset-x-0 bottom-2 text-center text-[0.62rem] font-medium text-berry-deep">Fill the oval with your face</span>
      </div>
      <p className="mt-3 text-center text-[0.68rem] text-ink-3">Even light · no makeup · glasses off</p>
    </div>
  );
}

export function VerdictScreen() {
  const delta = SYNTHETIC_FOLLOWUP.moisture - 69;
  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-base font-bold leading-tight text-espresso">Verdict</p>
        <SourceTag kind="synthetic" />
      </div>
      <div className="mt-3 rounded-2xl bg-espresso p-4 text-white">
        <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-white/70">Hydration · 21 days</p>
        <p className="mt-1 font-display text-lg font-bold leading-tight">A measured change.</p>
        <p className="tabular mt-2 font-display text-3xl font-bold">
          69 <span className="text-white/60">→</span> {SYNTHETIC_FOLLOWUP.moisture}
        </p>
        <p className="mt-1 text-[0.68rem] text-berry-milk">
          +{delta} · beyond ±{NOISE_BANDS.moisture} variation
        </p>
      </div>
      <ul className="mt-3 space-y-1 text-[0.68rem]">
        <li className="flex justify-between"><span className="text-ink-2">Texture</span><span className="text-ink-3">+5 · within ±7</span></li>
        <li className="flex justify-between"><span className="text-ink-2">Radiance</span><span className="font-semibold text-berry-deep">−5 · beyond ±3</span></li>
        <li className="flex justify-between"><span className="text-ink-2">Blemishes</span><span className="text-ink-3">−5 · within ±7 (assumed)</span></li>
      </ul>
    </div>
  );
}

/** Frosted floating chip used around previews. Illustrative UI states, not results. */
export function FloatChip({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <div
      aria-hidden
      className={`float absolute flex items-center gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-xs font-semibold text-espresso shadow-[var(--shadow-float)] ring-1 ring-white backdrop-blur ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
