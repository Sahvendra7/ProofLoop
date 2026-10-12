import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ResultsView } from "./results-view";

export const metadata: Metadata = { title: "Your snapshot", description: "Measured skin concerns from your scan." };

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading your results…" /></div>}>
      <ResultsView />
    </Suspense>
  );
}
