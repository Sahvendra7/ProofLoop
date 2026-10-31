import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { ResultsView } from "./results-view";

const TITLE = "Your snapshot";

export const metadata: Metadata = { title: TITLE, description: "Measured skin concerns from your scan." };

export default function ResultsPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading your results…" /></div>}>
        <ResultsView />
      </Suspense>
    </>
  );
}
