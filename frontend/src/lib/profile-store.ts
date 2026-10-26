// The skin-profile answers are kept only in this browser tab (sessionStorage) between the snapshot and
// the product page. The server receives them only if the user chose "Save my answers with this trial",
// as part of starting that trial. Cleared with the tab or by "Delete all my data" (clearCaptures).

import type { ProfileIn } from "./types";

const PREFIX = "pl:profile:";

export interface ProfileDraft {
  profile: ProfileIn;
  save: boolean;
}

export function saveDraft(scanId: string, draft: ProfileDraft) {
  try {
    sessionStorage.setItem(PREFIX + scanId, JSON.stringify(draft));
  } catch {
    // storage unavailable: the answers apply to this page only
  }
}

export function loadDraft(scanId: string): ProfileDraft | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + scanId);
    return raw ? (JSON.parse(raw) as ProfileDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(scanId: string) {
  try {
    sessionStorage.removeItem(PREFIX + scanId);
  } catch {
    // ignore
  }
}
