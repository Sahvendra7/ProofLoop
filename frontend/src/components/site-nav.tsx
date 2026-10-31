"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#fair-test", label: "Why a fair test" },
  { href: "/trials", label: "My trials" },
  { href: "/privacy", label: "Privacy" },
];

/**
 * Floating nav bar. Collapses to a disclosure menu under 900px. The menu's entrance is a CSS animation (`.menu-in`)
 * rather than Motion, so the nav — on every route — adds no animation library to the app's JavaScript.
 */
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
        <header className="mx-auto max-w-6xl rounded-[1.4rem] bg-white shadow-[var(--shadow-float)] ring-1 ring-espresso/8 backdrop-blur-xl supports-[backdrop-filter]:bg-white/93">
          <div className="flex h-14 items-center justify-between gap-3 pl-4 pr-2 sm:h-16 sm:pl-5 sm:pr-2.5">
            <Logo />
            <nav aria-label="Primary" className="hidden items-center gap-0.5 nav:flex">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="relative rounded-full px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors duration-[var(--duration-fast)] hover:bg-sunken hover:text-ink aria-[current=page]:text-ink after:pointer-events-none after:absolute after:inset-x-3.5 after:bottom-1 after:h-[3px] after:rounded-full after:bg-berry-milk after:opacity-0 after:transition-opacity aria-[current=page]:after:opacity-100 aria-[current=page]:after:bg-strawberry-ink"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1.5">
              <Link
                href="/scan"
                aria-label="Start a fair test"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-strawberry-ink px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] transition-colors duration-[var(--duration-fast)] hover:bg-berry-deep sm:h-11 sm:px-5"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-white/90" />
                <span className="hidden min-[400px]:inline">Start a fair test</span>
                <span className="min-[400px]:hidden">Start</span>
              </Link>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-ink hover:bg-sunken nav:hidden"
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
              <nav id="mobile-menu" aria-label="Mobile" className="nav:hidden">
                <ul className="grid gap-0.5 border-t border-line px-2.5 pb-3 pt-2">
                  {LINKS.map((l, i) => (
                    <li key={l.href} className="menu-in" style={{ animationDelay: `${i * 40}ms` }}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive(l.href) ? "page" : undefined}
                        className="flex items-center justify-between rounded-2xl px-4 py-3 font-display text-xl font-semibold text-espresso hover:bg-sunken aria-[current=page]:bg-berry-soft"
                      >
                        {l.label}
                        <span aria-hidden className="h-1 w-5 rounded-full bg-berry-milk" />
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
