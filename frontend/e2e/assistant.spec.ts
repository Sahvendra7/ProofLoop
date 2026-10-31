import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import { WCAG_TAGS } from "./helpers/a11y";

// The isolated E2E backend has no Gemini key, so quick answers run for real and free text is
// unavailable. Free-text behaviour is exercised with mocked assistant responses, clearly scoped below.

async function startSampleTrial(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);
  return page.getByRole("region", { name: "Ask about this trial" });
}

const freeTextOn = (route: Route) =>
  route.fulfill({
    json: {
      free_text_available: true,
      consent_version: "2026-10-26",
      quick_intents: ["is_it_working", "when_check_in", "should_switch"],
      max_message_chars: 500,
      owner_access_required: true,
    },
  });

const OWNER_REJECTED = {
  status: 401,
  json: { error: { code: "owner_auth_required", message: "Typed questions are limited to the prototype owner.", hint: null } },
};

/** Typed questions need the owner key, which the server checks; here the check is mocked to accept. */
async function ownerUnlock(page: Page, panel: ReturnType<Page["getByRole"]>) {
  await page.route("**/api/v1/assistant/owner", (route) => route.fulfill({ status: 204 }));
  await panel.getByLabel("Owner access key").fill("synthetic-owner-key");
  await panel.getByRole("button", { name: "Unlock typed questions" }).click();
  await expect(panel.getByRole("textbox", { name: /Ask in your own words/ })).toBeVisible();
}

function reply(overrides: Record<string, unknown> = {}) {
  return {
    mode: "gemini",
    fallback_reason: null,
    verdict: { code: "no_checkin_yet", next_step: "check_in", early: false, statement: "There's no check-in yet, so there's nothing to compare." },
    reply: "There's no check-in yet, so there's nothing to compare.",
    explanations: [
      {
        id: "variation_band",
        title: "What your band means",
        text: "Your band is ±5 points: how far this score can move between two photos of unchanged skin.",
      },
    ],
    action: null,
    trace: [
      { tool: "get_trial_status", args: {}, ok: true },
      { tool: "get_latest_result", args: {}, ok: true },
    ],
    sources: ["trial_plan", "latest_comparison"],
    units_spent: 0,
    ...overrides,
  };
}

async function consent(panel: ReturnType<Page["getByRole"]>) {
  await panel.getByRole("checkbox", { name: /18 or older/ }).check();
  await panel.getByRole("checkbox", { name: /not in the EEA, UK or Switzerland/ }).check();
}

test("quick answers work by keyboard on a sample trial", async ({ page }) => {
  const panel = await startSampleTrial(page);
  const button = panel.getByRole("button", { name: "Should I switch?" });
  await button.focus();
  await page.keyboard.press("Enter");
  const live = page.locator("#pl-announcer");
  await expect(live).toContainText("From your plan · no AI");
  await expect(live).toContainText("no measured reason to switch");
  await panel.getByText(/What I checked/).click();
  await expect(panel.getByText("Read your trial plan")).toBeVisible();
  await expect(panel.getByRole("button", { name: /Show synthetic check-in/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[aria-labelledby="assistant-title"]').withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("free-text box is hidden when Gemini is unavailable", async ({ page }) => {
  const panel = await startSampleTrial(page);
  await expect(panel.getByRole("button", { name: "Is it working?" })).toBeVisible();
  await expect(panel.getByRole("textbox")).toHaveCount(0);
});

test("consent gate holds the text box until both confirmations, and can be withdrawn", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  const box = panel.getByRole("textbox", { name: /Ask in your own words/ });
  await expect(box).toBeDisabled();
  await expect(panel).toContainText("Google");
  await panel.getByRole("checkbox", { name: /18 or older/ }).check();
  await expect(box).toBeDisabled();
  await panel.getByRole("checkbox", { name: /not in the EEA, UK or Switzerland/ }).check();
  await expect(box).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("region", { name: "Ask about this trial" }).getByRole("textbox")).toBeEnabled();
  await page.getByRole("button", { name: "Stop using Gemini" }).click();
  await expect(page.getByRole("region", { name: "Ask about this trial" }).getByRole("textbox")).toBeDisabled();
});

test("gemini replies and fallbacks are labelled", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  const answers = [
    reply(),
    reply({ mode: "deterministic_fallback", fallback_reason: "timeout", explanations: [] }),
  ];
  await page.route("**/assistant/ask", (route) => route.fulfill({ json: answers.shift() }));
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  const box = panel.getByRole("textbox", { name: /Ask in your own words/ });
  await box.fill("Is it working?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  const live = page.locator("#pl-announcer");
  await expect(live).toContainText("From your plan · no AI");
  await expect(live).toContainText("Approved explanations · topics picked by Gemini, text from ProofLoop");
  await box.fill("And now?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(live).toContainText("Assistant unavailable · from your plan");
  await expect(live).toContainText("took too long");
  await expect(live).not.toContainText("Approved explanations");
});

test("approved explanations are shown apart from the plan's answer", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  await page.route("**/assistant/ask", (route) => route.fulfill({ json: reply() }));
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  await panel.getByRole("textbox", { name: /Ask in your own words/ }).fill("What does the band mean?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = panel.getByRole("listitem").filter({ hasText: "What does the band mean?" });
  // The plan's sentence comes first with its own label; each approved explanation is a separate, titled figure.
  await expect(answer.getByText("There's no check-in yet, so there's nothing to compare.")).toBeVisible();
  const figure = answer.getByRole("figure", { name: "What your band means" });
  await expect(figure).toContainText("Your band is ±5 points");
  await expect(figure).not.toContainText("There's no check-in yet");
  await expect(answer.getByText("topics picked by Gemini, text from ProofLoop")).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[aria-labelledby="assistant-title"]').withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("assistant reply is rendered as text", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  const hostile = '<img src=x onerror="window.__pwned=1"> **bold** [link](https://example.com)';
  await page.route("**/assistant/ask", (route) => route.fulfill({ json: reply({ reply: hostile, explanations: [{ id: "x", title: hostile, text: hostile }] }) }));
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  await panel.getByRole("textbox", { name: /Ask in your own words/ }).fill("hi");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(panel.getByText(hostile, { exact: false }).first()).toBeVisible();
  await expect(panel.locator("img")).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "link" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test("ask button is single-flight", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  let calls = 0;
  await page.route("**/assistant/ask", async (route) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({ json: reply() });
  });
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  await panel.getByRole("textbox", { name: /Ask in your own words/ }).fill("Is it working?");
  const ask = panel.getByRole("button", { name: "Ask", exact: true });
  await ask.dblclick();
  await expect(ask).toHaveAttribute("aria-disabled", "true"); // stays focusable while the answer loads
  await expect(page.locator("#pl-announcer")).toContainText("Approved explanations");
  expect(calls).toBe(1);
});

test("action card uses the mapped route only", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  await page.route("**/assistant/ask", (route) =>
    route.fulfill({
      json: reply({ reply: "See https://evil.example/ for more.", action: { code: "open_matches", available: true } }),
    }),
  );
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  await panel.getByRole("textbox", { name: /Ask in your own words/ }).fill("Should I switch?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  const card = panel.getByRole("link", { name: /See other matches/ });
  await expect(card).toHaveAttribute("href", /^\/matches\?scan=[^&]+&goal=hydration$/);
  await expect(panel.locator('a[href*="evil.example"]')).toHaveCount(0);
});

test("read aloud can be stopped, and only one answer reads at a time", async ({ page }) => {
  // A stand-in for the browser's speech engine: records calls, and cancel() ends the current utterance like Chrome.
  await page.addInitScript(() => {
    const calls: string[] = [];
    let current: SpeechSynthesisUtterance | null = null;
    const end = () => {
      const u = current;
      current = null;
      u?.onend?.(new Event("end") as SpeechSynthesisEvent);
    };
    const w = window as unknown as Record<string, unknown>;
    w.__speech = calls;
    w.__finish = end;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          calls.push(`speak:${u.text.slice(0, 12)}`);
          current = u;
        },
        cancel: () => {
          calls.push("cancel");
          end();
        },
      },
    });
  });
  const panel = await startSampleTrial(page);
  await panel.getByRole("button", { name: "When can I check in?" }).click();
  await panel.getByRole("button", { name: "Should I switch?" }).click();
  const answers = panel.getByRole("listitem").filter({ has: page.getByText(/From your plan/) });
  await expect(answers).toHaveCount(2);
  const [first, second] = [answers.nth(0), answers.nth(1)];

  await first.getByRole("button", { name: "Read aloud" }).click();
  const stop = first.getByRole("button", { name: "Stop reading" });
  await expect(stop).toBeFocused();
  await stop.click();
  await expect(first.getByRole("button", { name: "Read aloud" })).toBeFocused();

  await first.getByRole("button", { name: "Read aloud" }).click();
  await second.getByRole("button", { name: "Read aloud" }).click();
  await expect(first.getByRole("button", { name: "Read aloud" })).toBeVisible();
  await expect(second.getByRole("button", { name: "Stop reading" })).toBeVisible();

  await page.evaluate(() => (window as unknown as { __finish: () => void }).__finish());
  await expect(second.getByRole("button", { name: "Read aloud" })).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { __speech: string[] }).__speech);
  expect(calls.filter((c) => c.startsWith("speak"))).toHaveLength(3);
});


test("typed questions need the owner key, and a wrong key keeps the session", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  await page.route("**/api/v1/assistant/owner", (route) => route.fulfill(OWNER_REJECTED));
  const panel = await startSampleTrial(page);
  await expect(panel.getByRole("textbox", { name: /Ask in your own words/ })).toHaveCount(0);
  await expect(panel).toContainText("limited to this prototype's owner");
  await panel.getByLabel("Owner access key").fill("not-the-key");
  await panel.getByRole("button", { name: "Unlock typed questions" }).click();
  await expect(panel.getByRole("alert")).toContainText("That key isn't valid.");
  await expect(panel.getByRole("textbox", { name: /Ask in your own words/ })).toHaveCount(0);
  // The rejected key must not cost the visitor their session: the trial still loads after a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Ask about this trial" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Is it working?" })).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[aria-labelledby="assistant-title"]').withTags(WCAG_TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("a key the server rejects later locks typed questions again", async ({ page }) => {
  await page.route("**/api/v1/assistant/config", freeTextOn);
  await page.route("**/assistant/ask", (route) => route.fulfill(OWNER_REJECTED));
  const panel = await startSampleTrial(page);
  await ownerUnlock(page, panel);
  await consent(panel);
  await panel.getByRole("textbox", { name: /Ask in your own words/ }).fill("What's the story here?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("limited to the prototype owner");
  await expect(panel.getByLabel("Owner access key")).toBeVisible();
});
