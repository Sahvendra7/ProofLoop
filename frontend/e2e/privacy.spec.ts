import { expect, test } from "@playwright/test";

test("privacy page states YouCam's retention periods for the data each applies to", async ({ page }) => {
  await page.goto("/privacy");
  const youcam = page.getByRole("listitem").filter({ hasText: "keeps different data for different periods" });
  await expect(youcam).toContainText("photo ProofLoop uploads, and its file ID, are stored for 30 days");
  await expect(youcam).toContainText("Skin Analysis results are retained for 24 hours");
  await expect(page.getByText("processed results are retained for 24 hours.")).toHaveCount(0);
});
