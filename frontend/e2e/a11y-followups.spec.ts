import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { expectNoSeriousA11yViolations, focused } from "./helpers/a11y";

const portrait = path.join(__dirname, "fixtures", "synthetic-portrait.png");

/**
 * Accessibility release 1, remaining issues (docs/innovation/31 §6.5): route announcements, the Matches heading,
 * score reading order, filter options, group labels, dragging alternatives, motion and focus under sticky headers.
 */

/** Records every text Next.js puts in its route announcer, and the document title at that moment. */
async function recordRouteAnnouncements(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __routeSaid: string[] };
    w.__routeSaid = [];
    const attach = () => {
      const host = document.querySelector("next-route-announcer");
      const node = host?.shadowRoot?.querySelector("#__next-route-announcer__");
      if (!node) return false;
      new MutationObserver(() => {
        const text = node.textContent ?? "";
        if (text) w.__routeSaid.push(text);
      }).observe(node, { childList: true, characterData: true, subtree: true });
      return true;
    };
    const poll = setInterval(() => attach() && clearInterval(poll), 20);
  });
  return () => page.evaluate(() => (window as unknown as { __routeSaid: string[] }).__routeSaid);
}

test.describe("route announcements", () => {
  test("each in-app navigation announces the new page's title, never the previous page's heading", async ({ page }) => {
    const said = await recordRouteAnnouncements(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await expect(focused(page)).toHaveText("Your skin snapshot");
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(page).toHaveURL(/\/matches/);
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await expect(page).toHaveURL(/\/product/);
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await expect(page).toHaveURL(/\/trial\?id=/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("navigation").getByRole("link", { name: "My trials" }).first().click();
    await expect(page).toHaveURL(/\/trials/);
    await page.goBack();
    await expect(page).toHaveURL(/\/trial\?id=/);
    await page.getByRole("link", { name: "ProofLoop home" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(said).toHaveLength(7);
    const expected = [
      /^Your snapshot · ProofLoop$/,
      /^Matches · ProofLoop$/,
      /^Product · ProofLoop$/,
      /^Trial · ProofLoop$/,
      /^My trials · ProofLoop$/,
      // Back to a page that is still mounted: its own state title (set by the page) is as good as the route's.
      /^(Trial|Waiting for check-in · Look more hydrated) · ProofLoop$/,
      /^ProofLoop — is your skincare working\? Run a fair test\.$/,
    ];
    const got = await said();
    expected.forEach((re, i) => expect(got[i], `announcement ${i + 1} of ${JSON.stringify(got)}`).toMatch(re));
  });
});

/** Records the text of every heading that receives focus, at the moment it receives it. */
async function recordFocusedHeadings(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __focusedHeadings: string[] };
    w.__focusedHeadings = [];
    document.addEventListener("focusin", (e) => {
      const el = e.target as HTMLElement;
      if (/^H[1-6]$/.test(el.tagName)) w.__focusedHeadings.push(el.textContent ?? "");
    });
  });
  return () => page.evaluate(() => (window as unknown as { __focusedHeadings: string[] }).__focusedHeadings);
}

test.describe("matches heading", () => {
  for (const delay of [0, 1500]) {
    test(`focus reaches the final goal heading, never the loading text (API delay ${delay} ms)`, async ({ page }) => {
      const focusedHeadings = await recordFocusedHeadings(page);
      await page.route("**/recommendations?**", async (route) => {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        await route.continue();
      });
      await page.goto("/");
      await page.getByRole("button", { name: "Explore with sample data" }).click();
      await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
      await page.getByRole("button", { name: "See matching products" }).click();
      await expect(focused(page)).toHaveText("Look more hydrated");
      expect(await focusedHeadings()).toEqual(["Your skin snapshot", "Look more hydrated"]);

      // A filter change reloads the list but keeps the heading.
      const h1 = page.getByRole("heading", { level: 1 });
      await page.evaluate(() => {
        const w = window as unknown as { __h1Texts: string[] };
        w.__h1Texts = [];
        new MutationObserver(() => w.__h1Texts.push(document.querySelector("main h1")?.textContent ?? "(none)")).observe(
          document.getElementById("main")!,
          { subtree: true, childList: true, characterData: true },
        );
      });
      await page.getByText("Fragrance-free only").click();
      await expect(page.getByText(/5 products ·/)).toBeVisible();
      await expect(h1).toHaveText("Look more hydrated");
      const texts = await page.evaluate(() => (window as unknown as { __h1Texts: string[] }).__h1Texts);
      expect(new Set(texts)).toEqual(new Set(["Look more hydrated"]));
    });
  }
});

test("each score is read as one phrase: number, scale and band, in that order", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(focused(page)).toHaveText("Your skin snapshot");
  const scores = page.locator("main").getByText(/^\d+ out of 100, (worth focusing on|room to improve|looking strong)$/);
  await expect(scores).toHaveCount(8);
  const tree = await page.locator("main").ariaSnapshot();
  expect(tree).toContain("69 out of 100, room to improve");
  expect(tree).not.toMatch(/\d(Room|Looking|Worth)/);
});

/** Text that assistive technology would get in capitals: readable (not aria-hidden) text under text-transform: uppercase. */
const readableCapitals = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest("[aria-hidden='true']")) continue;
      if (getComputedStyle(el).textTransform === "uppercase") found.push(n.textContent.trim());
    }
    return found;
  });

test.describe("labels and options", () => {
  test("filter options are read once, by their own radio or switch, and keep working", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(page.getByText(/6 products ·/)).toBeVisible();
    const filters = page.getByRole("region", { name: "Filters" });
    expect(await filters.ariaSnapshot()).toBe(
      [
        '- region "Filters":',
        '  - group "Budget":',
        "    - text: Budget",
        '    - radio "Any" [checked]',
        '    - radio "≤ $25"',
        '    - radio "≤ $35"',
        '    - radio "≤ $50"',
        '  - group "Finish":',
        "    - text: Finish",
        '    - radio "Any" [checked]',
        '    - radio "Light"',
        '    - radio "Rich"',
        '  - switch "Fragrance-free only"',
      ].join("\n"),
    );
    // Clicking the visible text still selects, and the selection is exposed.
    await filters.getByText("≤ $35").click();
    await expect(filters.getByRole("radio", { name: "≤ $35" })).toBeChecked();
    await filters.getByText("Fragrance-free only").click();
    await expect(filters.getByRole("switch", { name: "Fragrance-free only" })).toBeChecked();
  });

  test("labels styled in capitals are read in natural case", async ({ page }) => {
    await page.goto("/");
    expect(await readableCapitals(page)).toEqual([]);
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(page.getByRole("group", { name: "Budget" })).toBeVisible();
    expect(await readableCapitals(page)).toEqual([]);
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await expect(page.getByRole("heading", { name: "Product facts · from the catalogue" })).toBeVisible();
    expect(await readableCapitals(page)).toEqual([]);
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await expect(page.getByRole("region", { name: /fair-test plan|Decided before/ }).first()).toBeVisible();
    expect(await readableCapitals(page)).toEqual([]);
  });
});

test.describe("photo positioning without dragging (WCAG 2.5.7)", () => {
  test("move buttons give the same framing as dragging, by single tap or click and by keyboard", async ({ page }, info) => {
    await page.goto("/scan");
    await page.getByText(/I'm 18 or over/).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[type="file"]').setInputFiles(portrait);
    const frame = page.getByRole("application");
    const img = frame.locator("img");
    const box = () =>
      img.evaluate((e) => ({ left: parseFloat(e.style.left), top: parseFloat(e.style.top), width: parseFloat(e.style.width) }));
    const start = await box();
    const moves = page.getByRole("group", { name: "Move photo" });
    await expectNoSeriousA11yViolations(page);
    const press = async (name: string) => {
      const button = moves.getByRole("button", { name });
      if (info.project.name === "mobile") await button.tap();
      else await button.click();
    };

    // Two single presses right: 2 × 2% of the frame width; size (and so the crop scale) untouched.
    await press("Move photo right");
    await press("Move photo right");
    const right = await box();
    expect(right.left).toBeCloseTo(start.left + 4, 4);
    expect(right.top).toBeCloseTo(start.top, 4);
    expect(right.width).toBe(start.width);
    await press("Move photo down");
    expect((await box()).top).toBeCloseTo(start.top + 1.5, 4); // 2% of the width is 1.5% of the 4:3 height

    // The same buttons work from the keyboard.
    await moves.getByRole("button", { name: "Move photo up" }).focus();
    await page.keyboard.press("Enter");
    await moves.getByRole("button", { name: "Move photo left" }).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    expect(await box()).toEqual(start);

    // A drag of the same distance lands on exactly the framing two button presses give.
    await press("Move photo right");
    await press("Move photo right");
    const byButtons = await box();
    await moves.getByRole("button", { name: "Centre photo" }).click();
    expect(await box()).toEqual(start);
    const r = (await frame.boundingBox())!;
    const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + r.width * 0.04, cy, { steps: 4 });
    await page.mouse.up();
    const byDrag = await box();
    expect(byDrag.left).toBeCloseTo(byButtons.left, 1);
    expect(byDrag.top).toBeCloseTo(byButtons.top, 1);
    expect(byDrag.width).toBe(byButtons.width);

    // Still analysable afterwards (this server has no YouCam key, so it reports that).
    await page.getByRole("button", { name: "Analyse this photo" }).click();
    await expect(focused(page)).toHaveText("Live analysis isn't configured on this server.");
  });
});

test.describe("moving content (WCAG 2.2.2)", () => {
  const playState = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll(".marquee, .float")].map((e) => getComputedStyle(e).animationPlayState),
    );

  test.describe("with motion allowed", () => {
    test.use({ contextOptions: { reducedMotion: "no-preference" } });

    test("one control pauses the ticker and the floating chips, says so, and they stay paused", async ({ page }) => {
      await page.goto("/");
      const toggle = page.getByRole("button", { name: "Pause animations" });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      const moving = await playState(page);
      expect(moving.length).toBeGreaterThanOrEqual(4); // the ticker and three chips
      expect(new Set(moving)).toEqual(new Set(["running"]));

      // Scan after the one-shot entrance fades (560 ms); mid-fade, blended colours read as low contrast.
      await page.evaluate(() =>
        Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)),
      );
      await expectNoSeriousA11yViolations(page);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toBeFocused();
      expect(new Set(await playState(page))).toEqual(new Set(["paused"]));
      // The ticker doesn't creep on while paused.
      const at = () => page.locator(".marquee").evaluate((e) => getComputedStyle(e).transform);
      const before = await at();
      await page.waitForTimeout(600);
      expect(await at()).toBe(before);

      // Not restarted by a reload or by leaving the page and coming back.
      await page.reload();
      expect(new Set(await playState(page))).toEqual(new Set(["paused"]));
      await expect(page.getByRole("button", { name: "Pause animations" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("navigation").getByRole("link", { name: "Privacy" }).first().click();
      await expect(page).toHaveURL(/\/privacy/);
      await page.getByRole("link", { name: "ProofLoop home" }).first().click();
      await expect(page.getByRole("button", { name: "Pause animations" })).toHaveAttribute("aria-pressed", "true");
      expect(new Set(await playState(page))).toEqual(new Set(["paused"]));

      // And it resumes only when asked.
      await page.getByRole("button", { name: "Pause animations" }).click();
      await expect(page.getByRole("button", { name: "Pause animations" })).toHaveAttribute("aria-pressed", "false");
      expect(new Set(await playState(page))).toEqual(new Set(["running"]));
    });
  });

  test("with reduced motion, nothing moves and there is nothing to pause", async ({ page }) => {
    // The suite's default context asks for reduced motion (playwright.config.ts).
    await page.goto("/");
    const anims = await page.evaluate(() =>
      [...document.querySelectorAll(".marquee, .float")].map((e) => {
        const s = getComputedStyle(e);
        return { name: s.animationName, iterations: s.animationIterationCount };
      }),
    );
    for (const a of anims) expect(a.name === "none" || a.iterations === "1", JSON.stringify(a)).toBe(true);
    await expect(page.getByRole("button", { name: "Pause animations" })).toHaveCount(0);
  });
});

/**
 * How much of the focused element is covered by something else (a sticky header or bar), sampled on a 5×5 grid over
 * its on-screen box. 1 = entirely hidden (fails 2.4.11), 0 = fully visible (meets 2.4.12 too).
 */
const obscured = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    const [x0, x1] = [Math.max(r.left, 0), Math.min(r.right, innerWidth)];
    const [y0, y1] = [Math.max(r.top, 0), Math.min(r.bottom, innerHeight)];
    if (x1 <= x0 || y1 <= y0) return { name: el.textContent?.trim().slice(0, 40) ?? el.tagName, covered: 1, offscreen: true };
    let hidden = 0;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / 5;
        const y = y0 + ((j + 0.5) * (y1 - y0)) / 5;
        const top = document.elementFromPoint(x, y);
        if (top && !el.contains(top) && !top.contains(el)) hidden++;
      }
    return { name: (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40), covered: hidden / 25, offscreen: false };
  });

async function walkFocus(page: Page, key: "Tab" | "Shift+Tab", max: number) {
  const results: { name: string; covered: number; offscreen: boolean }[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const o = await obscured(page);
    if (o) results.push(o);
  }
  return results;
}

test.describe("focus not obscured by sticky headers (WCAG 2.4.11)", () => {
  for (const route of ["/", "/privacy", "trial"] as const) {
    test(`keyboard focus is never hidden by the sticky nav or step bar on ${route}`, async ({ page }) => {
      if (route === "trial") {
        await page.goto("/");
        await page.getByRole("button", { name: "Explore with sample data" }).click();
        await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
        await page.getByRole("button", { name: "See matching products" }).click();
        await page.getByRole("link", { name: /Details & trial/ }).first().click();
        await page.getByRole("button", { name: "Save baseline & start trial" }).click();
        await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
        await expect(page.getByRole("heading", { level: 2, name: /Measured change/ })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("body").click({ position: { x: 1, y: 300 } });
      } else {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
      }
      const count = await page.evaluate(
        () => document.querySelectorAll("main a[href], main button:not([disabled]), main input:not([type=hidden]), main [tabindex='0'], main summary").length,
      );
      const forward = await walkFocus(page, "Tab", count + 12);
      const back = await walkFocus(page, "Shift+Tab", count + 12);
      const all = [...forward, ...back];
      const hidden = all.filter((r) => r.covered === 1 || r.offscreen).map((r) => r.name);
      const partly = all.filter((r) => r.covered > 0 && r.covered < 1).map((r) => `${r.name} (${Math.round(r.covered * 100)}%)`);
      test.info().annotations.push({ type: "focus-stops", description: String(all.length) });
      if (partly.length) test.info().annotations.push({ type: "partly-covered", description: [...new Set(partly)].join("; ") });
      expect(hidden, "entirely hidden focus").toEqual([]);
      expect([...new Set(partly)], "partly covered focus").toEqual([]);
    });
  }

  test.describe("with smooth scrolling", () => {
    test.use({ contextOptions: { reducedMotion: "no-preference" } });
    test("homepage, Tab and Shift+Tab, after each smooth scroll settles", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const settle = () => page.evaluate(() => new Promise((r) => setTimeout(r, 450)));
      const results: { name: string; covered: number; offscreen: boolean }[] = [];
      for (const key of ["Tab", "Shift+Tab"] as const)
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press(key);
          await settle();
          const o = await obscured(page);
          if (o) results.push(o);
        }
      expect(results.filter((r) => r.covered > 0 || r.offscreen).map((r) => `${r.name} ${r.covered}`)).toEqual([]);
    });
  });

  test("programmatic focus moves land in view: verdict, instrument check and delete-all confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await expect(focused(page)).toHaveText("Look more hydrated");
    expect((await obscured(page))?.covered).toBe(0);
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await page.getByRole("button", { name: /Run the sample instrument check/ }).click();
    await expect(focused(page)).toHaveAttribute("id", "instrument-title");
    expect((await obscured(page))?.covered).toBe(0);
    await page.getByRole("button", { name: "Show synthetic 21-day follow-up" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /Measured change/ })).toBeVisible();
    expect((await obscured(page))?.covered).toBe(0);
    await page.goto("/trials");
    await page.getByRole("button", { name: /Delete all my data/ }).click();
    expect((await obscured(page))?.covered).toBe(0);
  });

  test("the open mobile menu keeps every item in view", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "the menu button exists below 900 px");
    await page.goto("/privacy");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole("button", { name: "Open menu" }).click();
    const results = await walkFocus(page, "Tab", 8);
    expect(results.filter((r) => r.covered > 0 || r.offscreen).map((r) => r.name)).toEqual([]);
  });
});


test.describe("skin profile removal (with PR #4)", () => {
  test.skip(process.env.E2E_SKIN_PROFILE === "false", "skin profile switched off for this run");

  test("removal focuses its outcome once, the announcer stays silent, and the plan is untouched", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore with sample data" }).click();
    await page.getByRole("button", { name: "Add your answers" }).click();
    const answers = page.locator("form").filter({ hasText: "Shine through the day" });
    await answers.getByRole("group", { name: "Tight or flaky" }).getByRole("radio", { name: "Often" }).check({ force: true });
    await answers.getByRole("checkbox", { name: /Save my answers with this trial/ }).check();
    await answers.getByRole("button", { name: "Use my answers" }).click();
    await expect(page.getByText("You and the camera both point to dryness")).toBeVisible();
    await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
    await page.getByRole("button", { name: "See matching products" }).click();
    await page.getByRole("link", { name: /Details & trial/ }).first().click();
    await page.getByRole("button", { name: "Save baseline & start trial" }).click();
    await expect(page).toHaveURL(/\/trial\?id=/);
    const plan = page.getByRole("region", { name: "Decided before the check-in, not after" });
    const planBefore = await plan.innerText();

    const block = page.locator("details").filter({ hasText: "Profile at the start" });
    await block.locator("summary").click();
    await block.getByRole("button", { name: "Remove profile" }).click();
    await expect(focused(page)).toContainText("Remove your answers and the skin-type readings from this trial?");
    await block.getByRole("button", { name: "Cancel" }).click();
    await expect(block.getByRole("button", { name: "Remove profile" })).toBeFocused();
    await block.getByRole("button", { name: "Remove profile" }).click();
    await block.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(focused(page)).toHaveText(/^You removed your answers and the skin-type readings from this trial\./);
    await expect(page.getByText(/You removed your answers/)).toHaveCount(1);
    // Spoken by the focus move only: nothing in either live region repeats it.
    await page.waitForTimeout(400);
    await expect(page.locator("#pl-announcer")).not.toContainText("removed");
    expect(await page.locator("[role=status], [role=alert], [aria-live]").evaluateAll((els) => els.map((e) => e.textContent ?? "").join("|"))).not.toMatch(/removed your answers/);
    await expect(block.getByRole("button")).toHaveCount(0);
    expect(await plan.innerText()).toBe(planBefore);

    // The user can carry on: the next control in order is reachable with Tab.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
});
