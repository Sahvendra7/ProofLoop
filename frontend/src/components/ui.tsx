import Link from "next/link";
import type { ComponentProps, ReactNode, Ref } from "react";
import { AlertTriangle, Check, Info, Loader2, XCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 forced-colors:aria-disabled:text-[GrayText] select-none";
const variants: Record<Variant, string> = {
  primary: "bg-strawberry-ink text-white shadow-[0_10px_24px_-12px_rgb(214_26_47/0.7)] hover:bg-berry-deep active:translate-y-px",
  secondary: "bg-white text-strawberry-ink ring-1 ring-line-strong hover:ring-strawberry-ink/50 active:translate-y-px",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunken",
  quiet: "text-strawberry-ink underline underline-offset-4 decoration-strawberry-ink/30 hover:decoration-strawberry-ink rounded-sm",
};
const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  const sizing = variant === "quiet" ? "" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`;
}

/**
 * `loading` and `softDisabled` keep the button focusable (aria-disabled, clicks ignored): disabling the focused
 * button would drop keyboard focus to the page body just as the result arrives. Use `disabled` only for a button
 * that can't be used yet.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  softDisabled = false,
  className = "",
  children,
  disabled,
  onClick,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean; softDisabled?: boolean }) {
  const blocked = loading || softDisabled;
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      {...props}
      onClick={blocked ? (e) => e.preventDefault() : onClick}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-[1.75rem] bg-card shadow-[var(--shadow-card)] ring-1 ring-line forced-colors:border forced-colors:border-[CanvasText] ${className}`} {...props} />;
}

const noticeStyles = {
  info: { box: "bg-live-soft text-live ring-live/15", Icon: Info },
  warn: { box: "bg-demo-soft text-demo ring-demo/15", Icon: AlertTriangle },
  error: { box: "bg-worse-soft text-worse ring-worse/20", Icon: XCircle },
} as const;

/**
 * A static message by default. Errors that appear in place of nothing are alerts (`live`, the default for
 * tone="error"). A notice that replaces the control the user pressed gets `headingRef` instead: its title becomes a
 * focusable h2 that takes focus, and it is not also a live region, so it's spoken once.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className = "",
  live = tone === "error",
  headingRef,
}: {
  tone?: keyof typeof noticeStyles;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  live?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { box, Icon } = noticeStyles[tone];
  const role = headingRef || !live ? undefined : tone === "error" ? "alert" : "status";
  return (
    <div role={role} className={`flex gap-3 rounded-[var(--radius-md)] p-4 ring-1 forced-colors:border forced-colors:border-[CanvasText] ${box} ${className}`}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title &&
          (headingRef ? (
            <h2 ref={headingRef} tabIndex={-1} className="font-semibold">
              {title}
            </h2>
          ) : (
            <p className="font-semibold">{title}</p>
          ))}
        {children && <div className={title ? "mt-1 opacity-90" : ""}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-ink-3">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[var(--radius-md)] bg-sunken ${className}`} />;
}

/**
 * Text styled in capitals (`.eyebrow`) but read in its own case. WebKit hands text-transformed text to VoiceOver,
 * which then reads labels such as "BUDGET" in capitals or letter by letter. The visible copy is hidden from
 * assistive technology and a natural-case copy is read instead; nothing changes visually.
 */
export function CapsText({ children }: { children: ReactNode }) {
  // `relative` keeps the absolutely positioned copy inside its box: in a horizontally scrolling table it otherwise
  // escapes the scroll container and widens the page.
  return (
    <span className="relative">
      <span aria-hidden>{children}</span>
      <span className="sr-only normal-case">{children}</span>
    </span>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="eyebrow mb-2"><CapsText>{label}</CapsText></legend>
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-sunken p-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)] ${
              value === opt.value ? "border-ink bg-ink font-semibold text-paper" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {/* Named directly, with the visible text hidden from assistive technology: as a separate text node next to
                the visually hidden radio, it was read a second time in linear reading. Clicking it still selects. */}
            <input
              type="radio"
              className="sr-only"
              name={label}
              value={opt.value}
              aria-label={opt.label}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {/* Selection is shown by shape as well as colour, and survives forced-colours mode. */}
            {value === opt.value && <Check aria-hidden className="size-3.5 shrink-0" />}
            <span aria-hidden>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-ink-2">
      <input type="checkbox" role="switch" aria-label={label} className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full border-2 border-ink-3 bg-white transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)] after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-ink-3 after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-white forced-colors:[forced-color-adjust:none] forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:after:bg-[CanvasText] forced-colors:peer-checked:bg-[Highlight] forced-colors:peer-checked:after:bg-[HighlightText]"
      />
      <span aria-hidden>{label}</span>
    </label>
  );
}

export function PageIntro({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="max-w-2xl">
      {eyebrow && <div className="mb-4 inline-flex rounded-full bg-berry-milk px-3 py-1 text-xs font-semibold text-berry-deep">{eyebrow}</div>}
      <h1 className="font-display text-[clamp(2.4rem,6vw,4.25rem)] font-bold leading-[0.98] text-espresso">{title}</h1>
      {children && <div className="mt-4 text-lg leading-relaxed text-ink-2">{children}</div>}
    </header>
  );
}
