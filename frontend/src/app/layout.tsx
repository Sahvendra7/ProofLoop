import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import { AnnouncerProvider } from "@/components/announcer";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { MOTION_KEY } from "@/lib/motion";
import { SITE_TITLE } from "@/lib/titles";
import "./globals.css";

// Display: Bricolage Grotesque with its width axis, set condensed for headlines and readouts. UI and numerals: IBM Plex Sans.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["opsz", "wdth"] });
const plex = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex", axes: ["wdth"] });

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s · ProofLoop",
  },
  description:
    "Choose one product, track one skin concern, and find out whether the change is bigger than the usual measurement variation. Skin measurement by the YouCam AI Skin Analysis API.",
};

export const viewport: Viewport = {
  themeColor: "#faf7f8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plex.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Opt in to reveal animations only when JS runs; without it everything stays visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* A paused-animations choice (MotionToggle) applies before first paint, so nothing starts moving again. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(MOTION_KEY)})==="paused")document.documentElement.dataset.motion="paused"}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="on-espresso sr-only z-[60] rounded-full bg-espresso px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <AnnouncerProvider>
          <SiteNav />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </AnnouncerProvider>
      </body>
    </html>
  );
}
