# Asset credits

Every third-party image in the product, where it came from, and the terms it is used under. Checked 2026-10-12.

## Photography

### Hero: "Woman Engaging in Morning Skincare Routine"

| | |
|---|---|
| File | `frontend/public/images/editorial/mirror-check-1120.webp` (1120×1400, 50 KB, SHA-256 `a0fa35b4…c66d7`) |
| Used in | Homepage hero (`frontend/src/app/page.tsx`, `Hero`) |
| Source page | https://www.pexels.com/photo/person-woman-relaxation-sitting-6417915/ |
| Creator | Pavel Danilyuk (Pexels) |
| Original | 4343×6514, published on Pexels 6 Jan 2021. Downloaded from the Pexels CDN at 1600 px wide |
| Licence | Pexels License: https://www.pexels.com/license/ (the photo page shows "License: Free") |
| Attribution | Not required by the licence. We credit the photographer visibly under the photo anyway |
| Changes made | Cropped to 4:5 (top 60 px trimmed; most of the vanity removed), resized to 1120 px, re-encoded as WebP q74, metadata stripped |

**Licence terms that apply** (from the Pexels License page, read 2026-10-12):
- Free to use and modify. Attribution is appreciated but not required.
- Not allowed: showing identifiable people in a bad light or an offensive way; implying that people or brands in the image endorse a product; selling unaltered copies; redistributing on stock or wallpaper sites; using the image as part of a trademark, business name or service mark.

**How we comply**
- The caption reads "Editorial photo by Pavel Danilyuk on Pexels. Not a ProofLoop user or result." This states plainly that the person is not a customer and does not endorse ProofLoop.
- The photo is never used as a scan input, scan result, before/after, testimonial or evidence. The phone mockup beside it carries its own "Sample data" label.
- The photo is not part of the logo or any brand mark.
- The products on the vanity have blank or unreadable labels; no brand is identifiable in the crop.
- The file is served from our own origin. We do not hotlink pexels.com.

### Candidates rejected

| Candidate | Why it was rejected |
|---|---|
| Unsplash `9vGsSYyDeVM` (PlantaDea) | Brand marketing for a real cosmetics company; the branded product is the subject |
| Unsplash `FODRyogbNU0` and similar straight-on studio portraits | They read like a scan photo, so they could be mistaken for a user's result |
| Unsplash `_Yca73BgigE` (golden-hour freckles portrait) | Licence verified (Unsplash License), but a beach and swimwear context; not needed once the hero was chosen |
| Unsplash/Pexels images labelled "Unsplash+" | Paid licence; not used |

No supporting lifestyle images were added. The hero was the only place where a photo clearly improved the page.

## Illustrations and other assets

- Product art (`frontend/src/components/product-art.tsx`), phone mockups (`previews.tsx`), the logo and all charts are original SVG/CSS made for this project. Product art is a concept illustration of a fictional catalogue: its accessible name is "Illustration of …", and the product page says "Sample catalogue: this is a fictional product … It isn't for sale." The matches list shows the art without a visible "illustration" label (see `final-audit.md`).
- `frontend/e2e/fixtures/synthetic-portrait.png` is a synthetic test fixture, not a photograph of a person.
- `test-face.jpg` (repo root, git-ignored) is a local test capture of undocumented origin. It is **not** used in the product and should not be used for marketing.
