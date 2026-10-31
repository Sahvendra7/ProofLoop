"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LocateFixed, Minus, Move, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { StepHeading } from "./step-heading";

export type FramedImage = { blob: Blob; dataUrl: string; width: number; height: number; lowRes: boolean };

const ASPECT = 4 / 3; // frame height / width (portrait 3:4)
const STEP = 0.02; // one arrow key or button press, in frame widths

/**
 * Lets the user position and zoom their photo so the face fills the oval.
 * YouCam rejects photos where the face is narrower than 60% of the image,
 * so the oval is drawn at ~70% of the frame width.
 */
export function Framer({
  src,
  naturalWidth,
  naturalHeight,
  onConfirm,
  onBack,
  onRetake,
}: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  onConfirm: (img: FramedImage) => void;
  onBack: () => void;
  /** set when the photo came from the camera: go straight back to it */
  onRetake?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Geometry in frame units: frame width = 1, frame height = ASPECT.
  const s0 = Math.max(1 / naturalWidth, ASPECT / naturalHeight);
  const scale = s0 * zoom;
  const imgW = naturalWidth * scale;
  const imgH = naturalHeight * scale;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(-(imgW - 1) / 2, Math.min((imgW - 1) / 2, o.x)),
    y: Math.max(-(imgH - ASPECT) / 2, Math.min((imgH - ASPECT) / 2, o.y)),
  });
  const pos = clamp(offset);
  const left = (1 - imgW) / 2 + pos.x;
  const top = (ASPECT - imgH) / 2 + pos.y;
  const cropW = 1 / scale; // in source pixels
  const lowRes = cropW < 480;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !frameRef.current) return;
    const w = frameRef.current.getBoundingClientRect().width;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x) / w, y: drag.current.oy + (e.clientY - drag.current.y) / w });
  }
  // Dragging, the arrow keys and the move buttons all go through the same clamped offset, so each gives the same
  // framing. The buttons are the single-pointer alternative to dragging (WCAG 2.5.7).
  const nudge = (dx: number, dy: number) => setOffset({ x: pos.x + dx, y: pos.y + dy });
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    if (moves[e.key]) {
      e.preventDefault();
      nudge(...moves[e.key]);
    } else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.1));
    else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.1));
  }

  async function confirm() {
    setBusy(true);
    const img = new Image();
    img.src = src;
    await img.decode();
    const sx = -left / scale;
    const sy = -top / scale;
    const sw = 1 / scale;
    const sh = ASPECT / scale;
    const outW = Math.round(Math.min(1080, Math.max(720, sw)));
    const outH = Math.round(outW * ASPECT);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92));
    onConfirm({ blob, dataUrl, width: outW, height: outH, lowRes });
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,380px)_1fr] md:items-start">
      <div className="mx-auto w-full max-w-[380px]">
        <div
          ref={frameRef}
          role="application"
          aria-label="Photo framing. Drag, use the arrow keys or the move buttons to position, plus and minus to zoom."
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="relative aspect-[3/4] w-full cursor-grab touch-none overflow-hidden rounded-[var(--radius-lg)] bg-ink active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, never leaves the browser here */}
          <img
            src={src}
            alt="Your photo"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ width: `${imgW * 100}%`, left: `${left * 100}%`, top: `${(top / ASPECT) * 100}%` }}
          />
          <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <mask id="oval">
                <rect width="300" height="400" fill="white" />
                <ellipse cx="150" cy="185" rx="105" ry="140" fill="black" />
              </mask>
            </defs>
            <rect width="300" height="400" fill="rgb(44 26 26 / 0.6)" mask="url(#oval)" />
            <ellipse cx="150" cy="185" rx="105" ry="140" fill="none" stroke="#fe3144" strokeWidth="3.5" strokeDasharray="9 8" />
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
              <Move aria-hidden className="size-3.5" /> Drag, or use the arrows below
            </span>
          </div>
        </div>
        <div role="group" aria-label="Move photo" className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {MOVES.map(({ label, Icon, dx, dy }) => (
            <button key={label} type="button" aria-label={label} className={MOVE_BUTTON} onClick={() => nudge(dx, dy)}>
              <Icon aria-hidden className="size-4" />
            </button>
          ))}
          <button type="button" className={`${RING_BUTTON} gap-1.5 px-3 text-sm text-ink-2`} onClick={() => setOffset({ x: 0, y: 0 })}>
            <LocateFixed aria-hidden className="size-4" /> Centre photo
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" aria-label="Zoom out" className="grid size-9 place-items-center rounded-full ring-1 ring-line-strong hover:bg-sunken" onClick={() => setZoom((z) => Math.max(1, z - 0.15))}>
            <Minus aria-hidden className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            aria-valuetext={`Zoom ${Math.round(zoom * 100)} percent`}
            className="flex-1 accent-[var(--color-accent)]"
          />
          <button type="button" aria-label="Zoom in" className="grid size-9 place-items-center rounded-full ring-1 ring-line-strong hover:bg-sunken" onClick={() => setZoom((z) => Math.min(4, z + 0.15))}>
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <StepHeading className="font-display text-2xl text-ink">Fill the oval with your face</StepHeading>
          <p className="mt-2 leading-relaxed text-ink-2">
            YouCam needs your face to cover most of the photo&apos;s width. Fit your face from hairline to chin inside the
            oval, eyes roughly level with its widest point.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-ink-2">
          <li>• Forehead visible, hair pulled back if you can</li>
          <li>• Glasses off, mouth closed, looking straight ahead</li>
          <li>• Even light on both sides of your face</li>
        </ul>
        {lowRes && (
          <p role="status" className="rounded-[var(--radius-md)] bg-demo-soft p-3 text-sm text-demo">
            You&apos;ve zoomed in past the photo&apos;s detail. The analysis may be less reliable — zoom out a little or use a sharper photo.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirm} loading={busy}>
            Analyse this photo
          </Button>
          {onRetake && (
            <Button variant="secondary" onClick={onRetake}>
              Retake photo
            </Button>
          )}
          <Button variant="secondary" onClick={onBack}>
            Choose another photo
          </Button>
        </div>
      </div>
    </div>
  );
}

const RING_BUTTON = "inline-flex h-10 items-center justify-center rounded-full ring-1 ring-line-strong hover:bg-sunken";
const MOVE_BUTTON = `${RING_BUTTON} w-10`;
const MOVES = [
  { label: "Move photo left", Icon: ArrowLeft, dx: -STEP, dy: 0 },
  { label: "Move photo up", Icon: ArrowUp, dx: 0, dy: -STEP },
  { label: "Move photo down", Icon: ArrowDown, dx: 0, dy: STEP },
  { label: "Move photo right", Icon: ArrowRight, dx: STEP, dy: 0 },
];
