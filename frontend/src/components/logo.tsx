import Link from "next/link";

/** Wordmark: an open loop with a measured point on it. */
export function LoopMark({ className = "size-7", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="none"
        stroke={light ? "#fff" : "var(--color-espresso)"}
        strokeWidth="3"
        strokeDasharray="52 17"
        strokeLinecap="round"
        transform="rotate(-50 16 16)"
      />
      <circle cx="25.5" cy="10" r="3.6" fill={light ? "#fff" : "var(--color-strawberry)"} />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="ProofLoop home">
      <LoopMark light={light} />
      <span className={`font-display text-[1.3rem] font-bold tracking-tight ${light ? "text-white" : "text-espresso"}`}>
        ProofLoop
      </span>
    </Link>
  );
}
