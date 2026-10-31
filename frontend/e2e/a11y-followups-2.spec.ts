import { expect, test, type Page } from "@playwright/test";
import type { Trial } from "../src/lib/types";
import { expectNoSeriousA11yViolations, focused, startSampleTrial } from "./helpers/a11y";

/**
 * Accessibility follow-up after Release 1 (docs/innovation/31 §6.8): the chart's visible table, profile-form
 * announcements, large text and text spacing, and focus at 200 % and 400 % zoom. Automated evidence only; none of
 * this replaces a screen reader or a person.
 */

/** Every non-empty text the app's live region receives, in order, from the moment this is called. */
async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const el = document.getElementById("pl-announcer")!;
    new MutationObserver(() => {
      const text = el.textContent?.trim();
      if (text) w.__said.push(text);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
}

const focusOrder = (page: Page) =>
  page.locator("fieldset", { has: page.getByRole("radio", { name: /Look more hydrated/ }) }).getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("value")));

test.describe("chart: Show the numbers (A11Y-15)", () => {
  test("the visible table carries the server's values, once, with headers, and reflows at 320 px", async ({ page }, info) => {
    await startSampleTrial(page);
    const response = page.waitForResponse((r) => /\/trials\/[^/]+\/demo-checkin$/.test(r.url()));
    await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
    const trial: Trial = await (await response).json();
    const points = trial.history.filter((h) => h.focus_score !== null);
    const base = points.find((h) => h.is_baseline)!;

    const figure = page.locator("figure", { hasText: "Show the numbers" });
    // One equivalent only: the plots stay hidden from assistive technology and there is no second, hidden table.
    await expect(figure.locator("svg:not([aria-hidden])")).toHaveCount(0);
    await expect(figure.locator("table")).toHaveCount(1);
    await expect(figure.getByRole("table")).toBeHidden();

    // A native disclosure: reachable and operable from the keyboard.
    const summary = figure.locator("summary", { hasText: "Show the numbers" });
    await summary.focus();
    await page.keyboard.press("Enter");
    const table = figure.getByRole("table", { name: `${trial.goal.metric_label} scores, oldest first` });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveText(["When", "Score", "Difference from baseline"]);
    await expect(table.getByRole("rowheader")).toHaveCount(points.length);

    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(points.length);
    for (const [i, h] of points.entries()) {
      const cells = rows.nth(i).getByRole("cell");
      await expect(cells.nth(0)).toHaveText(String(h.focus_score));
      const d = h.focus_score! - base.focus_score!;
      await expect(cells.nth(1)).toHaveText(h.is_baseline ? "Baseline" : `${d > 0 ? "+" : ""}${d} ${Math.abs(d) === 1 ? "point" : "points"}`);
      // The row the verdict used comes from the server's comparison, not from the numbers.
      const compared = !h.is_baseline && h.scan_id === trial.comparison!.current_scan_id;
      await expect(rows.nth(i).getByRole("rowheader")).toContainText(compared ? "Used for the result above" : /./);
      if (!compared) await expect(rows.nth(i)).not.toContainText("Used for the result above");
    }
    await expect(figure).toContainText(`Normal variation is ±${trial.focus_noise_band} points around the baseline score of ${base.focus_score}.`);
    await expectNoSeriousA11yViolations(page);

    if (info.project.name === "desktop") {
      await page.setViewportSize({ width: 320, height: 720 });
      await expect(table).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("profile answers are announced once, and only when applied (WCAG 4.1.3)", () => {
  test.skip(process.env.E2E_SKIN_PROFILE === "false", "skin profile switched off for this run");

  async function openAnswers(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await expect(page.getByRole("radio", { name: /Look more hydrated/ })).toBeAttached();
    await page.getByRole("button", { name: "Add your answers" }).click();
    // The control that opened the form is gone; focus goes to the first question, not the page.
    await expect(focused(page)).toHaveAttribute("name", "Shine through the day");
    return page.locator("form").filter({ hasText: "Shine through the day" });
  }

  test("snapshot: success says which answers and whether the list moved; focus lands on Edit answers", async ({ page }) => {
    const answers = await openAnswers(page);
    await answers.getByRole("group", { name: "Tight or flaky" }).getByRole("radio", { name: "Often" }).check({ force: true });
    const before = await focusOrder(page);
    const said = await recordAnnouncements(page);
    await answers.getByRole("button", { name: "Use my answers" }).click();

    const card = page.locator("div", { has: page.getByRole("heading", { name: "In your words" }) }).last();
    await expect(card.getByRole("button", { name: "Edit answers" })).toBeFocused();
    await expect(card).toContainText("tight or flaky often");
    await expect(page.getByText("You and the camera both point to dryness")).toBeVisible();
    await expect.poll(said).toHaveLength(1);
    const moved = JSON.stringify(await focusOrder(page)) !== JSON.stringify(before);
    expect((await said())[0]).toBe(
      `Answers applied: tight or flaky often. ${moved ? "The focus list has been re-ordered." : "The order of the focus list is unchanged."}`,
    );
    await page.waitForTimeout(600);
    expect(await said()).toHaveLength(1);

    // Applying the same answers again changes nothing, and says so. (The announcer drops an identical sentence
    // repeated within 2 s as one event, so this waits that long.)
    await page.waitForTimeout(2_100);
    await card.getByRole("button", { name: "Edit answers" }).click();
    await expect(focused(page)).toHaveAttribute("name", "Shine through the day");
    await page.getByRole("button", { name: "Use my answers" }).click();
    await expect.poll(said).toHaveLength(2);
    expect((await said())[1]).toBe("Answers applied: tight or flaky often. The order of the focus list is unchanged.");
  });

  test("snapshot: a failed re-order never says 'applied', is shown, and can be retried", async ({ page }) => {
    const answers = await openAnswers(page);
    await answers.getByRole("group", { name: "Shine through the day" }).getByRole("radio", { name: "Often" }).check({ force: true });
    await page.route("**/scans/*/focus-plan", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Down" } }) }));
    const said = await recordAnnouncements(page);
    await answers.getByRole("button", { name: "Use my answers" }).click();

    await expect.poll(said).toHaveLength(1);
    expect((await said())[0]).toBe("Your answers are kept, but the focus list couldn't be updated. It is in its default order.");
    await expect(page.getByText("The focus list couldn't be updated for these answers.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit answers" })).toBeFocused();

    await page.unroute("**/scans/*/focus-plan");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(said).toHaveLength(2);
    expect((await said())[1]).toMatch(/^Answers applied: shine often\. The (focus list has been re-ordered|order of the focus list is unchanged)\.$/);
    await expect(page.getByText("The focus list couldn't be updated for these answers.")).toHaveCount(0);
  });

  async function profiledTrial(page: Page) {
    const answers = await openAnswers(page);
    await answers.getByRole("group", { name: "Tight or flaky" }).getByRole("radio", { name: "Often" }).check({ force: true });
    await answers.getByRole("checkbox", { name: /Save my answers with this trial/ }).check();
    await answers.getByRole("button", { name: "Use my answers" }).click();
    await expect(page.getByText("You and the camera both point to dryness")).toBeVisible();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await expect(page).toHaveURL(/\/trial\?id=/);
    const block = page.locator("details").filter({ hasText: "Profile at the start" });
    await block.locator("summary").click();
    return block;
  }

  test("trial: saved answers are read back from the server once; the frozen profile and plan don't change", async ({ page }) => {
    const block = await profiledTrial(page);
    const plan = page.getByRole("region", { name: "Decided before the check-in, not after" });
    const planBefore = await plan.innerText();
    await block.getByRole("button", { name: "Edit answers" }).click();
    await block.getByRole("group", { name: "Shine through the day" }).getByRole("radio", { name: "Often" }).check({ force: true });
    const said = await recordAnnouncements(page);
    await block.getByRole("button", { name: "Save answers" }).click();

    await expect(block.getByRole("button", { name: "Edit answers" })).toBeFocused();
    await expect.poll(said).toHaveLength(1);
    expect((await said())[0]).toBe("Answers saved: shine often · tight or flaky often. This trial keeps the profile it started with.");
    await page.waitForTimeout(600);
    expect(await said()).toHaveLength(1);
    await expect(block).toContainText("In your words: tight or flaky often"); // the profile at the start is unchanged
    expect(await plan.innerText()).toBe(planBefore);
  });

  test("trial: a failed save shows the error, says nothing about saving, and keeps focus on Save", async ({ page }) => {
    const block = await profiledTrial(page);
    await block.getByRole("button", { name: "Edit answers" }).click();
    await block.getByRole("group", { name: "Shine through the day" }).getByRole("radio", { name: "Often" }).check({ force: true });
    await page.route("**/trials/*/profile", (r) =>
      r.request().method() === "PATCH"
        ? r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "profile_conflict", message: "These answers changed in another tab." } }) })
        : r.fallback(),
    );
    const said = await recordAnnouncements(page);
    const save = block.getByRole("button", { name: "Save answers" });
    await save.click();

    await expect(block.getByRole("alert")).toBeVisible();
    await expect(save).toBeFocused();
    await page.waitForTimeout(600);
    expect((await said()).join("|")).not.toContain("Answers saved");
    await expect(block).not.toContainText("Changed after your plan was fixed");
  });
});

// --- Large text, text spacing and long words (WCAG 1.4.4, 1.4.10, 1.4.12) -----------------------------------

const TEXT_SPACING = "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }";
/** Doubling the root size stands in for the browser's text-size setting: every rem-sized length grows. */
const TEXT_200 = "html { font-size: 200% !important; }";

async function everyRoute(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.waitForURL(/\/results\?/);
  const results = page.url();
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.waitForURL(/\/matches\?/);
  const matches = page.url();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await page.waitForURL(/\/product\?/);
  const product = page.url();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await page.waitForURL(/\/trial\?id=/);
  await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Measured change/ })).toBeVisible();
  return ["/", "/privacy", "/scan", "/trials", results, matches, product, page.url()];
}

/** Page-wide sideways scrolling, controls whose label spills out of them, and clipped headings. */
const layoutProblems = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const over = document.documentElement.scrollWidth - innerWidth;
    if (over > 0) out.push(`page scrolls sideways by ${over}px`);
    const name = (el: HTMLElement) => `${el.tagName.toLowerCase()} "${el.innerText.trim().slice(0, 40)}"`;
    const shown = (el: HTMLElement) => el.getClientRects().length > 0 && !el.closest(".sr-only, [aria-hidden=true], [role=img]");
    for (const el of document.querySelectorAll<HTMLElement>("button, a, summary"))
      if (shown(el) && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1) out.push(`label spills out of ${name(el)}`);
    for (const el of document.querySelectorAll<HTMLElement>("h1, h2, h3")) {
      if (!shown(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} is wider than its box`);
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === "visible" && s.overflowY === "visible") continue;
        // A scroll container (the problem carousel, wide tables) keeps its content reachable; only clipping counts.
        if (!["hidden", "clip"].includes(s.overflowX)) break;
        const c = a.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1) out.push(`${name(el)} is clipped by its container`);
        break;
      }
    }
    return out;
  });

test.describe("large text and text spacing", () => {
  const conditions = [
    { name: "200 % text, desktop", width: 1280, height: 800, css: TEXT_200 },
    { name: "200 % text, phone", width: 390, height: 844, css: TEXT_200 },
    // At 320 px the header row (logo, Start, menu) still overflows by ~33 px with text spacing, as it did before
    // this change: 1.4.12 doesn't require 320 px at the same time, and fitting it needs a header redesign (31 §6.8).
    { name: "WCAG text spacing on a 390 px phone", width: 390, height: 844, css: TEXT_SPACING },
  ];
  for (const c of conditions) {
    test(`${c.name}: nothing clipped, no sideways scrolling, no spilled labels`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own viewport");
      const routes = await everyRoute(page);
      await page.setViewportSize({ width: c.width, height: c.height });
      for (const url of routes) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.addStyleTag({ content: c.css });
        await page.waitForLoadState("networkidle");
        expect(await layoutProblems(page), url).toEqual([]);
      }
    });
  }

  test("pills grow with their label instead of keeping a fixed height", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sets its own viewport");
    await page.goto("/");
    await page.addStyleTag({ content: TEXT_200 });
    const cta = page.locator("main").getByRole("link", { name: "Start a fair test" }).first();
    const box = await cta.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    expect(box.client).toBeGreaterThan(112); // taller than its old fixed 3.5 rem, because the label wraps
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
  });
});

// --- Focus not obscured at 200 % and 400 % zoom (WCAG 2.4.11) ---------------------------------------------------

/**
 * Share of the focused control covered by other content, on a 5×5 grid. A visually hidden radio or switch shows its
 * focus on its label, so the label is what's measured.
 */
const coverage = (page: Page) =>
  page.evaluate(() => {
    let el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    if (el.matches("input.sr-only")) el = (el.closest("label") as HTMLElement | null) ?? el;
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40);
    const [x0, x1, y0, y1] = [Math.max(r.left, 0), Math.min(r.right, innerWidth), Math.max(r.top, 0), Math.min(r.bottom, innerHeight)];
    if (x1 <= x0 || y1 <= y0) return { name, covered: 1 };
    let hidden = 0;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const top = document.elementFromPoint(x0 + ((i + 0.5) * (x1 - x0)) / 5, y0 + ((j + 0.5) * (y1 - y0)) / 5);
        if (top && !el.contains(top) && !top.contains(el)) hidden++;
      }
    return { name, covered: hidden / 25 };
  });

test.describe("focus not obscured at 200 % and 400 % zoom (WCAG 2.4.11)", () => {
  // CSS-pixel viewports equal to a 1280 × 800 window at 200 % and a 1280 × 1024 window at 400 %.
  for (const zoom of [{ name: "200 %", width: 640, height: 400 }, { name: "400 %", width: 320, height: 256 }]) {
    test(`Tab and Shift+Tab never hide the focused control entirely at ${zoom.name}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own viewport");
      test.setTimeout(180_000);
      const routes = (await everyRoute(page)).filter((u) => !/\/scan$|\/product\?/.test(u));
      await page.setViewportSize({ width: zoom.width, height: zoom.height });
      const partly: string[] = [];
      for (const url of routes) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const stops = await page.evaluate(() => document.querySelectorAll("a[href], button:not([disabled]), input:not([type=hidden]), [tabindex='0'], summary").length);
        const hidden: string[] = [];
        for (const key of ["Tab", "Shift+Tab"])
          for (let i = 0; i < stops + 4; i++) {
            await page.keyboard.press(key);
            const c = await coverage(page);
            if (c?.covered === 1) hidden.push(`${key} ${c.name}`);
            else if (c && c.covered > 0) partly.push(`${c.name} (${Math.round(c.covered * 100)}%)`);
          }
        expect(hidden, url).toEqual([]);
      }
      // Partly covered is allowed by 2.4.11 (AA) but not by 2.4.12 (AAA); recorded so it stays visible.
      if (partly.length) test.info().annotations.push({ type: "partly covered (2.4.12)", description: [...new Set(partly)].join("; ") });
    });
  }

  test("programmatic focus moves land in view at 400 %", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sets its own viewport");
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(focused(page)).toHaveText("Look more hydrated");
    expect((await coverage(page))?.covered).toBe(0);
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
    await expect(focused(page)).toHaveText(/Measured change/);
    expect((await coverage(page))?.covered).toBe(0);
    await page.goto("/trials");
    await page.getByRole("button", { name: /Delete all my data/ }).click();
    await expect(focused(page)).toBeVisible();
    expect((await coverage(page))?.covered).toBe(0);
  });
});
