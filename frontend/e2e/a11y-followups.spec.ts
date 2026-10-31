import { expect, test, type Page } from "@playwright/test";
import { focused } from "./helpers/a11y";

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
