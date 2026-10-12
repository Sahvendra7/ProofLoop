import type {
  Goal,
  Product,
  RecommendationFilters,
  Recommendations,
  Scan,
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
  if (res.status === 401 && !retried) {
    memoryToken = null;
    writeToken(null);
    return request<T>(path, init, true);
  }
  if (!res.ok) throw await toError(res);
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

  startScan(image: Blob, opts: { source: "camera" | "upload"; idempotencyKey: string; trialId?: string }) {
    const form = new FormData();
    form.append("image", image, "capture.jpg");
    form.append("consent", "true");
    form.append("source", opts.source);
    if (opts.trialId) form.append("trial_id", opts.trialId);
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

  createTrial: (body: { scan_id: string; goal: string; product_id: string }) => request<Trial>("/trials", json(body)),
  trial: (id: string) => request<Trial>(`/trials/${encodeURIComponent(id)}`),
  trials: () => request<TrialSummary[]>("/trials"),
  demoCheckin: (id: string) => request<Trial>(`/trials/${encodeURIComponent(id)}/demo-checkin`, { method: "POST" }),

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
