# YouCam API Skin AI & eCommerce VTO Hackathon Research

## Official Challenge Requirements
- Integrate at least one YouCam API into a functional web or mobile prototype.
- Delivers clear consumer value.
- Topics: Skin AI or eCommerce VTO (Virtual Try-On).
- "Skin AI: Use YouCam's Skin AI, alone or combined with other YouCam APIs, to help users understand their skin and know exactly what to do next."

## Official Judging Criteria
- Technological Implementation (YouCam API integration must be central).
- Design (looks and behaves like a finished consumer product).
- Potential Impact (problem immediately understandable).
- Quality of Idea (closed-loop concept memorable).

## Relevant YouCam APIs
- **Skin Analysis API**: Returns scores for ~14-16 skin concerns (Hydration, Oiliness, Redness, Texture, Pores, Acne, Dark Circles, etc.).
- **Integration Flow**:
  1. Upload image to get a pre-signed URL (File API).
  2. Upload image to the URL.
  3. Create AI task via YouCam API.
  4. Poll task status.
  5. Retrieve and parse structured JSON results.

## API Integration Notes
- Rate Limiting / Credits: Uses a credit-based system.
- Auth: API Key required.
- Sandbox: Needs a fallback "Demo Mode" when API keys are missing or invalid, explicitly labeled as demo to maintain trust.

## Competitor / Previous Winner Observations
- Many apps do "Selfie -> Recommendation" in one step.
- They lack a feedback loop to see if products worked over time.

## Product Differentiation Opportunities
- **ProofLoop**: A measurable skincare commerce loop.
- Core journey: Scan -> Understand -> Choose Goal -> Shop -> Visualize -> Track -> Verify.
- Not a medical tool: Focus on "appearance" and cosmetic concerns.
- Deterministic, explainable product recommendations.
- Longitudinal tracking (Baseline vs. Day X).
