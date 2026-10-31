import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { NEXT_STEP_COPY, OUTCOME_COPY } from "../src/lib/format";
import type { Trial } from "../src/lib/types";
import {
  announcer,
  backgroundBehind,
  contrast,
  cssColor,
  expectNoSeriousA11yViolations,
  focused,
  renderedTextContrast,
  startSampleTrial,
} from "./helpers/a11y";

/**
 * Accessibility release 1 (docs/innovation/30-A11Y-IMPLEMENTATION-PLAN.md, stages 0-1).
 * These checks cover what axe can't see: focus after in-page changes, the single announcer, server-sourced
 * result text, rendered contrast over gradients, and selected states. They don't replace screen-reader testing.
 */

const portrait = path.join(__dirname, "fixtures", "synthetic-portrait.png");
const FORBIDDEN = /\b(worked|didn't work|effective|significant|proof|proves|caused|because of the product|improved your skin)\b/i;

async function syntheticVerdict(page: Page): Promise<Trial> {
  await startSampleTrial(page);
  const response = page.waitForResponse((r) => /\/trials\/[^/]+\/demo-checkin$/.test(r.url()));
  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  return (await response).json();
}

test.describe("static routes", () => {
  for (const route of ["/scan", "/privacy", "/trials"]) {
    test(`axe WCAG 2.0-2.2 A/AA on ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  }
});

test("reflow: no route needs horizontal scrolling at 320 CSS px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sets its own 320 px viewport");
  await startSampleTrial(page);
  const trial = page.url();
  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Measured change/ })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  for (const url of ["/", "/scan", "/privacy", "/trials", trial]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});

test.describe("homepage", () => {
  test("phone previews are one short image description each, with no fake screen text", async ({ page }) => {
    await page.goto("/");
    const previews = page.locator("figure[role='img']");
    expect(await previews.count()).toBe(10);
    for (const name of await previews.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))) {
      expect(name).toMatch(/sample|synthetic|illustration/i);
      expect(name.length).toBeLessThan(110);
    }
    const tree = await page.locator("main").ariaSnapshot();
    expect(tree).not.toContain("A measured change.");
    expect(tree).not.toContain("Hydrating Milk Essence");
    expect(tree).not.toContain("Fill the oval with your face");
  });

  test("display headlines keep their contrast on the rendered background, gradients included", async ({ page }) => {
    await page.goto("/");
    const spans = page.locator("main h1 > span, main h2 > span");
    const results: string[] = [];
    for (const el of await spans.all()) {
      if (!(await el.isVisible())) continue;
      const size = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      const need = size >= 24 ? 3 : 4.5;
      const ratio = await renderedTextContrast(page, el);
      if (ratio < need) results.push(`${(await el.textContent())?.trim()}: ${ratio.toFixed(2)} < ${need}`);
    }
    const cta = page.getByRole("region", { name: "Still wondering if it's working?" }).locator("p").first();
    const ctaRatio = await renderedTextContrast(page, cta);
    if (ctaRatio < 4.5) results.push(`final CTA text: ${ctaRatio.toFixed(2)} < 4.5`);
    expect(results).toEqual([]);
  });

  test("focus rings are visible on every surface, including the strawberry footer and CTA", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab"); // keyboard modality, so programmatic focus shows :focus-visible
    const targets = [
      ["logo on the nav", page.getByRole("link", { name: "ProofLoop home" }).first()],
      ["hero link on berry", page.getByRole("link", { name: /See how it works/ })],
      ["final CTA on strawberry", page.getByRole("region", { name: "Still wondering if it's working?" }).getByRole("link", { name: /Start a fair test/ })],
      ["footer link on strawberry", page.locator("footer").getByRole("link", { name: "Start a fair test" })],
    ] as const;
    for (const [label, target] of targets) {
      await target.focus();
      expect(await target.evaluate((e) => e.matches(":focus-visible")), label).toBe(true);
      const outline = await target.evaluate((e) => {
        const s = getComputedStyle(e);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(outline.style, label).toBe("solid");
      expect(outline.width, label).toBeGreaterThanOrEqual(2);
      // Polled: under load the first read can land before styles settle; a wrong steady-state ring still fails.
      await expect
        .poll(async () => contrast(await cssColor(target, "outline-color"), await backgroundBehind(target)), { message: label, timeout: 2000 })
        .toBeGreaterThanOrEqual(3);
    }
  });
});

test.describe("scan flow focus", () => {
  test("consent asks for the box instead of hiding Continue, then each step's heading takes focus", async ({ page }) => {
    await page.goto("/scan");
    const box = page.getByRole("checkbox", { name: /18 or over/ });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(box).toBeFocused();
    await expect(box).toHaveAttribute("aria-invalid", "true");
    await expect(box).toHaveAccessibleDescription(/Tick the box/);

    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(focused(page)).toHaveText("Add your photo");
    await expect(page).toHaveTitle("Add a photo · Scan · ProofLoop");

    await page.locator('input[type="file"]').setInputFiles(portrait);
    await expect(focused(page)).toHaveText("Fill the oval with your face");
    await expect(page.getByRole("slider", { name: "Zoom" })).toHaveAttribute("aria-valuetext", /percent/);

    await page.getByRole("button", { name: "Analyse this photo" }).click();
    await expect(focused(page)).toHaveText("Live analysis isn't configured on this server.");
    await expect(page.getByRole("heading", { level: 2, name: "Live analysis isn't configured on this server." })).toBeVisible();
  });

  test("the hidden file input is not an extra tab stop", async ({ page }) => {
    await page.goto("/scan");
    await page.getByText(/I'm 18 or over/).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('input[type="file"]')).toHaveAttribute("tabindex", "-1");
  });
});

test.describe("route changes", () => {
  test("a fresh page load leaves focus alone and the skip link first", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await expect(page.locator("h1")).not.toHaveAttribute("tabindex", /.*/);
    await page.keyboard.press("Tab");
    await expect(focused(page)).toHaveText("Skip to content");
  });

  test("in-app navigation moves focus to the new page's heading", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await expect(focused(page)).toHaveText("Your skin snapshot");
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(focused(page)).toHaveText("Look more hydrated");
  });
});

test.describe("matches", () => {
  test("filter results are announced once, briefly, and the list itself is not a live region", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(page.getByText("6 products")).toBeVisible();
    await expect(page.locator("main [aria-live]")).toHaveCount(0);
    await page.getByText("Fragrance-free only").click();
    await expect(announcer(page)).toHaveText("5 products match. 1 set aside by your filters.");
  });

  test("the selected filter is visible: 3:1 against its track and marked with a check", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("button", { name: "See matching products" }).click();
    const budget = page.getByRole("group", { name: "Budget" });
    const selected = budget.locator("label", { has: page.locator("input:checked") });
    expect(contrast(await backgroundBehind(selected, true), await backgroundBehind(selected))).toBeGreaterThanOrEqual(3);
    await expect(selected.locator("svg")).toBeVisible();
    await expect(budget.locator("label", { has: page.locator("input:not(:checked)") }).locator("svg")).toHaveCount(0);

    const track = page.locator('label:has(input[role="switch"]) > span[aria-hidden]');
    expect(contrast(await cssColor(track, "border-top-color"), await backgroundBehind(track))).toBeGreaterThanOrEqual(3);
  });

  test("forced colours: selection, toggles and cards keep a visible boundary", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    const card = page.locator("label", { has: page.getByRole("radio", { checked: true }) });
    await page.emulateMedia({ forcedColors: "active" });
    const dot = card.locator("[data-selected-mark]");
    await expect(dot).toBeVisible();
    expect(await dot.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    expect(await card.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("solid");

    await page.getByRole("button", { name: "See matching products" }).click();
    const selected = page.getByRole("group", { name: "Budget" }).locator("label", { has: page.locator("input:checked") });
    await expect(selected.locator("svg")).toBeVisible();
    expect(await selected.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("solid");
    const track = page.locator('label:has(input[role="switch"]) > span[aria-hidden]');
    expect(await track.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("solid");
  });
});

test.describe("trial", () => {
  test("the synthetic follow-up moves focus to the verdict, and Result in words repeats the server", async ({ page }) => {
    const trial = await syntheticVerdict(page);
    const c = trial.comparison!;
    const focus = c.changes.find((x) => x.metric === c.focus_metric)!;
    await expect(focused(page)).toHaveText(OUTCOME_COPY[c.focus_outcome].headline);
    // VoiceOver read "No clear change yet. No clear change yet. region" when the focused heading also named its
    // section: the verdict must not be a region named by its own headline.
    await expect(page.getByRole("region", { name: OUTCOME_COPY[c.focus_outcome].headline })).toHaveCount(0);
    await expect(page).toHaveTitle(`${OUTCOME_COPY[c.focus_outcome].headline.replace(/\.$/, "")} · ${trial.goal.label} · ProofLoop`);
    const words = page.getByRole("region", { name: "Result in words" });
    await expect(words).toContainText(`${focus.baseline}`);
    await expect(words).toContainText(`${focus.current}`);
    await expect(words).toContainText(`${focus.delta! > 0 ? "+" : ""}${focus.delta}`);
    await expect(words).toContainText(`±${focus.noise_band}`);
    await expect(words).toContainText(NEXT_STEP_COPY[c.next_step.action].title);
    await expect(words).toContainText("Synthetic demo, not a measurement");
    expect(await words.textContent()).not.toMatch(FORBIDDEN);
    await expectNoSeriousA11yViolations(page);
  });

  test("Result in words follows the server for every outcome, even when the numbers would suggest otherwise", async ({ page }) => {
    const real = await syntheticVerdict(page);
    const focusOf = (t: Trial) => t.comparison!.changes.find((x) => x.metric === t.comparison!.focus_metric)!;
    const scenarios: { name: string; edit: (t: Trial) => void; must: string[]; mustNot: string[] }[] = [
      {
        name: "no clear change although the delta is large",
        edit: (t) => Object.assign(t.comparison!, { focus_outcome: "no_clear_change", early: false, next_step: { ...t.comparison!.next_step, action: "consider_switching" } }),
        must: [OUTCOME_COPY.no_clear_change.headline, NEXT_STEP_COPY.consider_switching.title],
        mustNot: ["Measured change", "beyond normal variation"],
      },
      {
        name: "inconclusive",
        edit: (t) =>
          Object.assign(t.comparison!, {
            focus_outcome: "inconclusive",
            early: false,
            comparability: { ...t.comparison!.comparability, level: "poor", issues: ["The lighting in the two photos differs a lot, which can move scores on its own."] },
            next_step: { ...t.comparison!.next_step, action: "retake" },
          }),
        must: [OUTCOME_COPY.inconclusive.headline, "don't count as a result", "Not comparable", NEXT_STEP_COPY.retake.title],
        mustNot: ["a change of"],
      },
      {
        name: "insufficient data",
        edit: (t) => {
          Object.assign(focusOf(t), { current: null, delta: null, verdict: "missing" });
          Object.assign(t.comparison!, { focus_outcome: "insufficient_data", early: false, next_step: { ...t.comparison!.next_step, action: "retake" } });
        },
        must: [OUTCOME_COPY.insufficient_data.headline, NEXT_STEP_COPY.retake.title],
        mustNot: ["a change of"],
      },
      {
        name: "early look",
        edit: (t) => Object.assign(t.comparison!, { focus_outcome: "measured_improvement", early: true, next_step: { ...t.comparison!.next_step, action: "finish_the_test" } }),
        must: ["Early look", OUTCOME_COPY.measured_improvement.headline, NEXT_STEP_COPY.finish_the_test.title],
        mustNot: [],
      },
      {
        name: "a one-point change",
        edit: (t) => {
          const f = focusOf(t);
          Object.assign(f, { current: f.baseline! + 1, delta: 1, verdict: "within_variation" });
          Object.assign(t.comparison!, { focus_outcome: "no_clear_change", early: false, next_step: { ...t.comparison!.next_step, action: "consider_switching" } });
        },
        must: ["a change of +1 point."],
        mustNot: ["1 points"],
      },
      {
        name: "measured decline",
        edit: (t) => {
          const f = focusOf(t);
          Object.assign(f, { current: f.baseline! - 8, delta: -8, verdict: "worse" });
          Object.assign(t.comparison!, { focus_outcome: "measured_decline", early: false, next_step: { ...t.comparison!.next_step, action: "pause_and_review" } });
        },
        must: [OUTCOME_COPY.measured_decline.headline, "-8", NEXT_STEP_COPY.pause_and_review.title],
        mustNot: [],
      },
    ];
    for (const s of scenarios) {
      const edited: Trial = structuredClone(real);
      s.edit(edited);
      await page.unroute(/\/api\/v1\/trials\/[^/?]+$/);
      await page.route(/\/api\/v1\/trials\/[^/?]+$/, (route) =>
        route.request().method() === "GET" ? route.fulfill({ json: edited }) : route.continue(),
      );
      await page.reload();
      const verdict = page.locator("section:has(#verdict)");
      await expect(page.locator("#verdict"), s.name).toHaveText(OUTCOME_COPY[edited.comparison!.focus_outcome].headline);
      await expect(verdict, s.name).toBeVisible();
      const words = page.getByRole("region", { name: "Result in words" });
      for (const text of s.must) await expect(words, `${s.name}: ${text}`).toContainText(text);
      const all = `${await words.textContent()} ${await verdict.textContent()}`;
      for (const text of s.mustNot) expect(all, `${s.name}: must not say ${text}`).not.toContain(text);
      expect(await words.textContent(), s.name).not.toMatch(FORBIDDEN);
    }
  });

  test("the sample instrument check moves focus to its result", async ({ page }) => {
    await startSampleTrial(page);
    await page.getByRole("button", { name: /Run the sample instrument check/ }).click();
    await expect(focused(page)).toHaveText(/Your two scans differed by/);
    // Same structure that made VoiceOver read the verdict twice: the focused heading must not also name its section.
    const heading = (await focused(page).textContent())!.trim();
    await expect(page.getByRole("region", { name: heading })).toHaveCount(0);
  });

  test("a check still being measured offers Check again and announces the outcome", async ({ page }) => {
    await startSampleTrial(page);
    await page.route(/\/api\/v1\/trials\/[^/?]+$/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const t: Trial = await (await route.fetch()).json();
      t.protocol.instrument_check.status = "processing";
      await route.fulfill({ json: t });
    });
    await page.reload();
    await page.getByRole("button", { name: "Check again" }).click();
    await expect(announcer(page)).toHaveText(/Still being measured/);
  });

  test("assistant: focus stays on the pressed question and the answer is announced once", async ({ page }) => {
    await startSampleTrial(page);
    const button = page.getByRole("button", { name: "Is it working?" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(announcer(page)).toContainText("From your plan · no AI");
    await expect(button).toBeFocused();
    await expect(page.getByRole("region", { name: "Ask about this trial" }).locator("[aria-live]")).toHaveCount(0);
  });
});

test("delete all: focus goes to the confirmation, back on cancel, then to the result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/results/);
  await page.goto("/trials");
  const start = page.getByRole("button", { name: "Delete all my data" });
  await start.click();
  const confirm = page.getByRole("button", { name: "Yes, delete everything" });
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveAccessibleDescription(/can't be undone/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(start).toBeFocused();
  await start.click();
  await confirm.click();
  await expect(focused(page)).toHaveText("Everything was deleted.");
});
