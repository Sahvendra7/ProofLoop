import type {
  AssistantConfig,
  AssistantConsent,
  AssistantIntent,
  AssistantReply,
  FocusPlan,
  Goal,
  Preflight,
  Profile,
  ProfileIn,
  Product,
  RecommendationFilters,
  Recommendations,
  Scan,
  SelfReport,
  Simulation,
  SystemStatus,
  Trial,
  TrialSummary,
} from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "") + "/api/v1";
const TOKEN_KEY = "pl:session";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly hint: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode): the session lives for this page only
  }
}

let memoryToken: string | null = null;
let pendingSession: Promise<string> | null = null;

async function ensureSession(): Promise<string> {
  const existing = memoryToken ?? readToken();
  if (existing) return existing;
  pendingSession ??= (async () => {
    const res = await fetch(`${API_BASE}/sessions`, { method: "POST" });
    if (!res.ok) throw await toError(res);
    const body = (await res.json()) as { token: string };
    memoryToken = body.token;
    writeToken(body.token);
    return body.token;
  })().finally(() => {
    pendingSession = null;
  });
  return pendingSession;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const err = body?.error;
    if (err?.code) return new ApiError(err.code, err.message, res.status, err.hint ?? null);
  } catch {
    // fall through
  }
  return new ApiError("http_error", `Request failed (${res.status}).`, res.status);
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  let token: string;
  try {
    token = await ensureSession();
  } catch (err) {
    throw err instanceof ApiError ? err : networkError();
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), "X-Session-Token": token },
    });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const err = await toError(res);
    // Only a session problem resets the session. Other 401s (the assistant's owner key) must not lose it.
    if (res.status === 401 && !retried && (err.code === "session_required" || err.code === "session_invalid")) {
      memoryToken = null;
      writeToken(null);
      return request<T>(path, init, true);
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function networkError() {
  return new ApiError(
    "network_error",
    "Can't reach the ProofLoop server.",
    0,
    "Check that the backend is running and try again.",
  );
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  status: () => request<SystemStatus>("/system/status"),
  goals: () => request<Goal[]>("/goals"),
  product: (id: string) => request<Product>(`/products/${encodeURIComponent(id)}`),

  startScan(
    image: Blob,
    opts: { source: "camera" | "upload"; idempotencyKey: string; trialId?: string; purpose?: "checkin" | "repeat_baseline" },
  ) {
    const form = new FormData();
    form.append("image", image, "capture.jpg");
    form.append("consent", "true");
    form.append("source", opts.source);
    if (opts.trialId) form.append("trial_id", opts.trialId);
    if (opts.purpose) form.append("purpose", opts.purpose);
    return request<Scan>("/scans", { method: "POST", body: form, headers: { "Idempotency-Key": opts.idempotencyKey } });
  },
  demoScan: () => request<Scan>("/scans/demo", { method: "POST" }),
  scan: (id: string) => request<Scan>(`/scans/${encodeURIComponent(id)}`),
  scans: () => request<Scan[]>("/scans"),

  recommendations(scanId: string, goal: string, filters: RecommendationFilters = {}) {
    const q = new URLSearchParams({ goal });
    if (filters.budget_max) q.set("budget_max", String(filters.budget_max));
    if (filters.fragrance_free) q.set("fragrance_free", "true");
    if (filters.finish) q.set("finish", filters.finish);
    return request<Recommendations>(`/scans/${encodeURIComponent(scanId)}/recommendations?${q}`);
  },

  /** Orders the focuses and explains them. No units, nothing stored; answers travel in the body only. */
  focusPlan: (scanId: string, body: { self_report: SelfReport | null; use_camera_reading: boolean }) =>
    request<FocusPlan>(`/scans/${encodeURIComponent(scanId)}/focus-plan`, json(body)),
  createTrial: (body: { scan_id: string; goal: string; product_id: string; profile?: ProfileIn }) =>
    request<Trial>("/trials", json(body)),
  /** Later answers are recorded beside the frozen profile; the plan never changes. */
  amendProfile: (trialId: string, body: { self_report: SelfReport | null; user_view: ProfileIn["user_view"]; expected_amendments: number }) =>
    request<Profile>(`/trials/${encodeURIComponent(trialId)}/profile`, { ...json(body), method: "PATCH" }),
  withdrawProfile: (trialId: string) =>
    request<void>(`/trials/${encodeURIComponent(trialId)}/profile`, { method: "DELETE" }),
  trial: (id: string) => request<Trial>(`/trials/${encodeURIComponent(id)}`),
  trials: () => request<TrialSummary[]>("/trials"),
  /** Free: compares a check-in photo with the baseline's conditions. No YouCam call, nothing stored. */
  preflight(trialId: string, image: Blob, source: "camera" | "upload", purpose: "checkin" | "repeat_baseline" = "checkin") {
    const form = new FormData();
    form.append("image", image, "capture.jpg");
    form.append("source", source);
    form.append("purpose", purpose);
    return request<Preflight>(`/trials/${encodeURIComponent(trialId)}/preflight`, { method: "POST", body: form });
  },
  assistantConfig: () => request<AssistantConfig>("/assistant/config"),
  /** Fixed wording from the trial's own numbers. No LLM, no units. */
  assistantQuick: (trialId: string, intent: AssistantIntent) =>
    request<AssistantReply>(`/trials/${encodeURIComponent(trialId)}/assistant/quick`, json({ intent })),
  /** Free text, limited to the prototype owner: Gemini picks approved explanations; falls back to fixed wording. */
  assistantAsk: (trialId: string, message: string, consent: AssistantConsent | null, ownerKey: string) => {
    const init = json({ message, consent });
    init.headers = { ...init.headers, Authorization: `Bearer ${ownerKey}` };
    return request<AssistantReply>(`/trials/${encodeURIComponent(trialId)}/assistant/ask`, init);
  },
  /** True when the server accepts this owner key. Checked on the server; nothing is decided in the browser. */
  assistantOwnerCheck: async (ownerKey: string) => {
    try {
      await request<void>("/assistant/owner", { method: "POST", headers: { Authorization: `Bearer ${ownerKey}` } });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "owner_auth_required") return false;
      throw err;
    }
  },
  demoCheckin: (id: string) => request<Trial>(`/trials/${encodeURIComponent(id)}/demo-checkin`, { method: "POST" }),
  /** Sample trials only: replays a recorded second analysis of the sample portrait. */
  demoRepeat: (id: string) => request<Trial>(`/trials/${encodeURIComponent(id)}/demo-repeat`, { method: "POST" }),

  simulate(image: Blob, goal: string, intensity: number) {
    const form = new FormData();
    form.append("image", image, "capture.jpg");
    form.append("goal", goal);
    form.append("intensity", String(intensity));
    form.append("consent", "true");
    return request<Simulation>("/simulations", { method: "POST", body: form });
  },

  async deleteEverything() {
    await request<void>("/sessions/me", { method: "DELETE" });
    memoryToken = null;
    writeToken(null);
  },
};

export function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
