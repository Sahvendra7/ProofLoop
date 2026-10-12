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
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy & data" },
      { href: "/privacy#measurement", label: "How variation was measured" },
      { href: "/privacy#limits", label: "What ProofLoop can't conclude" },
      { href: "/trials", label: "Delete my data" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-strawberry-ink text-white">
        {/* Decorative oversized wordmark, drawn as SVG so it isn't announced or treated as body text. */}
        <svg aria-hidden viewBox="0 0 1000 190" className="pointer-events-none block w-full select-none px-4 pt-6">
          <text x="500" y="160" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="230" letterSpacing="-10" fill="rgb(255 255 255 / 0.12)">
            ProofLoop
          </text>
        </svg>
        <div className="grid gap-10 px-6 pb-10 pt-6 sm:px-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo light />
            <p className="max-w-sm text-sm leading-relaxed text-white">
              ProofLoop measures how skin looks in a photo and compares it over time. It is not a medical device and
              does not diagnose, treat or predict the effect of any product.
            </p>
          </div>
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title} className="space-y-3 text-sm">
              <p className="font-semibold text-white">{g.title}</p>
              <ul className="space-y-2">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <Link className="text-white underline-offset-4 hover:underline" href={l.href}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-white/20 px-6 py-5 text-xs leading-relaxed text-white sm:px-10">
          Skin measurement and goal previews by the YouCam AI Skin Analysis and AI Skin Simulation APIs (Perfect
          Corp.). Products shown are a fictional sample catalogue.
        </div>
      </div>
    </footer>
  );
}
