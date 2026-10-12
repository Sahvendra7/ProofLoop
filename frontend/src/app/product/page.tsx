import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ProductView } from "./product-view";

export const metadata: Metadata = { title: "Product", description: "Product facts, match logic and a YouCam goal preview." };

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading product…" /></div>}>
      <ProductView />
    </Suspense>
  );
}
