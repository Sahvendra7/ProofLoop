"use client";

import { useGo } from "@/lib/navigation";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

export function SampleDataButton({
  label = "Try with sample data",
  size = "lg",
  variant = "secondary",
}: {
  label?: string;
  size?: "md" | "lg";
  variant?: "secondary" | "quiet";
}) {
  const go = useGo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const scan = await api.demoScan();
      go(`/results?scan=${scan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ""}` : "Couldn't load sample data.");
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant={variant} size={size} onClick={start} loading={busy}>
        {!busy && variant !== "quiet" && <FlaskConical aria-hidden className="size-5" />} {label}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-worse">
          {error}
        </p>
      )}
    </div>
  );
}
