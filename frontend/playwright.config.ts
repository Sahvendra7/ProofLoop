import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * End-to-end suite. It starts its OWN backend on :8100 with no YouCam key and a
 * throwaway database, and its own production build of the frontend on :3100,
 * so it can never spend API units or touch development data.
 */
const backendDir = path.resolve(__dirname, "../backend");
const e2eDb = path.resolve(__dirname, ".e2e-proofloop.db");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    // Deterministic screens for assertions and axe (our CSS shortens animations under reduced motion).
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: [
    {
      command: `rm -f ${e2eDb} && ${backendDir}/venv/bin/uvicorn app.main:app --app-dir ${backendDir} --port 8100`,
      url: "http://localhost:8100/health",
      reuseExistingServer: false,
      env: {
        YOUCAM_API_KEY: "",
        DATABASE_URL: `sqlite:///${e2eDb}`,
        CORS_ORIGINS: "http://localhost:3100",
        LOG_LEVEL: "WARNING",
      },
      timeout: 60_000,
    },
    {
      command: "npx next build && npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_URL: "http://localhost:8100" },
      timeout: 180_000,
    },
  ],
});
