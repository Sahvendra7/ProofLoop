// The framed photo is kept only in this browser tab (sessionStorage) so the
// results page can overlay YouCam's masks and the product page can request a
// Skin Simulation preview. It is never stored by the ProofLoop server and is
// cleared when the tab closes or the user deletes their data.

const PREFIX = "pl:capture:";

export function saveCapture(scanId: string, dataUrl: string) {
  try {
    // Keep only the latest capture to stay well inside storage limits.
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
    sessionStorage.setItem(PREFIX + scanId, dataUrl);
  } catch {
    // quota or privacy mode: features that need the photo will say so
  }
}

export function loadCapture(scanId: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + scanId);
  } catch {
    return null;
  }
}

export function clearCaptures() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("pl:")) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
