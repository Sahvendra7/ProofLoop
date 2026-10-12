import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, Info, Loader2, XCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "quiet";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 select-none";
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

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
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
  return <div className={`rounded-[1.75rem] bg-card shadow-[var(--shadow-card)] ring-1 ring-line ${className}`} {...props} />;
}

const noticeStyles = {
  info: { box: "bg-live-soft text-live ring-live/15", Icon: Info },
  warn: { box: "bg-demo-soft text-demo ring-demo/15", Icon: AlertTriangle },
  error: { box: "bg-worse-soft text-worse ring-worse/20", Icon: XCircle },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof noticeStyles;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = noticeStyles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-[var(--radius-md)] p-4 ring-1 ${box} ${className}`}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
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
      <legend className="eyebrow mb-2">{label}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-sunken p-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === opt.value ? "bg-card text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-ink-2">
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-10 rounded-full bg-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
      {label}
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
