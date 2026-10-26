# 24 — Gemini API terms review for a public release (2026-10-26)

**Purpose.** Can ProofLoop's free-text assistant (Gemini picks approved explanation IDs; the server renders the text)
be switched on for the public production site under Google's current terms?

**Scope.** This is an engineering reading of public documents, not legal advice. Where a clause is ambiguous it says
so, and nothing here is presented as approval from Google.

## Sources (read 2026-10-26)

| Source | URL | Version |
|---|---|---|
| Gemini API Additional Terms of Service | https://ai.google.dev/gemini-api/terms | Effective 2026-03-23, page updated 2026-04-28 |
| Available regions | https://ai.google.dev/gemini-api/docs/available-regions | Updated 2026-10-22 |
| Generative AI Prohibited Use Policy | https://policies.google.com/terms/generative-ai/use-policy | Modified 2024-12-17 |
| Gemini API pricing | https://ai.google.dev/gemini-api/docs/pricing | Read 2026-10-26 |
| Rate limits | https://ai.google.dev/gemini-api/docs/rate-limits | Read 2026-10-26 |
| Anthropic: organizations serving minors (alternative provider) | https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors | Dated 2026-03-16 |

## What is actually sent today

Checked by capturing the request the code builds (no external call):

- **Top-level keys:** `systemInstruction`, `contents` and `generationConfig`. About 2.4 KB.
- **`contents`:** the user's question only, with emails and phone numbers replaced by `[email]` and `[phone]`.
- **`systemInstruction`:** the routing instruction plus the IDs and one-line descriptions of the topics eligible for the
  trial.
- **Not sent:** trial data, scores, IDs, dates, photos or session tokens. The key is sent only in the
  `x-goog-api-key` header.
- **Never reaches Gemini:** medical, causal, predictive, product, rule-override, result-location and very short vague
  questions are answered by fixed rules first.
- **What can still reach it:** free text the user types, for example "my cheek looks blotchy…", names or places. The
  sanitiser removes only emails and phone numbers.

## B1 — Age

> "You must be 18 years of age or older to use the APIs." You also will not use the Services as part of an API
> client "that is directed towards or is likely to be accessed by individuals under the age of 18." (Age
> Requirements)

- **Design and deployment today:** the public site has no account and no site-wide age gate. It is a skincare and
  selfie product, and one of its goals is blemishes, so use by under-18s is plausible. The 18+ checkbox appears only at
  the free-text box and is self-attested.
- **Conclusion: unresolved blocker.** A checkbox at the point of use does not change whether the *application* is
  likely to be accessed by under-18s.
- **What would resolve it:**
  - (a) a defensible, documented determination that the whole site is adult-only (adult positioning, a site-wide age
    gate, terms), confirmed by qualified review or by Google; or
  - (b) a provider whose terms allow products used by minors with safeguards (see "Routes").
- The developer-age clause (18+) concerns the owner, who has not been asked to confirm it here.

## B2 — Regions

> "You may only access the Services (or make API Clients available to users) within an available region." "You may
> use only Paid Services when making API Clients available to users in the European Economic Area," Switzerland or
> the United Kingdom. (Use Restrictions)

- **Available regions:** the list includes the United States, India and Bangladesh. Countries not on the list are not
  available.
- **Design and deployment today:** the production site is reachable worldwide (Vercel, and Render in Virginia), with
  no geographic restriction. The "not in the EEA, UK or Switzerland" checkbox is self-attestation. The local key is on
  the **unpaid** tier: it hit `GenerateRequestsPerDayPerProjectPerModel-FreeTier = 500` on 2026-10-25.
- **Conclusion: unresolved blocker on the unpaid tier.**
- **Paid Services** (a Cloud project with billing) would satisfy the EEA/CH/UK clause. Serving users in countries that
  are not available still needs a server-side geographic restriction, or an accepted assessment that the API client is
  not "made available" there. Self-attestation alone is not a basis for that.

## B3 — Data use, human review, sensitive information

> Unpaid: Google uses the content you submit and the generated responses "to provide, improve, and develop" its
> products; "human reviewers may read, annotate, and process your API input and output." "Do not submit sensitive,
> confidential, or personal information to the Unpaid Services."
>
> Paid: "Google doesn't use your prompts … or responses to improve our products"; prompts and responses are logged
> "for a limited period of time" solely for abuse monitoring and legal disclosure, and processed under the Data
> Processing Addendum.

- **Design and deployment today:** the payload is minimal, and no trial data or images are sent. But free text can
  include health descriptions (skin symptoms are health data in many jurisdictions) and other personal details that
  the sanitiser does not catch. The consent text correctly tells users that Google may store, use and review
  questions. Even so, the unpaid-tier clause is addressed to the developer: telling users does not permit sending
  sensitive information.
- **Conclusion: unresolved blocker on the unpaid tier.**
- On the paid tier, product-improvement use and human review for improvement do not apply. Limited logging for abuse
  monitoring remains, and the user notice should then be rewritten to describe the paid terms accurately.

## B4 — Consumer-facing use and medical advice

> "Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or
> business purposes, not for consumer use." "You may not use the Services in clinical practice, to provide medical
> advice," or in any manner overseen by, or requiring clearance from, a medical-device regulator. (Use Restrictions)
>
> Prohibited Use Policy 1.8: no automated decisions with a material detrimental impact on individual rights without
> human supervision in high-risk domains, healthcare included.

- **Design today:**
  - Gemini never writes text the user sees, decides nothing, and gives no advice. It classifies a question into
    approved, non-medical explanation topics.
  - Medical questions are routed away from Gemini to a fixed "outside what I can answer" text that says it is not
    medical advice.
  - The product is a cosmetic self-tracking tool, not clinical.
  - Other parts of the terms expressly contemplate API clients being "available to users".
- **Conclusion: probably permitted by the current design, but not definitive.**
  - The "professional or business purposes" wording describes who builds with the API. Whether a solo hackathon
    project counts would need confirmation from Google if relied on.
  - The medical restriction is addressed by design: no medical advice, no clinical use, no automated decisions about
    people.

## Overall

**B1 (age) and B2/B3 (unpaid tier) are material blockers.** The public Gemini feature must stay off. That is the
current production state anyway: production runs `02acade`, which has no assistant code at all.

## Routes to the intended experience (shortest first)

1. **Ship the deterministic assistant now (no third party).**
   - The quick questions and fixed-rule answers involve no external provider, so none of B1–B4 applies.
   - With `GEMINI_FREE_TEXT_ENABLED` unset, the free-text box is hidden and the UI says "answers from your plan".
   - Needs: the owner's go-ahead to commit and deploy.
2. **Gemini paid tier plus an age decision.**
   - Billing on the Cloud project resolves the EEA/CH/UK clause (B2) and the product-improvement and human-review
     concern (B3).
   - Cost at today's price is about **$0.0003 per question**: about 600 input tokens at $0.30/M and about 25 output
     tokens at $2.50/M, so roughly $0.30 per 1,000 questions.
   - B1 still needs a site-wide adult-only determination with qualified review, which is uncertain for a skincare
     product.
   - Needs: the owner's approval of billing, the age decision, and a user notice rewritten for the paid terms.
3. **Alternative provider for the selector (for example Anthropic).**
   - Its published policy allows products accessible to minors with safeguards: age-appropriate safety features, a
     child-safety system prompt, COPPA-style compliance stated publicly, and AI disclosure.
   - Trade-offs:
     - paid API;
     - a new provider integration (structured output via its own API);
     - a full re-evaluation (all three corpora);
     - new consent and disclosure text;
     - the provider's own regional and data terms still to be reviewed.
   - **Not done.** Changing providers needs the owner's decision.

## Addendum (2026-10-26): owner-only prototype deployment

The owner authorised a deployment for **personal testing and demonstration**, with the Gemini path restricted to the
owner by server-side authentication.
- Every `/assistant/ask` request must carry the owner key, checked against `ASSISTANT_OWNER_TOKEN_SHA256` before
  consent, routing, rate limits or any Gemini call.
- Free text is unavailable when the hash is unset.
- Public visitors keep the deterministic quick answers only.

How B1–B4 read for that scope (still not legal advice):

| | Requirement | Owner-only reading |
|---|---|---|
| **B1 (age)** | The API client must not be directed towards, or likely accessed by, under-18s. | The Gemini path is reachable only with the owner's key, so the API client is used only by the owner, who must be 18+. *The owner has not stated their age in this project; confirming it is the owner's responsibility.* |
| **B2 (regions)** | Use only from available regions; outside the EEA/CH/UK on the free tier. | Satisfied only while the owner uses it from an available region outside the EEA, Switzerland and the UK. The server does not enforce location. |
| **B3 (data)** | Free tier: Google may use and human-review inputs; no sensitive or personal information. | The owner types their own questions and must keep sensitive and personal details out. Symptom and medical questions are answered by fixed rules and never sent. |
| **B4 (use)** | For developers building for professional or business purposes; no medical advice. | A developer testing and demonstrating their own prototype; no medical advice by design. |

**Unchanged:** enabling Gemini for the **public** remains blocked by B1 and B2/B3 on the free tier, as above. This
deployment does not resolve those blockers. It avoids them by not offering Gemini to the public.
