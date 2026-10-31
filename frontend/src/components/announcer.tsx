"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { focusPageHeading } from "@/lib/focus";

const AnnounceContext = createContext<(message: string) => void>(() => {});

/**
 * The app's one polite live region, present in the first server-rendered markup so assistive technology has
 * registered it before anything is said (MDN, "Live regions"). Status that doesn't move focus goes here; anything
 * that moves focus is not announced as well, so nothing is spoken twice.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef({ text: "", at: 0 });

  const announce = useCallback((text: string) => {
    const now = Date.now();
    // The same sentence twice in quick succession is one event (e.g. a re-render), not two.
    if (text === last.current.text && now - last.current.at < 2000) return;
    last.current = { text, at: now };
    clearTimeout(timer.current);
    setMessage("");
    // Set the text in a later task so a repeat of an earlier, identical message is still a change.
    timer.current = setTimeout(() => setMessage(text), 120);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <AnnounceContext.Provider value={announce}>
      <RouteHeadingFocus />
      {children}
      <div id="pl-announcer" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

/** `announce("…")`: say a short status sentence without moving focus. */
export const useAnnounce = () => useContext(AnnounceContext);

/**
 * Moves focus to the new page's h1 after client-side navigation, never on the first load. Tracks the path it has
 * handled rather than a "first run" flag, so a re-run effect (React Strict Mode) can't mistake the first load for a
 * navigation, and an interrupted attempt is retried.
 */
function RouteHeadingFocus() {
  const pathname = usePathname();
  const handled = useRef(pathname);
  useEffect(() => {
    if (handled.current === pathname) return;
    return focusPageHeading(() => {
      handled.current = pathname;
    });
  }, [pathname]);
  return null;
}
