import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { MatchesView } from "./matches-view";

export const metadata: Metadata = { title: "Matches", description: "Catalogue products matched to your focus, with every reason shown." };

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Matching…" /></div>}>
      <MatchesView />
    </Suspense>
  );
}
