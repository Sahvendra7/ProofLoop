import type { Product } from "@/lib/types";

/**
 * Packaging illustration drawn from catalogue metadata (category + palette).
 * The catalogue is fictional, so there is no product photography to show;
 * an honest illustration beats a stock photo of someone else's product.
 */
export function ProductArt({ product, className = "" }: { product: Product; className?: string }) {
  const [light, deep] = product.palette;
  const kind = shapeFor(product.category);
  const id = product.id.replace(/[^a-z0-9]/gi, "");
  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-lg)] ${className}`} style={{ background: light }}>
      <svg viewBox="0 0 200 240" className="h-full w-full" role="img" aria-label={`Illustration of ${product.name}`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="214" rx="56" ry="7" fill="#000" opacity="0.08" />
        {kind === "dropper" && (
          <g>
            <rect x="84" y="38" width="32" height="30" rx="10" fill={deep} />
            <rect x="92" y="62" width="16" height="14" fill={deep} opacity="0.85" />
            <rect x="64" y="76" width="72" height="136" rx="16" fill="#fff" opacity="0.92" />
            <rect x="64" y="76" width="72" height="136" rx="16" fill={`url(#g${id})`} />
            <rect x="74" y="120" width="52" height="60" rx="4" fill={deep} opacity="0.12" />
          </g>
        )}
        {kind === "jar" && (
          <g>
            <rect x="46" y="112" width="108" height="26" rx="8" fill={deep} />
            <rect x="50" y="136" width="100" height="76" rx="18" fill="#fff" opacity="0.94" />
            <rect x="50" y="136" width="100" height="76" rx="18" fill={`url(#g${id})`} />
            <rect x="66" y="156" width="68" height="34" rx="4" fill={deep} opacity="0.12" />
          </g>
        )}
        {kind === "tube" && (
          <g>
            <path d="M70 40 h60 l-6 150 h-48 z" fill="#fff" opacity="0.94" />
            <path d="M70 40 h60 l-6 150 h-48 z" fill={`url(#g${id})`} />
            <rect x="74" y="188" width="52" height="24" rx="6" fill={deep} />
            <rect x="68" y="34" width="64" height="10" rx="2" fill={deep} opacity="0.5" />
            <rect x="82" y="90" width="36" height="50" rx="3" fill={deep} opacity="0.12" />
          </g>
        )}
        {kind === "bottle" && (
          <g>
            <rect x="88" y="34" width="24" height="26" rx="4" fill={deep} />
            <path d="M80 60 h40 v14 q18 8 18 26 v100 q0 12 -12 12 h-52 q-12 0 -12 -12 v-100 q0 -18 18 -26 z" fill="#fff" opacity="0.94" />
            <path d="M80 60 h40 v14 q18 8 18 26 v100 q0 12 -12 12 h-52 q-12 0 -12 -12 v-100 q0 -18 18 -26 z" fill={`url(#g${id})`} />
            <rect x="74" y="128" width="52" height="56" rx="4" fill={deep} opacity="0.12" />
          </g>
        )}
        <text x="100" y={kind === "jar" ? 177 : kind === "tube" ? 118 : 158} textAnchor="middle" fontFamily="var(--font-display)" fontSize="11" fill={deep}>
          {product.brand}
        </text>
      </svg>
    </div>
  );
}

function shapeFor(category: string): "dropper" | "jar" | "tube" | "bottle" {
  const c = category.toLowerCase();
  if (c.includes("serum") || c.includes("treatment")) return "dropper";
  if (c.includes("mask") || c.includes("moistur")) return "jar";
  if (c.includes("cleanser") || c.includes("eye")) return "tube";
  return "bottle";
}
