"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * router.push for flow steps. Each step is a new screen, so start it at the top;
 * without this the App Router can keep the previous page's scroll offset when
 * the next page first renders a short loading state.
 */
export function useGo() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      window.scrollTo({ top: 0 });
      router.push(href, { scroll: true });
    },
    [router],
  );
}
