import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { expectNoSeriousA11yViolations } from "./helpers/a11y";

const portrait = path.join(__dirname, "fixtures", "synthetic-portrait.png");
// A scan failure replaces the step: its heading takes focus (and is not also an alert, so it's read once).
const stepFailure = (page: Page) => page.locator(":focus");


test("focus picker shows what would count as a change and flags ceiling focuses", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/results\?scan=/);

  const hydration = page.locator("label", { has: page.getByRole("radio", { name: /Look more hydrated/ }) });
  await expect(hydration).toContainText("75 or higher counts as up · 63 or lower as down");

  // Sample redness is 99 with an assumed ±7 band: a gain can never register.
  const redness = page.locator("label", { has: page.getByRole("radio", { name: /Calm visible redness/ }) });
  await expect(redness).toContainText("Can't show gains");
  await expect(redness).toContainText("band assumed");

  // Testable focuses are listed before ceiling ones.
  const labels = await page.locator("fieldset label").allInnerTexts();
  const firstCeiling = labels.findIndex((t) => t.includes("Can't show gains"));
  expect(labels.slice(0, firstCeiling).every((t) => t.includes("counts as up"))).toBe(true);

  await page.getByRole("radio", { name: /Calm visible redness/ }).check({ force: true });
  await expect(page.getByText("Redness is already at 99.")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("trial shows its pre-registered plan, and the verdict is judged against it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);

  const plan = page.getByRole("region", { name: "Decided before the check-in, not after" });
  await expect(plan).toBeVisible();
  await expect(plan).toContainText("Your fair-test plan");
  await expect(plan.getByRole("list", { name: "What the check-in score would mean" })).toContainText("63 or lower");
  await expect(plan).toContainText("64–74");
  await expect(plan).toContainText("75 or higher");
  await expect(plan).toContainText("±5 points, measured");
  await expect(plan).toContainText("(day 28)");
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  // Said in the verdict panel and again in the Result in words summary.
  await expect(page.getByRole("region", { name: /^Measured change/ }).getByText("Early look: day 21 of a planned 28-day test.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Result in words" })).toContainText("Early look: day 21 of a planned 28-day test.");
  await expect(plan).toContainText("The plan this verdict was judged against");
  // Unmeasured concerns carry the conservative band and say so.
  await expect(page.getByRole("row", { name: /Blemishes/ })).toContainText("±7, assumed");
  await expect(page.getByRole("row", { name: /Radiance/ })).toContainText("Beyond normal variation, down");
  await expect(page.getByText(/one can cross its band by chance/)).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("check-in preflight warns before any units are spent, and retaking is free", async ({ page }) => {
  // The isolated E2E backend has no YouCam key, so it can't hold a live trial. The preflight
  // response is stubbed here; its server-side logic is covered by backend/tests/test_protocol.py.
  const trialId = "e2etrial0000000000000000000000ab";
  let preflightCalls = 0;
  await page.route(`**/api/v1/trials/${trialId}/preflight`, async (route) => {
    preflightCalls += 1;
    await route.fulfill({
      json: {
        level: "poor",
        issues: ["The lighting in the two photos differs a lot, which can move scores on its own."],
        days_since_baseline: 30,
        early: false,
        planned_checkin_at: "2026-11-16T10:00:00Z",
        baseline_capture: { source: "camera", width: 720, height: 960, luminance_mean: 132 },
        candidate_capture: { source: "upload", width: 720, height: 960, luminance_mean: 75 },
        units_spent: 0,
      },
    });
  });
  let scanCalls = 0;
  await page.route("**/api/v1/scans", async (route) => {
    if (route.request().method() === "POST") scanCalls += 1;
    await route.continue();
  });

  await page.goto(`/scan?trial=${trialId}`);
  await page.getByText(/I'm 18 or over/).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="file"]').setInputFiles(portrait);
  await page.getByRole("button", { name: "Analyse this photo" }).click();

  await expect(page.getByRole("heading", { name: "Is this a fair comparison?" })).toBeVisible();
  await expect(page.getByText("This photo won't give a fair comparison.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Brightness/ })).toContainText("132 / 255");
  await expect(page.getByRole("row", { name: /Brightness/ })).toContainText("75 / 255");
  expect(preflightCalls).toBeGreaterThan(0);
  expect(scanCalls).toBe(0); // nothing sent for analysis yet
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("button", { name: "Retake in better-matched light" }).click();
  await expect(page.getByRole("button", { name: /Upload a photo JPEG/ })).toBeVisible();
  expect(scanCalls).toBe(0);

  // Choosing to analyse anyway does go to the scan endpoint (here: keyless, so it fails visibly).
  await page.locator('input[type="file"]').setInputFiles(portrait);
  await page.getByRole("button", { name: "Analyse this photo" }).click();
  await page.getByRole("button", { name: "Analyse anyway (12 units)" }).click();
  await expect(stepFailure(page)).toContainText("Live analysis isn't configured on this server.");
  expect(scanCalls).toBe(1);
});

test("instrument check replays a recorded repeat, and the verdict ends in one next step", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);

  const check = page.getByRole("region", { name: /How much does your own score move/ });
  await expect(check).toContainText("optional, before your first check-in");
  await check.getByRole("button", { name: "Run the sample instrument check (recorded, free)" }).click();

  // Recorded truth: hydration +3 on a re-analysis of the same portrait, inside ±5, so the plan doesn't move.
  const done = page.getByRole("region", { name: "Your two scans differed by 3 on hydration: your band stays ±5." });
  await expect(done).toBeVisible();
  await expect(done).toContainText("Recorded, not simulated");
  await expect(done.getByRole("row", { name: /Pores/ })).toContainText("+5");
  await expect(done.getByRole("row", { name: /Pores/ })).toContainText("Within ±7");
  await expect(page.getByRole("region", { name: "Decided before the check-in, not after" })).toContainText("±5 points, measured");
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  await expect(done).toContainText("part of the plan");
  const step = page.getByRole("region", { name: "Finish the test before deciding." });
  await expect(step).toContainText("Next step (demo)");
  await expectNoSeriousA11yViolations(page);
});
