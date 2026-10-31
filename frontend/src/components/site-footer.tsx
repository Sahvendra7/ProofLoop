import Link from "next/link";
import { Logo } from "./logo";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/scan", label: "Start a fair test" },
      { href: "/trials", label: "My trials" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#verdicts", label: "What a verdict means" },
    ],
  },
  {
    title: "Method",
    links: [
      { href: "/#fair-test", label: "Why a fair test" },
      { href: "/privacy#measurement", label: "How variation was measured" },
      { href: "/privacy#matching", label: "How products are matched" },
      { href: "/privacy#limits", label: "What ProofLoop can't conclude" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy & data" },
      { href: "/privacy#data", label: "Where your data goes" },
      { href: "/trials", label: "Delete my data" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[var(--radius-stage)] bg-white ring-1 ring-line">
        <div aria-hidden className="ruler mx-6 mt-6 opacity-70 sm:mx-10" />
        <div className="grid gap-10 px-6 pb-10 pt-10 sm:px-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-2">
              A fair test for one skincare product. ProofLoop measures how skin looks in a photo and compares it over time.
              It is not a medical device and does not diagnose, treat or predict the effect of any product.
            </p>
          </div>
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title} className="space-y-3 text-sm">
              <p className="font-semibold text-ink">{g.title}</p>
              <ul className="space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link className="text-ink-2 underline-offset-4 transition-colors hover:text-strawberry-ink hover:underline" href={l.href}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        {/* Decorative oversized wordmark, drawn as SVG so it isn't announced or treated as body text. */}
        <svg aria-hidden viewBox="0 0 1000 170" className="pointer-events-none -mb-[2%] block w-full select-none px-4">
          <text
            x="500"
            y="150"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontWeight="800"
            fontSize="210"
            letterSpacing="-2"
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth="1.5"
            style={{ fontVariationSettings: "'wdth' 75" }}
          >
            ProofLoop
          </text>
        </svg>
        <div className="border-t border-line px-6 py-5 text-xs leading-relaxed text-ink-3 sm:px-10">
          Skin measurement and goal previews by the YouCam AI Skin Analysis and AI Skin Simulation APIs (Perfect Corp.).
          Products shown are a fictional sample catalogue.
        </div>
      </div>
    </footer>
  );
}
