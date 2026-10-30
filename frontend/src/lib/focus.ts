"use client";

// Focus rules (docs/innovation/26 §3): when an action replaces the control the user pressed, focus moves to the
// heading of what replaced it. Focus never moves while the user is still on a control that survives the change.

/** Rendered and not inside a hidden subtree (Next.js can keep a previous page mounted but hidden). */
const isShown = (el: Element) => el.isConnected && el.getClientRects().length > 0;

/** True when focus was lost (body, nothing, or an element that has left or been hidden) or sits inside `scope`. */
function focusIsFree(scope?: Element | null) {
  const active = document.activeElement;
  if (!active || active === document.body || !isShown(active)) return true;
  return Boolean(scope && scope.contains(active));
}

/** Focus `el` (made programmatically focusable) unless the user is interacting with something else. */
export function focusIfFree(el: HTMLElement | null, scope?: Element | null) {
  if (!el || !focusIsFree(scope)) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus();
}

/** Focus an element once it has rendered (e.g. after a state update replaces the section it lives in). */
export function focusWhenRendered(id: string, scope?: () => Element | null) {
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el && isShown(el)) return focusIfFree(el, scope?.() ?? el.closest("main"));
    if (++tries < 30) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

/**
 * After a client-side route change, focus the new page's h1 once it renders. Next.js leaves focus where it was
 * (its scroll handler "intentionally leaves focus untouched") and only announces the title. Focus moves only if it
 * was lost or is outside <main> (e.g. on the nav link that was used), so it never jumps from a control the user has
 * already reached on the new page.
 */
export function focusPageHeading(onHandled: () => void) {
  const main = document.getElementById("main");
  if (!main) return () => {};
  let done = false;
  const tryFocus = () => {
    const h1 = [...main.querySelectorAll<HTMLElement>("h1")].find(isShown);
    if (!h1 || done) return false;
    done = true;
    onHandled();
    const active = document.activeElement;
    if (!active || active === document.body || !isShown(active) || !main.contains(active)) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: true });
    }
    return true;
  };
  if (tryFocus()) return () => {};
  const observer = new MutationObserver(() => tryFocus() && observer.disconnect());
  observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden", "class"] });
  const timeout = setTimeout(() => observer.disconnect(), 10_000);
  return () => {
    observer.disconnect();
    clearTimeout(timeout);
  };
}
