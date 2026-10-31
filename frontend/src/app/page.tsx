import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Fingerprint, Lock, Scale, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Dial } from "@/components/dial";
import { FloatChip } from "@/components/previews";
import { MotionToggle } from "@/components/motion-toggle";
import { RouteTitle } from "@/components/route-title";
import { CONCERNS } from "@/lib/sample";
import { SITE_TITLE } from "@/lib/titles";
import { HeroInstrument } from "./home/hero-instrument";
import { HowItWorks } from "./home/how-it-works";
import { ProblemRail } from "./home/problem-rail";
import { Showcase } from "./home/showcase";
import { VerdictExplorer } from "./home/verdict-explorer";
import { SampleDataButton } from "./sample-data-button";

export default function Home() {
  return (
    <>
      <RouteTitle title={SITE_TITLE} />
      <Hero />
      <Problem />
      <FairTest />
      <HowItWorks />
      <VerdictExplorer />
      <InsideTheApp />
      <Trust />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="-mt-[4.5rem] px-3 sm:-mt-20 sm:px-5">
      <div className="on-night night-stage grain relative mx-auto max-w-[90rem] overflow-hidden rounded-b-[var(--radius-stage)] rounded-t-[1.6rem] text-white">
        <div aria-hidden className="calibration-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_70%_at_70%_40%,#000,transparent)]" />
        <div className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-5 pb-10 pt-28 sm:px-8 sm:pt-36 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:pb-16">
          <div className="rise">
            <p className="text-lede max-w-md font-medium text-white/85">Is your skincare routine actually working?</p>
            <h1 id="hero-title" className="text-hero mt-5 text-white">
              Is it working?
              <span className="mt-3 block text-[0.5em] font-[350] leading-[1] tracking-[-0.02em] text-berry-milk [font-variation-settings:'wdth'_100]">
                Run a fair test.
              </span>
            </h1>
            <p className="text-lede mt-8 max-w-xl text-white/85">
              Take a baseline photo, use one product for one concern, and check back weeks later. ProofLoop tells you whether
              the score moved further than normal measurement variation, or says plainly that it can&apos;t tell yet.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/scan"
                className="inline-flex min-h-14 py-2 text-center items-center justify-center gap-3 rounded-full bg-strawberry-ink px-8 text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_18px_36px_-16px_rgb(254_49_68/0.75)] transition-[background,transform] duration-[var(--duration-fast)] hover:bg-strawberry active:translate-y-px"
              >
                Start a fair test
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex min-h-14 py-2 text-center items-center justify-center gap-2 rounded-full px-7 font-semibold text-white ring-1 ring-white/30 transition-colors duration-[var(--duration-fast)] hover:bg-white/10"
              >
                See how it works <ArrowDown aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/80">
              <span>No photo to hand?</span>
              <ExploreButton />
            </div>
            <MotionToggle tone="dark" className="-ml-2 mt-3" />
          </div>

          <div className="relative mx-auto w-full max-w-[27rem] lg:max-w-none">
            <HeroInstrument />
            <FloatChip className="-top-4 left-8 max-sm:hidden" delay={0}>
              <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-espresso" /> Baseline saved, day 0
            </FloatChip>
            <FloatChip className="-bottom-5 right-6 max-sm:hidden" delay={1400}>
              <span aria-hidden className="h-2 w-5 rounded-full bg-berry-milk ring-1 ring-berry-deep/20" /> Band ±5, measured
            </FloatChip>
            <FloatChip className="-bottom-5 left-6 max-lg:hidden" delay={700}>
              <span aria-hidden className="size-2 rounded-full bg-strawberry" /> Check-in, day 21
            </FloatChip>
          </div>
        </div>
        <ConcernTape />
      </div>
    </section>
  );
}

/** The one place "Explore with sample data" appears on the page; tests and the route announcer rely on that. */
function ExploreButton() {
  return (
    <span className="[&_button]:text-white [&_button]:decoration-white/50 [&_button:hover]:decoration-white [&_p]:text-berry-milk">
      <SampleDataButton variant="quiet" label="Explore with sample data" />
    </span>
  );
}

/** The eight measured concerns, running like a measuring tape along the foot of the hero. */
function ConcernTape() {
  const items = [...CONCERNS, "Measured by YouCam", "Compared over weeks"];
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((c) => (
        <li key={c} className="flex items-center whitespace-nowrap">
          <span className="px-6 font-display text-lg font-semibold text-white/90 [font-variation-settings:'wdth'_85] sm:text-xl">{c}</span>
          <span aria-hidden className="flex h-5 items-end gap-[5px]">
            {[0, 1, 2, 3, 4].map((t) => (
              <span key={t} className={`w-px ${t === 2 ? "h-5 bg-strawberry" : "h-2.5 bg-white/35"}`} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="The eight concerns ProofLoop measures" className="relative overflow-hidden border-t border-white/10 py-5">
      <div className="marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section aria-labelledby="problem-title" className="mx-auto max-w-6xl px-5 pt-20 sm:px-8 sm:pt-28">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow">The problem</p>
          <h2 id="problem-title" className="text-section mt-4 text-espresso">
            The mirror is a bad instrument.
          </h2>
          <p className="text-lede mt-6 max-w-xl text-ink-2">
            Three weeks into a new serum, you look and hope. Different light, a good night&apos;s sleep, a new camera — any of
            them can look like progress. Without a baseline and a sense of normal variation, a small change is a guess.
          </p>
        </div>
        {/* Editorial photo: mood, not evidence. Credited, never presented as a user or a result. */}
        <figure className="relative mx-auto w-full max-w-[24rem]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[var(--radius-xl)] bg-sunken ring-1 ring-line">
            <Image
              src="/images/editorial/mirror-check-1120.webp"
              alt="A woman checking the skin under her eyes in an oval mirror by a bright window."
              fill
              sizes="(min-width: 1024px) 24rem, 90vw"
              className="object-cover object-[45%_30%]"
              loading="eager"
            />
            {/* A calibration crosshair over the mirror: the idea, not a measurement of this person. */}
            <svg aria-hidden viewBox="0 0 100 125" className="absolute inset-0 h-full w-full">
              <circle cx="58" cy="44" r="15" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.5" strokeDasharray="2 2" />
              <path d="M58 25v8M58 55v8M39 44h8M69 44h8" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.5" />
            </svg>
          </div>
          <figcaption className="mt-3 text-xs leading-snug text-ink-3">
            Editorial photo by Pavel Danilyuk on Pexels. Not a ProofLoop user or result.
          </figcaption>
        </figure>
      </div>
      <ProblemRail />
    </section>
  );
}

const BANDS = [
  { label: "Radiance, under-eye", band: 3, evidence: "measured" },
  { label: "Hydration", band: 5, evidence: "measured" },
  { label: "Pores, texture", band: 7, evidence: "measured" },
  { label: "Blemishes, oil balance, redness", band: 7, evidence: "assumed" },
] as const;

const FINDINGS = [
  { max: 0, value: "0", title: "Same photo, analysed twice", body: "The live API gave identical scores." },
  { max: 2, value: "≤2", title: "Reframed, shifted or 18% darker", body: "The skin hadn't changed; scores moved by at most 2." },
  { max: 5, value: "5", title: "Same photo re-encoded in the browser", body: "Pores and texture moved most: fine detail is sensitive to sharpness." },
];

/** ±8 points either side of the baseline, the scale both evidence figures share. */
const SCALE = 8;
const pct = (v: number) => `${((v + SCALE) / (2 * SCALE)) * 100}%`;

function FairTest() {
  return (
    <section id="fair-test" aria-labelledby="insight-title" className="mt-24 px-3 sm:mt-32 sm:px-5">
      <div className="mx-auto max-w-[90rem] rounded-[var(--radius-stage)] bg-white py-20 ring-1 ring-line sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow">Why a fair test</p>
              <h2 id="insight-title" className="text-section mt-4 text-espresso">
                A change only counts if it&apos;s bigger than the noise.
              </h2>
            </div>
            <p className="text-lede text-ink-2">
              Before trusting a number, we measured how much the instrument wobbles on its own. On 11 October 2026, ten live
              analyses of one face gave these results.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-lg font-semibold text-ink">How much scores moved when the skin didn&apos;t</h3>
              <ol className="mt-6 space-y-6">
                {FINDINGS.map((f) => (
                  <li key={f.title} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-4">
                    <p className="tabular font-condensed text-5xl font-bold leading-none text-espresso">{f.value}</p>
                    <div>
                      <p className="font-semibold text-ink">{f.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-2">{f.body}</p>
                      <Scale8 from={-f.max} to={f.max} tone="evidence" />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">So a check-in has to move further than this</h3>
              <ul className="mt-6 space-y-5">
                {BANDS.map((b) => (
                  <li key={b.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-ink">{b.label}</p>
                      <p className="tabular shrink-0 font-condensed text-2xl font-bold text-espresso">
                        ±{b.band} <span className="font-sans text-xs font-medium text-ink-3">{b.evidence}</span>
                      </p>
                    </div>
                    <Scale8 from={-b.band} to={b.band} tone={b.evidence === "assumed" ? "assumed" : "band"} />
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-ink-2">
                One face, ten analyses: a floor for real-world variation, not a validation study. Concerns that scored 99–100 on the
                test face couldn&apos;t be measured, so they get the widest band, ±7, labelled &ldquo;assumed&rdquo;. An optional
                instrument check can widen your own band before anything counts — never narrow it.
              </p>
              <Link
                href="/privacy#measurement"
                className="mt-5 inline-flex items-center gap-1.5 font-semibold text-strawberry-ink underline decoration-strawberry-ink/30 underline-offset-4 hover:decoration-strawberry-ink"
              >
                Read the method and its limits <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A ±8-point scale with a shaded segment. Decorative: the numbers beside it say the same thing in words. */
function Scale8({ from, to, tone }: { from: number; to: number; tone: "evidence" | "band" | "assumed" }) {
  const fill =
    tone === "evidence" ? "bg-espresso" : tone === "band" ? "bg-berry-milk ring-1 ring-inset ring-berry-deep/15" : "hatch bg-berry-soft ring-1 ring-inset ring-line-strong";
  return (
    <div aria-hidden className="relative mt-3 h-6">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      {Array.from({ length: 2 * SCALE + 1 }, (_, i) => i - SCALE).map((v) => (
        <span
          key={v}
          className={`absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 ${v === 0 ? "h-6 bg-espresso" : v % 4 === 0 ? "h-3 bg-tick" : "h-1.5 bg-tick"}`}
          style={{ left: pct(v) }}
        />
      ))}
      {to > from ? (
        <span className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${fill}`} style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }} />
      ) : (
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-espresso ring-2 ring-white" style={{ left: pct(0) }} />
      )}
    </div>
  );
}

function InsideTheApp() {
  return (
    <section aria-labelledby="showcase-title" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Inside the app</p>
          <h2 id="showcase-title" className="text-section mt-4 text-espresso">
            Every screen is built around the evidence.
          </h2>
        </div>
        <p className="text-lede text-ink-2">
          Each number says where it came from: a live YouCam scan, the recorded sample, or the labelled synthetic demo.
        </p>
      </div>
      <div className="mt-14">
        <Showcase />
      </div>
      <div className="mt-14 flex flex-col gap-5 rounded-[var(--radius-lg)] bg-sunken p-6 sm:flex-row sm:items-center sm:p-8">
        <Sparkles aria-hidden className="size-6 shrink-0 text-strawberry-ink" />
        <p className="leading-relaxed text-ink-2">
          <strong className="text-ink">A real YouCam Skin Simulation, only when you ask.</strong> Rendered from your own photo
          for supported concerns, it shows what a goal looks like, never what a product will do. There&apos;s no example here
          because it needs your photo.
        </p>
      </div>
    </section>
  );
}

function Trust() {
  const does = [
    { icon: ShieldCheck, title: "YouCam does the measuring", body: "Scores come from the YouCam AI Skin Analysis API. ProofLoop shows them as returned and never fills in a missing one." },
    { icon: Scale, title: "The rules are fixed before the check-in", body: "The band and the scores that would count as up or down are saved when the trial starts and don't move afterwards." },
    { icon: Fingerprint, title: "The baseline photo can't be reused", body: "A one-way fingerprint of each cleaned photo lets a check-in refuse the baseline photo, which would score identically." },
  ];
  const doesnt = [
    { title: "Say why a score changed", body: "A measured change after starting a product isn't proof the product caused it. ProofLoop says so every time." },
    { title: "Predict a product's result", body: "Skin Simulation visualises a goal. It is not a prediction of what any product will do." },
    { title: "Diagnose or treat", body: "It measures how skin looks in a photo. It isn't a medical device." },
  ];
  const privacy = [
    { icon: Lock, text: "Your photo is stripped of metadata, sent to YouCam and discarded. ProofLoop never stores it." },
    { icon: Trash2, text: "Scores and trials sit under an anonymous session. One button on My trials deletes everything." },
  ];
  return (
    <section aria-labelledby="trust-title" className="mx-auto max-w-6xl px-5 pb-8 pt-8 sm:px-8 sm:pt-16">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Trust</p>
          <h2 id="trust-title" className="text-section mt-4 text-espresso">
            What we promise, and what we don&apos;t.
          </h2>
        </div>
        <p className="text-lede text-ink-2">A measuring tool is only as useful as its stated limits. Here are ours.</p>
      </div>

      <div className="mt-12 grid overflow-hidden rounded-[var(--radius-stage)] ring-1 ring-line lg:grid-cols-2">
        <div className="bg-white p-7 sm:p-10">
          <h3 className="font-display text-2xl font-bold tracking-[-0.02em] text-espresso">What ProofLoop does</h3>
          <ul className="mt-6 divide-y divide-line">
            {does.map((d) => (
              <li key={d.title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <d.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-strawberry-ink" strokeWidth={1.8} />
                <div>
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{d.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="calibration-grid-light bg-sunken p-7 sm:p-10">
          <h3 className="font-display text-2xl font-bold tracking-[-0.02em] text-espresso">What it can&apos;t tell you</h3>
          <ul className="mt-6 divide-y divide-line-strong/60">
            {doesnt.map((d) => (
              <li key={d.title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                <span aria-hidden className="mt-2 h-0.5 w-4 shrink-0 rounded-full bg-ink-3" />
                <div>
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{d.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
        {privacy.map((p) => (
          <p key={p.text} className="flex gap-3 text-sm leading-relaxed text-ink-2">
            <p.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
            {p.text}
          </p>
        ))}
        <Link
          href="/privacy"
          className="inline-flex min-h-12 py-2 text-center items-center justify-center rounded-full bg-white px-6 font-semibold text-ink ring-1 ring-line-strong transition-colors hover:bg-paper hover:ring-ink/40"
        >
          How it works &amp; privacy
        </Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-3 pt-20 sm:px-5 sm:pt-24">
      <div className="on-night night-stage grain relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 overflow-hidden rounded-[var(--radius-stage)] px-6 py-14 text-white sm:px-12 sm:py-20 lg:grid-cols-[1.3fr_1fr]">
        <div aria-hidden className="calibration-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_left,#000,transparent_70%)]" />
        <div className="relative">
          <h2 id="cta-title" className="text-section">Still wondering if it&apos;s working?</h2>
          <p className="text-lede mt-6 max-w-lg text-white">
            Give your next skincare trial a baseline, a fair comparison, and a clearer answer. It takes one photo to start.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/scan"
              className="inline-flex min-h-14 py-2 text-center items-center justify-center rounded-full bg-white px-8 font-semibold text-espresso transition-colors duration-[var(--duration-fast)] hover:bg-berry-milk"
            >
              Start a fair test
            </Link>
            <Link href="/trials" className="inline-flex min-h-14 py-2 text-center items-center justify-center rounded-full px-6 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
              Open my trials
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <Dial
            baseline={69}
            band={5}
            span={14}
            label="Your baseline and its normal-variation band"
            tone="dark"
            caption={<p className="text-sm text-white/85">your baseline, before anything changes</p>}
          >
            <p className="font-condensed text-5xl font-bold leading-none">Day 0</p>
          </Dial>
        </div>
      </div>
    </section>
  );
}
