import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarClock, Check, Eye, Lock, Scale, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Dial } from "@/components/dial";
import { FloatChip, MatchScreen, PhoneFrame, SnapshotScreen, SourceTag, VerdictScreen } from "@/components/previews";
import { Reveal } from "@/components/reveal";
import { CONCERNS } from "@/lib/sample";
import { HowItWorks } from "./home/how-it-works";
import { ProblemRail } from "./home/problem-rail";
import { VerdictExplorer } from "./home/verdict-explorer";
import { SampleDataButton } from "./sample-data-button";

export default function Home() {
  return (
    <>
      <Hero />
      <ConcernMarquee />
      <Problem />
      <Insight />
      <HowItWorks />
      <Showcase />
      <VerdictExplorer />
      <Trust />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="-mt-[4.5rem] px-3 sm:-mt-20 sm:px-5">
      <div className="berry-glow relative mx-auto max-w-[88rem] overflow-hidden rounded-b-[2.5rem] rounded-t-[2rem] pb-14 pt-28 sm:pb-20 sm:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-berry-deep ring-1 ring-white">
              <span aria-hidden className="size-1.5 rounded-full bg-strawberry" /> Skin measurement by YouCam AI
            </p>
            <h1 id="hero-title" className="text-hero mt-6 text-espresso">
              Is it <span className="whitespace-nowrap">working?</span>
              <span className="mt-2 block text-strawberry">Run a fair test.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl">
              Choose one product, track one skin concern, and find out whether the change is bigger than the usual
              measurement variation.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/scan"
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-strawberry-ink pl-7 pr-2 text-base font-semibold text-white shadow-[0_16px_32px_-14px_rgb(214_26_47/0.8)] transition-colors hover:bg-berry-deep"
              >
                Start a fair test
                <span aria-hidden className="grid size-10 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                  <ArrowUpRight className="size-5" />
                </span>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-7 font-semibold text-strawberry-ink ring-1 ring-white hover:ring-strawberry-ink/40"
              >
                See how it works <ArrowDown aria-hidden className="size-4" />
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
              <span>No photo to hand?</span>
              <SampleDataButton variant="quiet" label="Explore with sample data" />
            </div>
          </div>

          {/* Mobile: phone overlaps the photo's lower right. sm+: side by side in a 5:6 box. */}
          <div className="relative mx-auto w-full max-w-[30rem] sm:aspect-[5/6] lg:max-w-none">
            {/* Editorial photo in a mirror-shaped arch. It is mood, not evidence: credited, never presented as a user or a result. */}
            <div className="relative aspect-[4/5] w-[80%] overflow-hidden rounded-t-full rounded-b-[2rem] bg-berry-soft ring-8 ring-white/70 sm:absolute sm:left-0 sm:top-0 sm:w-[60%]">
              <Image
                src="/images/editorial/mirror-check-1120.webp"
                alt="A woman checking the skin under her eyes in an oval mirror by a bright window."
                fill
                sizes="(min-width: 1024px) 20rem, (min-width: 640px) 60vw, 80vw"
                className="object-cover object-[45%_30%]"
                loading="eager"
                fetchPriority="high"
              />
            </div>
            <div className="relative ml-auto -mt-[38%] w-[min(64%,15rem)] sm:absolute sm:right-0 sm:top-[15%] sm:mt-0 sm:w-[44%]">
              <PhoneFrame label="ProofLoop snapshot screen with sample data" className="rise [animation-delay:150ms]">
                <SnapshotScreen />
              </PhoneFrame>
            </div>
            <p className="mt-4 text-center text-[11px] leading-snug text-ink-3 sm:absolute sm:left-1 sm:top-[64%] sm:mt-0 sm:w-[56%] sm:text-left">
              Editorial photo by Pavel Danilyuk on Pexels. Not a ProofLoop user or result.
            </p>
            <FloatChip className="right-[2%] top-[4%]" delay={0}>
              <span className="grid size-6 place-items-center rounded-full bg-strawberry-ink text-white"><Check className="size-3.5" /></span>
              Baseline saved
            </FloatChip>
            <FloatChip className="bottom-[16%] max-sm:hidden sm:-left-3" delay={1600}>
              <CalendarClock className="size-4 text-strawberry-ink" /> Check-in in 21 days
            </FloatChip>
            <FloatChip className="bottom-[4%] left-[8%] max-sm:hidden" delay={600}>
              <Scale className="size-4 text-strawberry-ink" /> Normal variation ±5
            </FloatChip>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConcernMarquee() {
  const items = [...CONCERNS, "Measured by YouCam", "Compared over weeks"];
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((c) => (
        <li key={c} className="flex items-center gap-8 whitespace-nowrap font-display text-2xl font-bold text-espresso sm:text-3xl">
          {c} <span aria-hidden className="size-2.5 rounded-full bg-strawberry" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="The eight concerns ProofLoop measures" className="overflow-hidden py-8">
      <div className="marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section aria-labelledby="problem-title" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
        <Reveal>
          <p className="eyebrow">The problem</p>
          <h2 id="problem-title" className="text-section mt-3 text-espresso">
            The mirror is a <span className="text-strawberry">bad instrument.</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-lg leading-relaxed text-ink-2">
            Three weeks into a new serum, you look and hope. Different light, a good night&apos;s sleep, a new camera —
            any of them can look like progress. Here is what gets in the way of a straight answer.
          </p>
        </Reveal>
      </div>
      <ProblemRail />
    </section>
  );
}

function Insight() {
  const steps = ["Baseline", "Normal variation", "Later check-in", "Comparison", "Verdict"];
  return (
    <section id="fair-test" aria-labelledby="insight-title" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Why a fair test</p>
          <h2 id="insight-title" className="text-section mt-3 text-espresso">
            A change only counts if it&apos;s <span className="text-strawberry">bigger than the noise.</span>
          </h2>
        </Reveal>

        <Reveal className="relative mx-auto mt-10 max-w-xl" delay={100}>
          <Dial
            baseline={69}
            band={5}
            current={77}
            span={14}
            label="Hydration example"
            caption={<p className="text-sm text-ink-3">normal variation for hydration</p>}
          >
            <p className="tabular font-display text-5xl font-bold text-espresso sm:text-6xl">±5</p>
          </Dial>
          <div className="absolute right-0 top-0"><SourceTag kind="illustration" /></div>
          <p className="mt-2 text-center text-sm text-ink-2">
            Black needle: baseline. Pink arc: normal variation. Red needle: a check-in beyond it.
          </p>
        </Reveal>

        <ol className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-5" aria-label="How a comparison works">
          {steps.map((s, i) => (
            <Reveal as="li" key={s} delay={i * 80} className="rounded-2xl bg-berry-soft px-4 py-4 text-center">
              <span className="tabular block font-display text-sm font-bold text-berry-deep">0{i + 1}</span>
              <span className="mt-1 block font-semibold text-espresso">{s}</span>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3" delay={100}>
          {[
            ["0", "points", "Same photo analysed twice by the live API: identical scores."],
            ["≤2", "points", "Reframed, shifted or 18% darker — the skin hadn't changed."],
            ["5", "points", "The same photo re-encoded in the browser. Pores and texture moved most."],
          ].map(([n, unit, text]) => (
            <div key={text} className="rounded-[1.75rem] bg-paper p-6 ring-1 ring-line">
              <p className="font-display text-5xl font-bold text-espresso">
                {n} <span className="text-base font-semibold text-ink-3">{unit}</span>
              </p>
              <p className="mt-3 leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </Reveal>
        <Reveal className="mx-auto mt-6 max-w-3xl text-center" delay={150}>
          <p className="leading-relaxed text-ink-2">
            So ProofLoop only calls a change beyond <strong className="text-espresso">±3</strong> points for radiance and
            under-eye, <strong className="text-espresso">±5</strong> for hydration and <strong className="text-espresso">±7</strong> for
            pores and texture — measured on one face in ten live analyses, a floor for real-world variation rather than a
            validation study. Concerns we couldn&apos;t measure get the strictest band, ±7, and are labelled
            &ldquo;assumed&rdquo;.
          </p>
          <Link href="/privacy#measurement" className="mt-4 inline-flex items-center gap-1.5 font-semibold text-strawberry-ink underline decoration-strawberry-ink/30 underline-offset-4 hover:decoration-strawberry-ink">
            Read the method and its limits <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section aria-labelledby="showcase-title" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">Inside the app</p>
        <h2 id="showcase-title" className="text-section mt-3 text-espresso">
          Every screen is built around <span className="text-strawberry">the evidence.</span>
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-6">
        <Reveal className="berry-glow overflow-hidden rounded-[2rem] p-6 md:col-span-4 md:p-8">
          <div className="grid items-center gap-8 sm:grid-cols-[1fr_15rem]">
            <div>
              <Eye aria-hidden className="size-6 text-strawberry-ink" />
              <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-espresso">Scores you can read, and where they came from.</h3>
              <p className="mt-3 leading-relaxed text-ink-2">
                Eight YouCam concerns on one scale, a summary written from your numbers, and YouCam&apos;s own detection masks
                laid over your photo — on your device only.
              </p>
            </div>
            <PhoneFrame label="Snapshot screen, sample data" className="mx-auto w-[15rem]"><SnapshotScreen rows={6} /></PhoneFrame>
          </div>
        </Reveal>
        <Reveal delay={100} className="flex flex-col justify-between rounded-[2rem] bg-espresso p-6 text-white md:col-span-2 md:p-8">
          <Sparkles aria-hidden className="size-6 text-berry-milk" />
          <div>
            <h3 className="mt-4 font-display text-2xl font-bold leading-tight">A real YouCam Skin Simulation — only when you ask.</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Rendered from your own photo by YouCam&apos;s AI Skin Simulation API for supported concerns. It shows what a goal
              looks like, never what a product will do. There&apos;s no example here because it needs your photo.
            </p>
          </div>
        </Reveal>
        <Reveal className="rounded-[2rem] bg-white p-6 ring-1 ring-line md:col-span-3 md:p-8">
          <h3 className="font-display text-2xl font-bold leading-tight text-espresso">Matches with reasons, not percentages.</h3>
          <p className="mt-2 text-ink-2">Tiers from explicit rules; cautions drawn from your own scores.</p>
          <PhoneFrame label="Matches screen, sample data" className="mx-auto mt-6 w-[15rem]"><MatchScreen /></PhoneFrame>
        </Reveal>
        <Reveal delay={100} className="rounded-[2rem] bg-white p-6 ring-1 ring-line md:col-span-3 md:p-8">
          <h3 className="font-display text-2xl font-bold leading-tight text-espresso">A verdict that shows its working.</h3>
          <p className="mt-2 text-ink-2">Before and after, the normal-variation band, and every concern for context.</p>
          <PhoneFrame label="Verdict screen, synthetic demo" className="mx-auto mt-6 w-[15rem]"><VerdictScreen /></PhoneFrame>
        </Reveal>
      </div>
    </section>
  );
}

function Trust() {
  const facts = [
    { icon: ShieldCheck, title: "YouCam does the measuring", body: "Scores come from the YouCam AI Skin Analysis API. ProofLoop shows them as returned and never fills in a missing one." },
    { icon: Scale, title: "Comparisons, not causes", body: "A measured change after starting a product isn't proof the product caused it. ProofLoop says so every time." },
    { icon: Sparkles, title: "Previews are previews", body: "Skin Simulation visualises a goal. It is not a prediction of any product's result." },
    { icon: Lock, title: "Your photo isn't stored", body: "It's cleaned of metadata, sent to YouCam and discarded. We keep scores under an anonymous session." },
    { icon: Trash2, title: "Delete everything, instantly", body: "One button on My trials removes your session, scans, scores and trials from the server." },
  ];
  return (
    <section aria-labelledby="trust-title" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr]">
          <Reveal>
            <p className="eyebrow">Trust</p>
            <h2 id="trust-title" className="text-section mt-3 text-espresso">What we promise — <span className="text-strawberry">and what we don&apos;t.</span></h2>
            <Link href="/privacy" className="mt-8 inline-flex items-center gap-2 rounded-full bg-berry-soft px-5 py-3 font-semibold text-berry-deep hover:bg-berry-milk">
              How it works &amp; privacy <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2">
            {facts.map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 70} className={`rounded-[1.75rem] p-6 ring-1 ring-line ${i === 0 ? "bg-paper sm:col-span-2" : "bg-white"}`}>
                <f.icon aria-hidden className="size-6 text-strawberry-ink" />
                <h3 className="mt-4 text-lg font-semibold text-espresso">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{f.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-3 pt-20 sm:px-5 sm:pt-28">
      <Reveal className="strawberry-glow relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2.5rem] px-6 py-14 text-white sm:px-12 sm:py-20 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 id="cta-title" className="text-section">Still wondering if it&apos;s working?</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white">
            Give your next skincare trial a baseline, a fair comparison, and a clearer answer.
          </p>
          <Link
            href="/scan"
            className="group mt-8 inline-flex h-14 items-center gap-3 rounded-full bg-white pl-7 pr-2 font-semibold text-strawberry-ink hover:bg-berry-soft"
          >
            Start a fair test
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-strawberry-ink text-white transition-transform group-hover:translate-x-0.5">
              <ArrowUpRight className="size-5" />
            </span>
          </Link>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <Dial
            baseline={69}
            band={5}
            span={14}
            label="Your baseline and its normal-variation band"
            tone="dark"
            caption={<p className="text-sm text-white">your baseline</p>}
          >
            <p className="font-display text-4xl font-bold">Day 0</p>
          </Dial>
        </div>
      </Reveal>
    </section>
  );
}
