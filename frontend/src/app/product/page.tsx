import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteTitle } from "@/components/route-title";
import { Spinner } from "@/components/ui";
import { titled } from "@/lib/titles";
import { ProductView } from "./product-view";

const TITLE = "Product";

export const metadata: Metadata = { title: TITLE, description: "Product facts, match logic and a YouCam goal preview." };

export default function ProductPage() {
  return (
    <>
      <RouteTitle title={titled(TITLE)} />
      <Suspense fallback={<div className="mx-auto max-w-6xl px-6 py-16"><Spinner label="Loading product…" /></div>}>
        <ProductView />
      </Suspense>
    </>
  );
}
