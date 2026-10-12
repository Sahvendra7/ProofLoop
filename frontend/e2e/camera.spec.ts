import { expect, test, type Page } from "@playwright/test";

/**
 * Camera path with Chrome's fake capture device (a synthetic test pattern, no real camera).
 * This proves the permission → preview → capture → frame → retake → upload wiring; it does
 * NOT replace a test on a physical phone (see docs/final-audit.md).
 */
test.use({
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Records every stream the page opens so tests can check the camera was actually released. */
async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] };
    w.__streams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await original(c);
      w.__streams.push(s);
      return s;
    };
  });
}

const liveTracks = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length,
  );

async function openChooser(page: Page) {
  await page.goto("/scan");
  await page.getByText(/I'm 18 or over/).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("camera: preview, capture, retake, then upload reaches the API", async ({ page }) => {
  await trackStreams(page);
  await openChooser(page);
  await page.getByRole("button", { name: /Take a photo/ }).click();

  const capture = page.getByRole("button", { name: "Capture" });
  await expect(capture).toBeEnabled({ timeout: 15_000 });
  const size = await page.getByLabel("Camera preview").evaluate((v: HTMLVideoElement) => [v.videoWidth, v.videoHeight]);
  expect(Math.min(...size)).toBeGreaterThanOrEqual(240);

  await capture.click();
  await expect(page.getByRole("heading", { name: "Fill the oval with your face" })).toBeVisible();
  // The stream is released once a frame is captured.
  await expect(page.getByLabel("Camera preview")).toHaveCount(0);
  expect(await liveTracks(page)).toBe(0);

  await page.getByRole("button", { name: "Retake photo" }).click();
  await expect(page.getByRole("button", { name: "Capture" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Capture" }).click();

  expect(await liveTracks(page)).toBe(0);
  await page.getByRole("button", { name: "Analyse this photo" }).click();
  // The E2E backend has no YouCam key: reaching this message means the captured JPEG was uploaded and handled.
  await expect(appAlert(page)).toContainText("Live analysis isn't configured on this server.", { timeout: 15_000 });
});

test("camera: cancel releases the camera and returns to the chooser", async ({ page }) => {
  await trackStreams(page);
  await openChooser(page);
  await page.getByRole("button", { name: /Take a photo/ }).click();
  await expect(page.getByRole("button", { name: "Capture" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Cancel camera" }).click();
  await expect(page.getByRole("button", { name: /Upload a photo JPEG/ })).toBeVisible();
  expect(await liveTracks(page)).toBe(0);
});

for (const [name, title] of [
  ["NotAllowedError", "Camera access was blocked."],
  ["NotFoundError", "We couldn't find a front camera."],
  ["NotReadableError", "Your camera is busy."],
] as const) {
  test(`camera: ${name} shows a specific message and an upload fallback`, async ({ page }) => {
    await page.addInitScript((errName) => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("stubbed", errName));
    }, name);
    await openChooser(page);
    await page.getByRole("button", { name: /Take a photo/ }).click();
    await expect(appAlert(page)).toContainText(title);
    await expect(page.getByRole("button", { name: "Choose another photo" })).toBeVisible();
  });
}

test("camera: plain-http pages explain that https is required", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { value: false });
    Object.defineProperty(navigator, "mediaDevices", { value: undefined });
  });
  await openChooser(page);
  await page.getByRole("button", { name: /Take a photo/ }).click();
  await expect(appAlert(page)).toContainText("The camera needs a secure (https) connection.");
});
