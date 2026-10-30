"use client";

import { useSearchParams } from "next/navigation";
import { useGo } from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImageUp, Loader2, RefreshCcw, Scale, ShieldCheck, X } from "lucide-react";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { saveCapture } from "@/lib/capture-store";
import { shortDate } from "@/lib/format";
import { useDocumentTitle } from "@/lib/hooks";
import type { Capture, Preflight, Scan } from "@/lib/types";
import { useAnnounce } from "@/components/announcer";
import { Button, Notice } from "@/components/ui";
import { CheckinScreen, PhoneFrame } from "@/components/previews";
import { SampleDataButton } from "../sample-data-button";
import { Framer, type FramedImage } from "./framer";
import { StepFocusContext, StepHeading, useStepFocusRef } from "./step-heading";

type Step =
  | { kind: "consent" }
  | { kind: "choose" }
  | { kind: "camera" }
  | { kind: "frame"; src: string; w: number; h: number; source: "camera" | "upload" }
  | { kind: "preflight"; framed: FramedImage; source: "camera" | "upload" }
  | { kind: "analyzing"; framed: FramedImage; source: "camera" | "upload"; key: string; scan: Scan | null; startedAt: number }
  | { kind: "failed"; title: string; hint: string | null; code: string; retry?: Step };

const MAX_BYTES = 10 * 1024 * 1024;
const CONSENT_KEY = "pl:consent";

const STEP_TITLES: Record<Step["kind"], string> = {
  consent: "Before your photo",
  choose: "Add a photo",
  camera: "Camera",
  frame: "Framing",
  preflight: "Comparison check",
  analyzing: "Measuring",
  failed: "Couldn't analyse",
};

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
  // Instrument check: a second baseline photo of unchanged skin, taken before the first check-in.
  const repeat = Boolean(trialId) && params.get("repeat") === "1";
  const [step, setStepState] = useState<Step>(() => {
    try {
      return sessionStorage.getItem(CONSENT_KEY) ? { kind: "choose" } : { kind: "consent" };
    } catch {
      return { kind: "consent" };
    }
  });
  // Once the user moves to another step, each new step's heading takes focus (the pressed button is gone).
  const [moved, setMoved] = useState(false);
  const setStep = (next: Step | ((s: Step) => Step)) => {
    if (typeof next !== "function") setMoved(true);
    setStepState(next);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step.kind]);
  useDocumentTitle(`${STEP_TITLES[step.kind]} · ${repeat ? "Instrument check" : trialId ? "Check-in" : "Scan"} · ProofLoop`);

  return (
    <StepFocusContext.Provider value={moved}>
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="mb-4 inline-flex rounded-full bg-berry-milk px-3 py-1 text-xs font-semibold text-berry-deep">{repeat ? "Instrument check" : trialId ? "Trial check-in" : "Step 1 of 4 · Measure"}</p>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] text-espresso">
          {repeat ? "Take a second baseline photo" : trialId ? "Check in on your trial" : "Take your baseline"}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-2">
          {repeat
            ? "Step away, come back and take a fresh photo in the same spot and light. Your skin hasn't changed, so any difference between the two scans is the instrument's own variation."
            : trialId
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
            setStep(
              trialId
                ? { kind: "preflight", framed, source: step.source }
                : { kind: "analyzing", framed, source: step.source, key: newIdempotencyKey(), scan: null, startedAt: Date.now() },
            )
          }
        />
      )}
      {step.kind === "preflight" && trialId && (
        <CaptureMatch
          trialId={trialId}
          repeat={repeat}
          step={step}
          onAnalyse={() => setStep({ kind: "analyzing", framed: step.framed, source: step.source, key: newIdempotencyKey(), scan: null, startedAt: Date.now() })}
          onRetake={() => setStep({ kind: "choose" })}
          onFailed={(title, hint, code) =>
            setStep({ kind: "failed", title, hint, code, retry: { kind: "frame", src: step.framed.dataUrl, w: step.framed.width, h: step.framed.height, source: step.source } })
          }
        />
      )}
      {step.kind === "analyzing" && (
        <Analyzing
          step={step}
          trialId={trialId}
          purpose={repeat ? "repeat_baseline" : undefined}
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
          <FailedNotice title={step.title} hint={step.hint} />
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
    </StepFocusContext.Provider>
  );
}

/** The failure replaces the step (and the button that was pressed): its heading takes focus and is read once. */
function FailedNotice({ title, hint }: { title: string; hint: string | null }) {
  const ref = useStepFocusRef();
  return (
    <Notice tone="error" title={title} headingRef={ref}>
      {hint}
    </Notice>
  );
}

function FairPhotoGuide() {
  const tips = ["Face a window or soft, even light", "No makeup, hair off your forehead", "Glasses off, mouth closed", "Same spot and camera every time"];
  return (
    <aside aria-label="What makes a fair photo" className="strawberry-glow hidden overflow-hidden rounded-[2rem] p-8 text-white lg:block">
      <p className="font-display text-2xl font-bold leading-tight">A fair test starts with a fair photo.</p>
      <PhoneFrame label="Illustration of the framing oval" className="mx-auto mt-6 w-[13.5rem]">
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
  const [missing, setMissing] = useState(false);
  const box = useRef<HTMLInputElement>(null);
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
        <input
          ref={box}
          type="checkbox"
          className="mt-1 size-4 accent-[var(--color-accent)]"
          checked={agreed}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? "consent-missing" : undefined}
          onChange={(e) => {
            setAgreed(e.target.checked);
            if (e.target.checked) setMissing(false);
          }}
        />
        <span className="text-sm leading-relaxed text-ink">I&apos;m 18 or over, this is my own face, and I agree to it being analysed as described above.</span>
      </label>
      {missing && (
        <p id="consent-missing" className="mt-3 text-sm font-semibold text-worse">
          Tick the box to confirm before continuing.
        </p>
      )}
      {/* Always operable: a disabled button is skipped by Tab and can't say why. */}
      <Button
        className="mt-6"
        onClick={() => {
          if (agreed) return onAccept();
          setMissing(true);
          box.current?.focus();
        }}
      >
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
      <StepHeading className="text-lg font-semibold text-ink sm:col-span-2">Add your photo</StepHeading>
      <button type="button" onClick={onCamera} className="group rounded-[var(--radius-xl)] bg-card p-7 text-left shadow-[var(--shadow-card)] ring-1 ring-line transition hover:ring-ink/30 forced-colors:border forced-colors:border-[CanvasText]">
        <Camera aria-hidden className="size-7 text-accent" />
        <p className="mt-5 text-lg font-semibold text-ink">Take a photo</p>
        <p className="mt-1 text-ink-2">Uses your camera. We&apos;ll ask for permission only now.</p>
      </button>
      <button type="button" onClick={() => inputRef.current?.click()} className="group rounded-[var(--radius-xl)] bg-card p-7 text-left shadow-[var(--shadow-card)] ring-1 ring-line transition hover:ring-ink/30 forced-colors:border forced-colors:border-[CanvasText]">
        <ImageUp aria-hidden className="size-7 text-accent" />
        <p className="mt-5 text-lg font-semibold text-ink">Upload a photo</p>
        <p className="mt-1 text-ink-2">JPEG, PNG or WebP, up to 10 MB.</p>
      </button>
      {/* Opened by the "Upload a photo" button; not a second, invisible tab stop. */}
      <input ref={inputRef} type="file" tabIndex={-1} accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload a photo" onChange={(e) => onFile(e.target.files?.[0])} />
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
  const announce = useAnnounce();

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
      <StepHeading className="mb-4 text-lg font-semibold text-ink">Take your photo</StepHeading>
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-xl)] bg-ink">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => {
            setReady(true);
            announce("Camera ready. The Capture button is below the preview.");
          }} className="h-full w-full -scale-x-100 object-cover" aria-label="Camera preview" />
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

const MATCH_COPY: Record<Preflight["level"], { tone: "info" | "warn" | "error"; title: string; body: string }> = {
  good: {
    tone: "info",
    title: "This photo matches your baseline's conditions.",
    body: "Lighting and capture method are close enough for a fair comparison.",
  },
  fair: {
    tone: "warn",
    title: "Comparable, with caveats.",
    body: "You can go ahead, but the verdict will carry these caveats. Matching the conditions more closely gives a cleaner answer.",
  },
  poor: {
    tone: "error",
    title: "This photo won't give a fair comparison.",
    body: "With conditions this different, ProofLoop will answer \u201cwe can't call this one\u201d whatever the scores say. Retaking it in light closer to your baseline costs nothing; analysing this one uses 12 YouCam units.",
  },
};

function describeCapture(c: Capture) {
  const how = c.source === "camera" ? "Camera" : c.source === "upload" ? "Upload" : "Sample";
  return { how, light: c.luminance_mean === null ? "—" : `${Math.round(c.luminance_mean)} / 255` };
}

/** Free check of a check-in photo against the baseline before YouCam units are spent. */
function CaptureMatch({
  trialId,
  repeat,
  step,
  onAnalyse,
  onRetake,
  onFailed,
}: {
  trialId: string;
  repeat: boolean;
  step: Extract<Step, { kind: "preflight" }>;
  onAnalyse: () => void;
  onRetake: () => void;
  onFailed: (title: string, hint: string | null, code: string) => void;
}) {
  const [result, setResult] = useState<Preflight | null>(null);
  const [unchecked, setUnchecked] = useState(false);
  const announce = useAnnounce();
  const latest = useRef(onFailed);
  useEffect(() => {
    latest.current = onFailed;
  });

  useEffect(() => {
    let stopped = false;
    api
      .preflight(trialId, step.framed.blob, step.source, repeat ? "repeat_baseline" : "checkin")
      .then((r) => {
        if (stopped) return;
        setResult(r);
        announce(`${MATCH_COPY[r.level].title} Details and your options follow.`);
      })
      .catch((err: unknown) => {
        if (stopped) return;
        const e = err instanceof ApiError ? err : null;
        // A photo the server can't use fails here, for free. Anything else
        // (network, server) shouldn't block the user: say it wasn't checked.
        if (e && e.status >= 400 && e.status < 500 && e.code !== "session_required") latest.current(e.message, e.hint, e.code);
        else {
          setUnchecked(true);
          announce("We couldn't run the free check. You can still analyse.");
        }
      });
    return () => {
      stopped = true;
    };
    // announce is stable; the check runs once per photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialId, step.framed.blob, step.source, repeat]);

  const copy = result ? MATCH_COPY[result.level] : null;
  const base = result ? describeCapture(result.baseline_capture) : null;
  const now = result ? describeCapture(result.candidate_capture) : null;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-xl)] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={step.framed.dataUrl} alt={repeat ? "Your second baseline photo" : "Your check-in photo"} className="h-full w-full object-cover" />
      </div>
      {/* The result is announced once through the app announcer; this block is not a live region. */}
      <div>
        <p className="eyebrow inline-flex items-center gap-2"><Scale aria-hidden className="size-4" /> Capture match · free</p>
        <StepHeading className="mt-2 font-display text-2xl text-ink">Is this a fair comparison?</StepHeading>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Before spending YouCam units, ProofLoop compares this photo with your baseline&apos;s conditions. The photo is checked and
          discarded; nothing is sent to YouCam yet.
        </p>
        {!result && !unchecked && (
          <p className="mt-6 inline-flex items-center gap-2 text-ink-2"><Loader2 aria-hidden className="size-4 animate-spin" /> Checking against your baseline…</p>
        )}
        {unchecked && (
          <Notice tone="warn" live={false} className="mt-6" title="We couldn't run the free check.">
            You can still analyse; the verdict will still check lighting and capture method afterwards.
          </Notice>
        )}
        {result && copy && base && now && (
          <>
            <Notice tone={copy.tone} live={false} className="mt-6" title={copy.title}>
              <p>{copy.body}</p>
              {result.issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{result.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
            </Notice>
            <table className="mt-5 w-full max-w-md text-left text-sm">
              <caption className="sr-only">Baseline and check-in capture conditions</caption>
              <thead className="text-xs uppercase tracking-wider text-ink-3">
                <tr><th scope="col" className="py-2 font-semibold"></th><th scope="col" className="py-2 font-semibold">Baseline</th><th scope="col" className="py-2 font-semibold">This photo</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr><th scope="row" className="py-2 font-medium text-ink">Brightness</th><td className="tabular py-2 text-ink-2">{base.light}</td><td className="tabular py-2 text-ink">{now.light}</td></tr>
                <tr><th scope="row" className="py-2 font-medium text-ink">Capture</th><td className="py-2 text-ink-2">{base.how}</td><td className="py-2 text-ink">{now.how}</td></tr>
              </tbody>
            </table>
            {result.early && !repeat && (
              <p className="mt-4 text-sm text-ink-2">
                Your plan&apos;s check-in date is {shortDate(result.planned_checkin_at)}. Checking in now gives an early look, labelled as such.
              </p>
            )}
          </>
        )}
        {(result || unchecked) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {result?.same_photo ? (
              <Button onClick={onRetake}><RefreshCcw aria-hidden className="size-4" /> Take a fresh photo</Button>
            ) : result?.level === "poor" ? (
              <>
                <Button onClick={onRetake}><RefreshCcw aria-hidden className="size-4" /> Retake in better-matched light</Button>
                <Button variant="secondary" onClick={onAnalyse}>Analyse anyway (12 units)</Button>
              </>
            ) : (
              <>
                <Button onClick={onAnalyse}>{repeat ? "Analyse the second photo (12 units)" : "Analyse this check-in"}</Button>
                <Button variant="secondary" onClick={onRetake}>Use another photo</Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Analyzing({
  step,
  trialId,
  purpose,
  onUpdate,
  onDone,
  onFailed,
}: {
  step: Extract<Step, { kind: "analyzing" }>;
  trialId?: string;
  purpose?: "repeat_baseline";
  onUpdate: (scan: Scan) => void;
  onDone: (scan: Scan) => void;
  onFailed: (title: string, hint: string | null, code: string, retry?: Step) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const latest = useRef({ onUpdate, onDone, onFailed });
  const announce = useAnnounce();
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
      .startScan(step.framed.blob, { source: step.source, idempotencyKey: step.key, trialId, purpose })
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
  }, [step.framed, step.key, step.source, trialId, purpose]);

  const stage = step.scan?.stage ?? "queued";
  const activeIndex = Math.max(0, STAGES.findIndex((s) => s.id === stage));
  // One short sentence per stage the server reports; the first is covered by the focused heading.
  useEffect(() => {
    if (activeIndex > 0) announce(STAGES[activeIndex].label);
  }, [activeIndex, announce]);
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-xl)] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={step.framed.dataUrl} alt="The photo being analysed" className="h-full w-full object-cover opacity-80" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-1/3 animate-pulse bg-gradient-to-b from-white/15 to-transparent motion-reduce:hidden" />
      </div>
      <div>
        <StepHeading className="font-display text-2xl text-ink">Measuring…</StepHeading>
        <p className="mt-1 text-sm text-ink-3" aria-live="off">
          {elapsed}s elapsed · usually 8–15 seconds. Keep this tab open.
        </p>
        <ol className="mt-6 space-y-3">
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
