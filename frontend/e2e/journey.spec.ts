import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const portrait = path.join(__dirname, "fixtures", "synthetic-portrait.png");
// Next.js renders its own empty role="alert" route announcer; target ours.
const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
}

/** Returns text inside each variation dial that overlaps a tick, needle or hub (should be none). */
async function dialTextCollisions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg[viewBox="0 0 200 172"]')].flatMap((svg) => {
      const marks = [...svg.querySelectorAll("line, circle")].map((m) => m.getBoundingClientRect());
      return [...svg.parentElement!.querySelectorAll("p")].flatMap((p) => {
        const range = document.createRange();
        range.selectNodeContents(p);
        const r = range.getBoundingClientRect();
        return marks.some((m) => m.left < r.right && m.right > r.left && m.top < r.bottom && m.bottom > r.top) ? [p.textContent] : [];
      });
    }),
  );
}

test("sample-data journey: snapshot → matches → product → trial → labelled synthetic verdict", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Is it working?");
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/results\?scan=/);
  await expect(page.getByRole("heading", { name: "Your skin snapshot" })).toBeVisible();
  await expect(page.getByText("Sample data").first()).toBeVisible();
  await expect(page.getByText("No provider call is made")).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true }); // visually hidden input inside a styled label
  await page.getByRole("button", { name: "See matching products" }).click();
  await expect(page).toHaveURL(/\/matches\?scan=.+&goal=hydration/);
  await expect(page.getByRole("heading", { name: "Look more hydrated" })).toBeVisible();
  await expect(page.getByText("6 products")).toBeVisible();

  await page.getByText("Fragrance-free only").click();
  await expect(page.getByText("5 products")).toBeVisible();
  await expect(page.getByText("Set aside by your filters (1)")).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await expect(page).toHaveURL(/\/product\?id=/);
  await expect(page.getByText("Product facts · from the catalogue")).toBeVisible();
  await expect(page.getByText("Match logic · from your scan")).toBeVisible();
  // Hydration is not a YouCam Skin Simulation concern: no fake preview.
  await expect(page.getByText(/doesn't support hydration/)).toBeVisible();

  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);
  await expect(page.getByText("Baseline saved")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check in now" })).toHaveCount(0); // demo trials can't take live check-ins

  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  await expect(page.getByText("Synthetic follow-up — not a measurement")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Measured change: up, beyond normal variation." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+8", exact: true })).toBeVisible();
  // Regression: the dial readout and the band chart's labels must not collide with the graphics.
  expect(await dialTextCollisions(page)).toEqual([]);
  await expect(page.getByText("Normal variation ±5", { exact: true }).first()).toBeVisible();
  const clippedAxisLabels = await page.locator("figure svg:visible text").evaluateAll((texts) =>
    texts.filter((t) => {
      const svg = t.closest("svg")!.getBoundingClientRect();
      const r = t.getBoundingClientRect();
      return r.left < svg.left - 1 || r.right > svg.right + 1;
    }).length,
  );
  expect(clippedAxisLabels).toBe(0);
  const overlappingChartText = await page.locator("figure svg:visible").first().evaluate((svg) => {
    const rects = [...svg.querySelectorAll("text")].map((t) => t.getBoundingClientRect());
    let n = 0;
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top ? n++ : 0)));
    return n;
  });
  expect(overlappingChartText).toBe(0);
  // Regression: the screen-reader table under the chart once widened the whole page on phones.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.getByText("Beyond normal variation, down").first()).toBeVisible(); // the demo includes a decline
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("link", { name: "My trials" }).first().click();
  await expect(page.getByText(/Look more hydrated · /)).toBeVisible();
});

test("live scan without a configured provider fails visibly and offers sample data", async ({ page }) => {
  await page.goto("/scan");
  await expect(page.getByRole("heading", { name: "Before you take a photo" })).toBeVisible();
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeDisabled();
  await page.getByText(/I'm 18 or over/).click();
  await continueButton.click();

  await page.locator('input[type="file"]').setInputFiles(portrait);
  await expect(page.getByRole("heading", { name: "Fill the oval with your face" })).toBeVisible();
  await page.getByRole("button", { name: "Analyse this photo" }).click();

  await expect(appAlert(page)).toContainText("Live analysis isn't configured on this server.");
  await expect(page.getByRole("button", { name: "Adjust and retry" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try with sample data" })).toBeVisible();
});

test("client-side validation rejects a photo that is too small before any upload", async ({ page }) => {
  await page.goto("/scan");
  await page.getByText(/I'm 18 or over/).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const tiny = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: tiny });
  await expect(appAlert(page)).toContainText("That photo is too small.");
});

test("homepage: verdict tabs, step links and CTAs use real routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Run a fair test.");

  // Hero photo: served from our own origin, loaded, and credited as editorial (not a user or result).
  const hero = page.getByRole("img", { name: /checking the skin under her eyes/ });
  await expect(hero).toBeVisible();
  expect(await hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && new URL(img.currentSrc).origin === location.origin)).toBe(true);
  await expect(page.getByText("Not a ProofLoop user or result.")).toBeVisible();
  expect(await dialTextCollisions(page)).toEqual([]);

  // Verdict explorer: arrow keys move between the three outcomes; no outcome is pre-selected as "good".
  const noChange = page.getByRole("tab", { name: "No clear change" });
  await expect(noChange).toHaveAttribute("aria-selected", "true");
  await noChange.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Inconclusive" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("We can't call this one.");

  // The problem rail is a keyboard-scrollable region.
  await expect(page.getByRole("region", { name: /Why the mirror can't tell you/ })).toHaveAttribute("tabindex", "0");

  // Every "Start a fair test" link goes to the real scan flow.
  const starts = page.getByRole("link", { name: "Start a fair test" });
  const hrefs = await starts.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(2);
  expect(new Set(hrefs)).toEqual(new Set(["/scan"]));

  // Step bar anchors resolve to real sections.
  for (const id of ["step-measure", "step-focus", "step-product", "step-baseline", "step-checkin", "step-verdict"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test("keyboard: skip link and primary actions are reachable", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("unknown routes show a helpful 404", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page isn't here." })).toBeVisible();
});

test("privacy: delete everything removes trials from the server", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/results\?scan=/);
  const token = await page.evaluate(() => localStorage.getItem("pl:session"));
  expect(token).toBeTruthy();

  await page.goto("/trials");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page.getByText("Everything was deleted.")).toBeVisible();
  // The view may open a fresh, empty session afterwards; it must never be the deleted one.
  expect(await page.evaluate(() => localStorage.getItem("pl:session"))).not.toBe(token);
  await expect(page.getByText("No trials yet.", { exact: false })).toBeVisible();

  // The old token no longer opens anything on the server.
  const res = await page.request.get("http://localhost:8100/api/v1/scans", { headers: { "X-Session-Token": token! } });
  expect(res.status()).toBe(401);
  await expectNoSeriousA11yViolations(page);
});
