"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

type State<T> = { key: string; data: T | null; error: ApiError | null };

/**
 * Fetch keyed data. Loading is derived (state.key !== key) rather than set
 * synchronously inside the effect, so a key change shows loading immediately
 * without cascading renders.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ key: "", data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const fullKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (fullKey === null) return;
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setState({ key: fullKey, data, error: null }),
      (err: unknown) =>
        !cancelled &&
        setState({
          key: fullKey,
          data: null,
          error: err instanceof ApiError ? err : new ApiError("unknown", "Something went wrong.", 0),
        }),
    );
    return () => {
      cancelled = true;
    };
    // fetcher is intentionally excluded: the key describes the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === fullKey;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: fullKey !== null && !current,
    reload,
    setData: (data: T) => fullKey && setState({ key: fullKey, data, error: null }),
  };
}

/**
 * Keeps the tab title in step with in-page state (a scan step, a waiting trial or its verdict), so the title can
 * orient someone mid-flow. Route changes still set their own title through Next.js metadata.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}

/** True after hydration; lets client-only values (search params, storage) render safely. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
