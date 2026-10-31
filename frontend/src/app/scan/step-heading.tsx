"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { focusIfFree } from "@/lib/focus";

/** True once the user has moved past the step the page opened on; from then on each new step takes focus. */
export const StepFocusContext = createContext(false);

/**
 * The heading at the top of a scan step. Each step replaces the one before it (and the button that was pressed),
 * so its heading takes focus on arrival; the opening step doesn't, so a fresh page load reads from the top.
 */
export function StepHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  const autoFocus = useContext(StepFocusContext);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) focusIfFree(ref.current);
  }, [autoFocus]);
  return (
    <h2 ref={ref} tabIndex={-1} className={className}>
      {children}
    </h2>
  );
}

/** Focus a failure notice's heading on arrival, under the same rule as StepHeading. */
export function useStepFocusRef() {
  const autoFocus = useContext(StepFocusContext);
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) focusIfFree(ref.current);
  }, [autoFocus]);
  return ref;
}
