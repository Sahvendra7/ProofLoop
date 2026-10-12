"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ElementType } from "react";

/** Sets data-visible once the element enters the viewport. Observers disconnect after the first hit. */
export function useInView<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, visible };
}

type RevealProps<T extends ElementType> = { as?: T; delay?: number } & ComponentPropsWithoutRef<T>;

/**
 * Fades content up on first view. Content is fully visible without JS
 * (styles apply only under html.js) and under prefers-reduced-motion.
 */
export function Reveal<T extends ElementType = "div">({ as, delay = 0, className = "", style, ...props }: RevealProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const { ref, visible } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      data-visible={visible}
      className={`reveal ${className}`}
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms` }}
      {...props}
    />
  );
}
