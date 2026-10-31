import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { TrialsView } from "./trials-view";

const TITLE = "My trials";

export const metadata: Metadata = { title: TITLE, description: "Your trials, scans and data controls." };

export default function TrialsPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Loading…" /></div>}>
        <TrialsView />
      </Suspense>
    </>
  );
}
