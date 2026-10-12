import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { TrialsView } from "./trials-view";

export const metadata: Metadata = { title: "My trials", description: "Your trials, scans and data controls." };

export default function TrialsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Loading…" /></div>}>
      <TrialsView />
    </Suspense>
  );
}
