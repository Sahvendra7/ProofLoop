"use client";

import { useLayoutEffect } from "react";

/**
 * Sets the tab title in the commit that shows the route. Next.js's route announcer reads document.title in a passive
 * effect of that same commit and, when the title is still empty (route metadata streams in later), falls back to the
 * first h1 in the document, which can be the previous page's, still mounted but hidden. Layout effects run before
 * any passive effect, so the announcer reads this page's title instead (docs/innovation/31 §6.5).
 */
export function RouteTitle({ title }: { title: string }) {
  useLayoutEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
