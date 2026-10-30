import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** axe tags are not cumulative: WCAG 2.0, 2.1 and 2.2 A/AA each have to be named (incl. target-size). */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Fails on serious/critical violations; logs moderate/minor ones so they stay visible without blocking. */
export async function expectNoSeriousA11yViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const results = await (include ? builder.include(include) : builder).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const other = results.violations.filter((v) => !serious.includes(v));
  if (other.length > 0) console.log(`axe (logged, not failing) ${page.url()}: ${other.map((v) => `${v.id}[${v.impact}]×${v.nodes.length}`).join(", ")}`);
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
}

/** The app's single polite live region. */
export const announcer = (page: Page) => page.locator("#pl-announcer");

/** Whatever currently has keyboard focus. */
export const focused = (page: Page) => page.locator(":focus");

/** Explore with sample data and start a hydration trial; resolves on the trial page. */
export async function startSampleTrial(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await page.getByRole("radio", { name: /Look more hydrated/ }).check({ force: true });
  await page.getByRole("button", { name: "See matching products" }).click();
  await page.getByRole("link", { name: /Details & trial/ }).first().click();
  await page.getByRole("button", { name: "Save baseline & start trial" }).click();
  await expect(page).toHaveURL(/\/trial\?id=/);
}

// --- Contrast ------------------------------------------------------------------------------------------------

const LUMINANCE_SRC = `
  const ch = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const rgb = (css) => css.match(/[\\d.]+/g).slice(0, 3).map(Number);
`;

/** WCAG contrast between two colours given as "rgb(r, g, b)" (use `cssColor` to normalise computed values). */
export function contrast(a: string, b: string): number {
  const ch = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = (css: string) => {
    const [r, g, b] = css.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Tailwind 4 computes colours like `oklab(… / 0.95)`; painting them on a canvas gives plain sRGB and alpha.
const TO_RGBA_SRC = `
  const toRgba = (css) => {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const ctx = c.getContext("2d"); ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return { rgb: "rgb(" + r + ", " + g + ", " + b + ")", alpha: a / 255 };
  };
`;

/** A computed style property of `el` as "rgb(r, g, b)". */
export async function cssColor(el: Locator, property: string): Promise<string> {
  return el.evaluate(
    (node, { property, src }) => new Function(`${src}; return toRgba;`)()(getComputedStyle(node).getPropertyValue(property)).rgb,
    { property, src: TO_RGBA_SRC },
  );
}

/** Background colour painted behind an element: the nearest ancestor (or self) with a mostly opaque background colour. */
export async function backgroundBehind(el: Locator, includeSelf = false): Promise<string> {
  return el.evaluate(
    (node, { self, src }) => {
      const toRgba = new Function(`${src}; return toRgba;`)();
      let cur: Element | null = self ? node : node.parentElement;
      while (cur) {
        const { rgb, alpha } = toRgba(getComputedStyle(cur).backgroundColor);
        if (alpha > 0.5) return rgb;
        cur = cur.parentElement;
      }
      return "rgb(255, 255, 255)";
    },
    { self: includeSelf, src: TO_RGBA_SRC },
  );
}

/**
 * Worst-case contrast of an element's text against the pixels actually rendered behind it (gradients, glows and
 * images included): all text and sticky layers are made transparent, the element's box is captured, and every pixel
 * is compared with the text colour. All text is hidden, not just the element's, because antialiased edges of
 * neighbouring words inside the box are not background.
 */
export async function renderedTextContrast(page: Page, el: Locator): Promise<number> {
  const color = await el.evaluate((e) => getComputedStyle(e).color);
  const style = await page.addStyleTag({
    content: "*, *::before, *::after { color: transparent !important; text-shadow: none !important; } .sticky { visibility: hidden !important; }",
  });
  const png = await el.screenshot({ animations: "disabled" });
  await style.evaluate((s) => (s as Element).remove());
  return page.evaluate(
    async ({ b64, color, src }) => {
      const { lum, ratio, rgb } = new Function(`${src}; return { lum, ratio, rgb };`)();
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const [r, g, b] = rgb(color);
      const fg = lum(r, g, b);
      let worst = 21;
      for (let i = 0; i < data.length; i += 4) worst = Math.min(worst, ratio(fg, lum(data[i], data[i + 1], data[i + 2])));
      return worst;
    },
    { b64: png.toString("base64"), color, src: LUMINANCE_SRC },
  );
}
