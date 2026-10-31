import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { TrialView } from "./trial-view";

const TITLE = "Trial";

export const metadata: Metadata = { title: TITLE, description: "Baseline versus check-in, compared against normal scan variation." };

export default function TrialPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading trial…" /></div>}>
        <TrialView />
      </Suspense>
    </>
  );
}
