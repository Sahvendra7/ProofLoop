"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ClipboardCheck, MessageCircleQuestion, Square, Volume2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_INTENTS,
  EXPLANATION_LABELS,
  FALLBACK_REASONS,
  SOURCE_LABELS,
  TOOL_DESCRIPTIONS,
} from "@/lib/format";
import type { AssistantAction, AssistantConfig, AssistantIntent, AssistantReply, Trial } from "@/lib/types";
import { useAnnounce } from "@/components/announcer";
import { Button, ButtonLink, CapsText } from "@/components/ui";
import { focusWhenRendered } from "@/lib/focus";

const CONSENT_KEY = "proofloop.assistant.consent";
const INTENTS: AssistantIntent[] = ["is_it_working", "when_check_in", "should_switch"];

type Entry = { question: string; answer: AssistantReply };

// The speech engine is shared by the whole page: starting one answer resets the button of whichever was reading.
let releaseReader: (() => void) | null = null;

function readConsent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? "null")?.version ?? null;
  } catch {
    return null;
  }
}

// The prototype owner's key, for this tab only. The server checks it on every typed question.
const OWNER_KEY = "proofloop.assistant.owner";

function readOwnerKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwnerKey(key: string | null) {
  try {
    if (key) window.sessionStorage.setItem(OWNER_KEY, key);
    else window.sessionStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked: the key then lasts for this page only.
  }
}

function writeConsent(version: string | null) {
  try {
    if (version) window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ version }));
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Storage blocked: consent then lasts for this page only.
  }
}

/** Read-only questions about this trial. Answers come from the trial's own numbers; actions are buttons the user clicks. */
export function AssistantPanel({ trial, onUpdate }: { trial: Trial; onUpdate: (t: Trial) => void }) {
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // The panel only renders after the trial loads in the browser, so reading storage here is safe.
  const [consented, setConsented] = useState<string | null>(() => readConsent());
  const [adult, setAdult] = useState(false);
  const [region, setRegion] = useState(false);
  const [canSpeak] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [ownerKey, setOwnerKey] = useState<string | null>(() => readOwnerKey());
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [checkingOwner, setCheckingOwner] = useState(false);
  const inFlight = useRef(false);
  const announce = useAnnounce();

  useEffect(() => {
    let live = true;
    api.assistantConfig().then(
      (c) => live && setConfig(c),
      () => live && setConfig(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const freeText = config?.free_text_available === true;
  const hasConsent = freeText && consented === config?.consent_version;

  async function run(question: string, call: () => Promise<AssistantReply>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    announce("Checking your plan…");
    try {
      const answer = await call();
      setEntries((prev) => [...prev, { question, answer }]);
      announce(announcement(answer));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't get an answer. Try again.");
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function confirm(nextAdult: boolean, nextRegion: boolean) {
    setAdult(nextAdult);
    setRegion(nextRegion);
    if (nextAdult && nextRegion && config) {
      writeConsent(config.consent_version);
      setConsented(config.consent_version);
    }
  }

  function withdraw() {
    writeConsent(null);
    setConsented(null);
    setAdult(false);
    setRegion(false);
    // The "Stop using Gemini" button disappears with consent; the first consent box takes focus.
    focusWhenRendered("assistant-adult");
  }

  async function unlock(e: FormEvent) {
    e.preventDefault();
    const key = ownerInput.trim();
    if (!key || checkingOwner) return;
    setCheckingOwner(true);
    setOwnerError(null);
    try {
      if (await api.assistantOwnerCheck(key)) {
        writeOwnerKey(key);
        setOwnerKey(key);
        setOwnerInput("");
        focusWhenRendered("assistant-adult");
      } else {
        setOwnerError("That key isn't valid.");
      }
    } catch (err) {
      setOwnerError(err instanceof ApiError ? err.message : "Couldn't check the key. Try again.");
    } finally {
      setCheckingOwner(false);
    }
  }

  function lock() {
    writeOwnerKey(null);
    setOwnerKey(null);
    focusWhenRendered("assistant-owner-key");
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || !hasConsent || !config || !ownerKey) return;
    const ok = await run(text, () =>
      api
        .assistantAsk(trial.id, text, { version: config.consent_version, adult: true, region_ok: true }, ownerKey)
        .catch((err) => {
          if (err instanceof ApiError && err.code === "owner_auth_required") lock();
          throw err;
        }),
    );
    if (ok) setMessage("");
  }

  return (
    <section aria-labelledby="assistant-title" className="mt-8 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-8">
      <p className="eyebrow inline-flex items-center gap-2">
        <MessageCircleQuestion aria-hidden className="size-4" /> <CapsText>Read-only · answers from your plan</CapsText>
      </p>
      <h2 id="assistant-title" className="mt-2 font-display text-2xl text-ink">Ask about this trial</h2>

      <div className="mt-5 flex flex-wrap gap-2">
        {INTENTS.map((intent) => (
          <Button
            key={intent}
            variant="secondary"
            size="sm"
            softDisabled={pending}
            onClick={() => run(ASSISTANT_INTENTS[intent], () => api.assistantQuick(trial.id, intent))}
          >
            {ASSISTANT_INTENTS[intent]}
          </Button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-worse">{error}</p>}

      {entries.length > 0 && (
        <ol className="mt-6 space-y-5 border-t border-line pt-5">
          {entries.map((entry, i) => (
            <AnswerItem key={i} entry={entry} trial={trial} onUpdate={onUpdate} canSpeak={canSpeak} />
          ))}
        </ol>
      )}

      {freeText && !ownerKey && (
        <form onSubmit={unlock} className="mt-6 border-t border-line pt-5">
          <p className="text-sm leading-relaxed text-ink-2">
            Typed questions use Google&apos;s Gemini and are limited to this prototype&apos;s owner. The quick questions above
            work for everyone.
          </p>
          <label htmlFor="assistant-owner-key" className="mt-3 block text-sm font-semibold text-ink">
            Owner access key
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="assistant-owner-key"
              type="password"
              autoComplete="off"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              aria-describedby={ownerError ? "assistant-owner-error" : undefined}
              className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-ink ring-1 ring-line-strong"
            />
            <Button type="submit" variant="secondary" softDisabled={!ownerInput.trim()} loading={checkingOwner}>
              Unlock typed questions
            </Button>
          </div>
          {ownerError && (
            <p id="assistant-owner-error" role="alert" className="mt-2 text-sm text-worse">
              {ownerError}
            </p>
          )}
        </form>
      )}

      {freeText && ownerKey && (
        <form onSubmit={ask} className="mt-6 border-t border-line pt-5">
          {/* Kept on screen after consenting this visit, so focus never vanishes from under the checkbox. */}
          {(!hasConsent || (adult && region)) && (
            <fieldset className="mb-4 rounded-[var(--radius-md)] bg-sunken p-4 text-sm leading-relaxed text-ink-2">
              <legend className="sr-only">Before you type a question</legend>
              <p>
                Typed questions are sent to Google&apos;s Gemini API (free tier). Google may store them, use them to improve its
                products, and have people review them. Don&apos;t include personal or health details. Photos are never sent. This
                is not medical advice.
              </p>
              <label className="mt-3 flex items-center gap-2">
                <input id="assistant-adult" type="checkbox" checked={adult} onChange={(e) => confirm(e.target.checked, region)} className="size-4" />
                I&apos;m 18 or older
              </label>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={region} onChange={(e) => confirm(adult, e.target.checked)} className="size-4" />
                I&apos;m not in the EEA, UK or Switzerland
              </label>
            </fieldset>
          )}
          <label htmlFor="assistant-message" className="block text-sm font-semibold text-ink">
            Ask in your own words <span className="font-normal text-ink-3">(Gemini picks from approved explanations)</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="assistant-message"
              type="text"
              value={message}
              maxLength={config?.max_message_chars ?? 500}
              disabled={!hasConsent}
              onChange={(e) => setMessage(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-ink ring-1 ring-line-strong disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button type="submit" disabled={!hasConsent} softDisabled={!message.trim()} loading={pending}>
              Ask
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {hasConsent && (
              <button type="button" onClick={withdraw} className="text-sm text-ink-3 underline underline-offset-4">
                Stop using Gemini
              </button>
            )}
            <button type="button" onClick={lock} className="text-sm text-ink-3 underline underline-offset-4">
              Lock typed questions
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function announcement(a: AssistantReply): string {
  const parts = [a.reply, `${SOURCE_LABELS[a.mode]}.`];
  for (const e of a.explanations) parts.push(`${e.title}. ${e.text}`);
  if (a.explanations.length > 0) parts.push(`${EXPLANATION_LABELS[a.mode]}.`);
  if (a.fallback_reason) parts.push(FALLBACK_REASONS[a.fallback_reason]);
  return parts.join(" ");
}

function AnswerItem({
  entry,
  trial,
  onUpdate,
  canSpeak,
}: {
  entry: Entry;
  trial: Trial;
  onUpdate: (t: Trial) => void;
  canSpeak: boolean;
}) {
  const { answer } = entry;
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (utterance.current) {
        releaseReader = null;
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  function release() {
    utterance.current = null;
    setSpeaking(false);
    if (releaseReader === release) releaseReader = null;
  }

  function toggleSpeech() {
    const wasSpeaking = utterance.current !== null;
    releaseReader?.();
    window.speechSynthesis.cancel();
    if (wasSpeaking) return;
    const u = new SpeechSynthesisUtterance([answer.reply, ...answer.explanations.map((e) => `${e.title}. ${e.text}`)].join(" "));
    // Not every browser fires "end" after cancel(), so release() is also called directly above.
    u.onend = u.onerror = () => {
      if (utterance.current === u) release();
    };
    utterance.current = u;
    releaseReader = release;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  return (
    <li>
      <p className="text-sm font-semibold text-ink-3">{entry.question}</p>
      <p className="mt-1 max-w-3xl leading-relaxed text-ink">{answer.reply}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        <ClipboardCheck aria-hidden className="size-3.5" /> {SOURCE_LABELS[answer.mode]}
      </p>
      {answer.fallback_reason && <p className="mt-1 text-xs text-ink-3">{FALLBACK_REASONS[answer.fallback_reason]}</p>}
      {answer.explanations.length > 0 && (
        <div className="mt-3 max-w-3xl space-y-2">
          {answer.explanations.map((e) => (
            <figure key={e.id} aria-label={e.title} className="rounded-[var(--radius-md)] bg-sunken p-4">
              <p className="text-sm font-semibold text-ink">{e.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{e.text}</p>
            </figure>
          ))}
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            {answer.mode === "gemini" ? <Bot aria-hidden className="size-3.5" /> : <ClipboardCheck aria-hidden className="size-3.5" />}
            {EXPLANATION_LABELS[answer.mode]}
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {answer.action?.available && answer.action.code !== "none" && (
          <ActionButton code={answer.action.code} trial={trial} onUpdate={onUpdate} />
        )}
        {canSpeak && (
          <Button variant="ghost" size="sm" onClick={toggleSpeech}>
            {speaking ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
            {speaking ? "Stop reading" : "Read aloud"}
          </Button>
        )}
      </div>
      {answer.trace.length > 0 && (
        <details className="mt-2 text-sm text-ink-2">
          <summary className="cursor-pointer text-ink-3">What I checked ({answer.trace.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {answer.trace.map((step, i) => (
              <li key={i}>{TOOL_DESCRIPTIONS[step.tool] ?? step.tool}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** Allowlisted codes map to existing routes and handlers here; nothing in the reply text is ever a link. */
function ActionButton({ code, trial, onUpdate }: { code: Exclude<AssistantAction, "none">; trial: Trial; onUpdate: (t: Trial) => void }) {
  const [busy, setBusy] = useState(false);
  const label = ASSISTANT_ACTIONS[code];
  if (code === "run_sample_checkin") {
    return (
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            onUpdate(await api.demoCheckin(trial.id));
            focusWhenRendered("verdict");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
    );
  }
  const href = {
    open_checkin: `/scan?trial=${trial.id}`,
    open_instrument_check: `/scan?trial=${trial.id}&repeat=1`,
    open_matches: `/matches?scan=${trial.baseline.id}&goal=${trial.goal.key}`,
  }[code];
  return (
    <ButtonLink href={href} size="sm" variant="secondary">
      {label}
    </ButtonLink>
  );
}
