/**
 * Values shown in marketing previews. They are NOT invented:
 * - SAMPLE_SCORES mirror backend/app/data/demo_fixture.json, a recorded YouCam
 *   Skin Analysis response (2026-10-11) that the app's "sample data" mode replays.
 * - SYNTHETIC_FOLLOWUP mirrors DEMO_FOLLOWUP_DELTAS in backend/app/services/demo.py.
 * - NOISE_BANDS mirror backend/app/domain/compare.py.
 * Every preview using them carries a visible "Sample data" or "Synthetic demo" label.
 */
export const SAMPLE_SCORES = [
  { key: "moisture", label: "Hydration", score: 69 },
  { key: "oiliness", label: "Oil balance", score: 99 },
  { key: "redness", label: "Redness", score: 99 },
  { key: "texture", label: "Texture", score: 88 },
  { key: "pore", label: "Pores", score: 79 },
  { key: "acne", label: "Blemishes", score: 99 },
  { key: "radiance", label: "Radiance", score: 82 },
  { key: "dark_circle", label: "Under-eye", score: 68 },
] as const;

export const NOISE_BANDS: Record<string, number> = {
  moisture: 5,
  oiliness: 7, // assumed: widest measured band
  redness: 7, // assumed
  texture: 7,
  pore: 7,
  acne: 7, // assumed
  radiance: 3,
  dark_circle: 3,
};

export const SYNTHETIC_FOLLOWUP: Record<string, number> = {
  moisture: 77,
  oiliness: 100,
  redness: 98,
  texture: 93,
  pore: 79,
  acne: 94,
  radiance: 77,
  dark_circle: 69,
};

export const CONCERNS = SAMPLE_SCORES.map((s) => s.label);
