"use client";

import { useSearchParams } from "next/navigation";
import { useGo } from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImageUp, Loader2, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { saveCapture } from "@/lib/capture-store";
import type { Scan } from "@/lib/types";
import { Button, Notice } from "@/components/ui";
import { CheckinScreen, PhoneFrame } from "@/components/previews";
import { SampleDataButton } from "../sample-data-button";
import { Framer, type FramedImage } from "./framer";

type Step =
  | { kind: "consent" }
  | { kind: "choose" }
  | { kind: "camera" }
  | { kind: "frame"; src: string; w: number; h: number; source: "camera" | "upload" }
  | { kind: "analyzing"; framed: FramedImage; source: "camera" | "upload"; key: string; scan: Scan | null; startedAt: number }
  | { kind: "failed"; title: string; hint: string | null; code: string; retry?: Step };

const MAX_BYTES = 10 * 1024 * 1024;
const CONSENT_KEY = "pl:consent";

const STAGES = [
  { id: "queued", label: "Preparing your photo" },
  { id: "registering", label: "Registering the photo with YouCam" },
  { id: "uploading", label: "Uploading securely" },
  { id: "analyzing", label: "YouCam is analysing 8 skin concerns" },
  { id: "complete", label: "Reading results" },
];

export function ScanFlow() {
  const go = useGo();
  const params = useSearchParams();
  const trialId = params.get("trial") ?? undefined;
  const [step, setStep] = useState<Step>(() => {
    try {
      return sessionStorage.getItem(CONSENT_KEY) ? { kind: "choose" } : { kind: "consent" };
    } catch {
      return { kind: "consent" };
    }
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step.kind]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="mb-4 inline-flex rounded-full bg-berry-milk px-3 py-1 text-xs font-semibold text-berry-deep">{trialId ? "Trial check-in" : "Step 1 of 4 · Measure"}</p>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] text-espresso">
          {trialId ? "Check in on your trial" : "Take your baseline"}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          {trialId
            ? "For a fair comparison, use the same spot and similar light as your first scan, with no makeup."
            : "One clear, front-facing photo. YouCam's Skin Analysis API scores eight visible concerns from it."}
        </p>
      </header>

      <div className={step.kind === "consent" || step.kind === "choose" ? "grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start" : ""}>
      <div>
      {step.kind === "consent" && (
        <Consent
          onAccept={() => {
            try {
              sessionStorage.setItem(CONSENT_KEY, "1");
            } catch {}
            setStep({ kind: "choose" });
          }}
        />
      )}
      {step.kind === "choose" && <Choose onCamera={() => setStep({ kind: "camera" })} onImage={(src, w, h) => setStep({ kind: "frame", src, w, h, source: "upload" })} onError={(t, h) => setStep({ kind: "failed", title: t, hint: h, code: "client" })} />}
      </div>
      {(step.kind === "consent" || step.kind === "choose") && <FairPhotoGuide />}
      </div>
      {step.kind === "camera" && (
        <CameraCapture
          onCancel={() => setStep({ kind: "choose" })}
          onCapture={(src, w, h) => setStep({ kind: "frame", src, w, h, source: "camera" })}
          onError={(t, h) => setStep({ kind: "failed", title: t, hint: h, code: "camera" })}
        />
      )}
      {step.kind === "frame" && (
        <Framer
          src={step.src}
          naturalWidth={step.w}
          naturalHeight={step.h}
          onBack={() => setStep({ kind: "choose" })}
          onRetake={step.source === "camera" ? () => setStep({ kind: "camera" }) : undefined}
          onConfirm={(framed) =>
            setStep({ kind: "analyzing", framed, source: step.source, key: newIdempotencyKey(), scan: null, startedAt: Date.now() })
          }
        />
      )}
      {step.kind === "analyzing" && (
        <Analyzing
          step={step}
          trialId={trialId}
          onUpdate={(scan) => setStep((s) => (s.kind === "analyzing" ? { ...s, scan } : s))}
          onFailed={(title, hint, code, retryFrame) =>
            setStep({ kind: "failed", title, hint, code, retry: retryFrame })
          }
          onDone={(scan) => {
            saveCapture(scan.id, step.framed.dataUrl);
            go(trialId ? `/trial?id=${trialId}` : `/results?scan=${scan.id}`);
          }}
        />
      )}
      {step.kind === "failed" && (
        <div className="max-w-xl space-y-6">
          <Notice tone="error" title={step.title}>
            {step.hint}
          </Notice>
          <div className="flex flex-wrap gap-3">
            {step.retry && (
              <Button onClick={() => setStep(step.retry!)}>
                <RefreshCcw aria-hidden className="size-4" /> Adjust and retry
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStep({ kind: "choose" })}>
              Choose another photo
            </Button>
          </div>
          {!trialId && (
            <div className="border-t border-line pt-6">
              <p className="mb-3 text-sm text-ink-3">Or explore the full journey with a recorded sample analysis:</p>
              <SampleDataButton size="md" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FairPhotoGuide() {
  const tips = ["Face a window or soft, even light", "No makeup, hair off your forehead", "Glasses off, mouth closed", "Same spot and camera every time"];
  return (
    <aside aria-label="What makes a fair photo" className="strawberry-glow hidden overflow-hidden rounded-[2rem] p-8 text-white lg:block">
      <p className="font-display text-2xl font-bold leading-tight">A fair test starts with a fair photo.</p>
      <PhoneFrame label="Framing guide" className="mx-auto mt-6 w-[13.5rem]">
        <CheckinScreen title="Fill the oval" />
      </PhoneFrame>
      <ul className="mt-6 space-y-2.5 text-sm">
        {tips.map((t) => (
          <li key={t} className="flex items-center gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/25"><Check aria-hidden className="size-3" /></span>
            {t}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Consent({ onAccept }: { onAccept: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <section aria-labelledby="consent-title" className="max-w-2xl rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <ShieldCheck aria-hidden className="size-7 text-accent" />
      <h2 id="consent-title" className="mt-4 font-display text-2xl text-ink">Before you take a photo</h2>
      <ul className="mt-5 space-y-3 leading-relaxed text-ink-2">
        <li><strong className="text-ink">What&apos;s sent:</strong> one photo, with location and camera metadata removed, goes from our server to the YouCam Skin Analysis API.</li>
        <li><strong className="text-ink">What&apos;s kept:</strong> ProofLoop stores the scores, not the photo. Your browser keeps the framed photo in this tab only, for the overlays and preview, until you close it.</li>
        <li><strong className="text-ink">What it isn&apos;t:</strong> a medical assessment. Scores describe how skin looks in one photo, and lighting can shift them.</li>
        <li><strong className="text-ink">Your control:</strong> delete everything at any time from My trials.</li>
      </ul>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] bg-sunken p-4">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--color-accent)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span className="text-sm leading-relaxed text-ink">I&apos;m 18 or over, this is my own face, and I agree to it being analysed as described above.</span>
      </label>
      <Button className="mt-6" disabled={!agreed} onClick={onAccept}>
        Continue
      </Button>
    </section>
  );
}

function Choose({
  onCamera,
  onImage,
  onError,
}: {
  onCamera: () => void;
  onImage: (src: string, w: number, h: number) => void;
  onError: (title: string, hint: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return onError("That file type isn't supported.", "Use a JPEG, PNG or WebP photo. iPhone HEIC photos can be exported as JPEG.");
    }
    if (file.size > MAX_BYTES) return onError("That photo is larger than 10 MB.", "Use a smaller photo or a screenshot of it.");
    const src = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const img = new Image();
    img.src = src;
    try {
      await img.decode();
    } catch {
      return onError("We couldn't read that photo.", "Try a different file.");
    }
    if (Math.min(img.naturalWidth, img.naturalHeight) < 480) {
      return onError("That photo is too small.", "The shorter side needs to be at least 480 pixels.");
    }
    onImage(src, img.naturalWidth, img.naturalHeight);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button type="button" onClick={onCamera} className="group rounded-[var(--radius-xl)] bg-card p-7 text-left shadow-[var(--shadow-card)] ring-1 ring-line transition hover:ring-ink/30">
        <Camera aria-hidden className="size-7 text-accent" />
        <p className="mt-5 text-lg font-semibold text-ink">Take a photo</p>
        <p className="mt-1 text-ink-2">Uses your camera. We&apos;ll ask for permission only now.</p>
      </button>
      <button type="button" onClick={() => inputRef.current?.click()} className="group rounded-[var(--radius-xl)] bg-card p-7 text-left shadow-[var(--shadow-card)] ring-1 ring-line transition hover:ring-ink/30">
        <ImageUp aria-hidden className="size-7 text-accent" />
        <p className="mt-5 text-lg font-semibold text-ink">Upload a photo</p>
        <p className="mt-1 text-ink-2">JPEG, PNG or WebP, up to 10 MB.</p>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload a photo" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="rounded-[var(--radius-lg)] bg-sunken p-5 text-sm leading-relaxed text-ink-2 sm:col-span-2">
        <p className="font-semibold text-ink">For a measurement you can compare later</p>
        <p className="mt-1">Face a window or soft light, no makeup, hair off your forehead, glasses off. Use the same spot each time.</p>
      </div>
    </div>
  );
}

function CameraCapture({
  onCapture,
  onCancel,
  onError,
}: {
  onCapture: (src: string, w: number, h: number) => void;
  onCancel: () => void;
  onError: (title: string, hint: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      // Browsers hide the camera API entirely on plain-HTTP pages (other than localhost).
      if (!window.isSecureContext) onError("The camera needs a secure (https) connection.", "Open ProofLoop over https, or upload a photo instead.");
      else onError("This browser can't open the camera here.", "Upload a photo instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          onError("Camera access was blocked.", "Allow camera access for this site in your browser settings, or upload a photo instead.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          onError("We couldn't find a front camera.", "Upload a photo instead.");
        } else if (name === "NotReadableError" || name === "AbortError") {
          onError("Your camera is busy.", "Close other apps or tabs using the camera and try again, or upload a photo instead.");
        } else {
          onError("We couldn't open your camera.", "Allow camera access in your browser settings, or upload a photo instead.");
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.95), v.videoWidth, v.videoHeight);
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-xl)] bg-ink">
        <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="h-full w-full -scale-x-100 object-cover" aria-label="Camera preview" />
        <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <ellipse cx="150" cy="185" rx="105" ry="140" fill="none" stroke="#fe3144" strokeWidth="3.5" strokeDasharray="9 8" opacity="0.9" />
        </svg>
        {!ready && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-4 animate-spin" /> Starting camera…</span>
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <Button variant="secondary" onClick={onCancel} aria-label="Cancel camera">
          <X aria-hidden className="size-4" /> Cancel
        </Button>
        <Button onClick={capture} disabled={!ready}>
          <Camera aria-hidden className="size-4" /> Capture
        </Button>
      </div>
    </div>
  );
}

function Analyzing({
  step,
  trialId,
  onUpdate,
  onDone,
  onFailed,
}: {
  step: Extract<Step, { kind: "analyzing" }>;
  trialId?: string;
  onUpdate: (scan: Scan) => void;
  onDone: (scan: Scan) => void;
  onFailed: (title: string, hint: string | null, code: string, retry?: Step) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const latest = useRef({ onUpdate, onDone, onFailed });
  useEffect(() => {
    latest.current = { onUpdate, onDone, onFailed };
  });

  useEffect(() => {
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - step.startedAt) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [step.startedAt]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const retryFrame: Step = { kind: "frame", src: step.framed.dataUrl, w: step.framed.width, h: step.framed.height, source: step.source };

    async function poll(id: string, attempt = 0) {
      if (stopped) return;
      try {
        const scan = await api.scan(id);
        if (stopped) return;
        latest.current.onUpdate(scan);
        if (scan.status === "complete") return latest.current.onDone(scan);
        if (scan.status === "failed") {
          return latest.current.onFailed(scan.failure?.message ?? "The analysis didn't complete.", scan.failure?.hint ?? null, scan.failure?.code ?? "failed", retryFrame);
        }
        timer = setTimeout(() => poll(id), 1200);
      } catch (err) {
        if (attempt < 4) timer = setTimeout(() => poll(id, attempt + 1), 1500 * (attempt + 1));
        else latest.current.onFailed("We lost contact with the server.", err instanceof ApiError ? err.hint : null, "network", retryFrame);
      }
    }

    api
      .startScan(step.framed.blob, { source: step.source, idempotencyKey: step.key, trialId })
      .then((scan) => {
        latest.current.onUpdate(scan);
        poll(scan.id);
      })
      .catch((err: unknown) => {
        const e = err instanceof ApiError ? err : new ApiError("unknown", "Something went wrong.", 0);
        latest.current.onFailed(e.message, e.hint, e.code, e.code === "provider_not_configured" ? undefined : retryFrame);
      });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step.framed, step.key, step.source, trialId]);

  const stage = step.scan?.stage ?? "queued";
  const activeIndex = Math.max(0, STAGES.findIndex((s) => s.id === stage));
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-xl)] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={step.framed.dataUrl} alt="The photo being analysed" className="h-full w-full object-cover opacity-80" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 animate-pulse bg-gradient-to-b from-white/15 to-transparent motion-reduce:hidden" />
      </div>
      <div>
        <h2 className="font-display text-2xl text-ink">Measuring…</h2>
        <p className="mt-1 text-sm text-ink-3" aria-live="off">
          {elapsed}s elapsed · usually 8–15 seconds. Keep this tab open.
        </p>
        <ol className="mt-6 space-y-3" aria-live="polite">
          {STAGES.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li key={s.id} className={`flex items-center gap-3 ${done || active ? "text-ink" : "text-ink-3"}`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-better text-white" : active ? "bg-accent-soft text-accent" : "bg-sunken"}`}>
                  {done ? <Check aria-hidden className="size-3.5" /> : active ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
                </span>
                <span>{s.label}</span>
                <span className="sr-only">{done ? "done" : active ? "in progress" : "waiting"}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-xs leading-relaxed text-ink-3">
          Status comes from the server as each step of the YouCam request completes. If YouCam rejects the photo, nothing
          is saved and no units are used.
        </p>
      </div>
    </div>
  );
}
