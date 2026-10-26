import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The checked skin profile, on sample data (no YouCam calls). Skipped when the suite runs with the flag off.
test.skip(process.env.E2E_SKIN_PROFILE === "false", "skin profile switched off for this run");

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
}

async function sampleSnapshot(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/results\?scan=/);
}

async function startHydrationTrial(page: Page) {
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
}

test("reading, answers and a saved profile that is frozen with the plan", async ({ page }) => {
  await sampleSnapshot(page);
  const snapshotUrl = page.url();

  const reading = page.getByRole("heading", { name: "How the camera read this photo" }).locator("xpath=ancestor::div[contains(@class,'p-6')][1]");
  await expect(reading.getByRole("definition")).toHaveText(["Dry", "Normal", "Dry"]);
  await expect(reading).toContainText("Not your face.");
  await reading.getByText("What this reading isn't").click();
  await expect(reading).toContainText("It isn't a diagnosis");

  await page.getByRole("button", { name: "Add your answers" }).click();
  const answers = page.locator("form").filter({ hasText: "Shine through the day" });
  await answers.getByRole("radio", { name: "Rarely" }).first().check({ force: true });
  await answers.getByRole("group", { name: "Tight or flaky" }).getByRole("radio", { name: "Often" }).check({ force: true });
  const shineChip = answers.getByRole("button", { name: "Balance shine" });
  await shineChip.focus();
  await page.keyboard.press("Space");
  await expect(shineChip).toHaveAttribute("aria-pressed", "true");
  await answers.getByRole("group", { name: /sound like you/ }).getByRole("radio", { name: "Yes" }).check({ force: true });
  await answers.getByRole("checkbox", { name: /Save my answers with this trial/ }).check();
  await expectNoSeriousA11yViolations(page);
  await answers.getByRole("button", { name: "Use my answers" }).click();

  // Tight/flaky often + camera "dry": agreement, in plain words.
  await expect(page.getByText("You and the camera both point to dryness")).toBeVisible();
  // The user's own pick is at the top of the scale: explained, not hidden, and not moved above testable focuses.
  await expect(page.getByText(/You picked Balance shine, but at 99/)).toBeVisible();
  const shine = page.locator("label", { has: page.getByRole("radio", { name: /Balance shine/ }) });
  await expect(shine).toContainText("You picked this");
  await expect(shine).toContainText("Can't show gains");

  await startHydrationTrial(page);
  await expect(page.getByText("Your answers and the camera's reading are saved with it as they are today")).toBeVisible();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);

  const block = page.locator("details").filter({ hasText: "Profile at the start" });
  await block.locator("summary").click();
  await expect(block).toContainText("shine rarely · tight or flaky often");
  await expect(block).toContainText("whole face dry · t-zone normal · cheeks dry");
  await expect(block).toContainText("Not checked yet");
  await expect(block).toContainText("This profile never affects your plan or your result.");
  await expectNoSeriousA11yViolations(page);

  // The recorded sample repeat predates skin-type readings, so consistency isn't claimed.
  await page.getByRole("button", { name: /Run the sample instrument check/ }).click();
  await expect(block).toContainText("Not checked yet");

  const plan = page.getByRole("region", { name: "Decided before the check-in, not after" });
  const planBefore = await plan.innerText();
  await block.getByRole("button", { name: "Edit answers" }).click();
  await block.getByRole("group", { name: "Shine through the day" }).getByRole("radio", { name: "Often" }).check({ force: true });
  await block.getByRole("button", { name: "Save answers" }).click();
  await expect(block).toContainText("Changed after your plan was fixed");
  await expect(block).toContainText("This trial keeps the profile it started with");
  await expect(block).toContainText("shine rarely · tight or flaky often"); // the start is unchanged
  expect(await plan.innerText()).toBe(planBefore);

  await block.getByRole("button", { name: "Remove profile" }).click();
  await block.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(block).toContainText("You removed your answers and the skin-type readings from this trial.");
  expect(await plan.innerText()).toBe(planBefore);

  // Back on the snapshot, the reading reads as removed by the user, not as never returned.
  await page.goto(snapshotUrl);
  await expect(page.getByText("You removed this photo's skin-type reading")).toBeVisible();
  await expect(page.getByText("The camera didn't return a skin-type reading")).toHaveCount(0);
});

test("skipping the answers starts a trial without a profile", async ({ page }) => {
  await sampleSnapshot(page);
  await page.getByRole("button", { name: "Add your answers" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await startHydrationTrial(page);
  await expect(page.getByText("saved with it as they are today")).toHaveCount(0);
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);
  const block = page.locator("details").filter({ hasText: "Profile at the start" });
  await block.locator("summary").click();
  await expect(block).toContainText("No profile was saved with this trial");
});

test("answers that aren't saved stay on the page and never reach the trial", async ({ page }) => {
  await sampleSnapshot(page);
  await page.getByRole("button", { name: "Add your answers" }).click();
  const answers = page.locator("form").filter({ hasText: "Shine through the day" });
  await answers.getByRole("group", { name: "Reacts easily to new products" }).getByRole("radio", { name: "Yes" }).check({ force: true });
  await answers.getByRole("button", { name: "Use my answers" }).click();
  await expect(page.getByText("Change one product at a time")).toBeVisible();
  await expect(page.getByText("Not saved: these answers stay in this tab.")).toBeVisible();
  await startHydrationTrial(page);
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);
  const block = page.locator("details").filter({ hasText: "Profile at the start" });
  await block.locator("summary").click();
  await expect(block).toContainText("No profile was saved with this trial");
});
