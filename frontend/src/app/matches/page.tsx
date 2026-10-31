import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { MatchesView } from "./matches-view";

const TITLE = "Matches";

export const metadata: Metadata = { title: TITLE, description: "Catalogue products matched to your focus, with every reason shown." };

export default function MatchesPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Matching…" /></div>}>
        <MatchesView />
      </Suspense>
    </>
  );
}
