import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { ScanFlow } from "./scan-flow";

const TITLE = "Scan";

export const metadata: Metadata = { title: TITLE, description: "Take a baseline or check-in skin measurement." };

export default function ScanPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Loading…" /></div>}>
        <ScanFlow />
      </Suspense>
    </>
  );
}
