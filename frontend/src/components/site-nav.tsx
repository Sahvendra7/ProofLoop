"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./logo";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#fair-test", label: "Why a fair test" },
  { href: "/trials", label: "My trials" },
  { href: "/privacy", label: "Privacy" },
];

/** Floating rounded nav. Collapses to a disclosure menu under 900px. */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => !href.startsWith("/#") && pathname.startsWith(href);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <header className="mx-auto max-w-6xl rounded-[1.75rem] bg-white/95 shadow-[var(--shadow-float)] ring-1 ring-black/5 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-14 items-center justify-between gap-3 pl-5 pr-2 sm:h-16 sm:pr-2.5">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 min-[900px]:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-strawberry-ink transition-colors hover:bg-berry-soft aria-[current=page]:bg-berry-soft aria-[current=page]:text-berry-deep"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              href="/scan"
              aria-label="Start a fair test"
              className="group inline-flex h-10 items-center gap-2 rounded-full bg-strawberry-ink pl-4 pr-1.5 text-sm font-semibold text-white transition-colors hover:bg-berry-deep sm:h-11 sm:pl-5"
            >
              <span className="hidden min-[400px]:inline">Start a fair test</span>
              <span className="min-[400px]:hidden">Start</span>
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5 sm:size-8">
                <ArrowUpRight className="size-4" />
              </span>
            </Link>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full text-strawberry-ink hover:bg-berry-soft min-[900px]:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-line px-3 pb-3 pt-2 min-[900px]:hidden">
            <ul className="grid gap-1">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(l.href) ? "page" : undefined}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 font-display text-lg font-semibold text-espresso hover:bg-berry-soft aria-[current=page]:bg-berry-soft"
                  >
                    {l.label}
                    <ArrowUpRight aria-hidden className="size-4 text-strawberry-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </div>
  );
}
