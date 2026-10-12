import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scan", description: "Take a baseline or check-in skin measurement." };

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-16"><Spinner label="Loading…" /></div>}>
      <ScanFlow />
    </Suspense>
  );
}
