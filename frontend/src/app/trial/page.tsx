import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { TrialView } from "./trial-view";

export const metadata: Metadata = { title: "Trial", description: "Baseline versus check-in, compared against normal scan variation." };

export default function TrialPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading trial…" /></div>}>
      <TrialView />
    </Suspense>
  );
}
