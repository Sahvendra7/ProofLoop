# ProofLoop

> Know your skin. Shop with confidence. Measure what changes.

## The Problem
Skincare shopping today is recommendation-heavy but feedback-poor. People can receive hundreds of product suggestions, but rarely have a measurable way to understand what their skin currently looks like, why a specific product was selected, what they are trying to improve, or what actually changed a month later.

## The Key Insight
**The best skincare recommendation is not the end of the journey. It is the beginning of a measurable loop.**

## The Solution
**ProofLoop** combines:
- AI Skin Analysis (YouCam)
- Explainable Recommendations
- Goal Visualization
- Longitudinal Measurement

...into one continuous loop: **Measure → Understand → Choose → Shop → Visualize → Save Baseline → Re-Measure → Compare.**

## YouCam APIs Used
- **YouCam S2S v2.0 API (File & Task)**: To generate a precise, objective measurement of 14+ skin concerns (hydration, oiliness, redness, texture, pores).
- **Skin Simulation API (UI Ready)**: To visualize potential cosmetic goals without making false promises.

## Architecture
- **Frontend**: Next.js, React, Tailwind CSS (Mobile-first, premium UI).
- **Backend**: Python, FastAPI.
- **Integration**: Backend proxy handles YouCam API auth, async task polling, and data normalization.

## Local Setup

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add your YouCam API keys to .env
uvicorn main:app --reload
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

## Demo Flow
1. **Landing Page**: Introduce the "Know your skin, shop with confidence" message.
2. **Skin Scan**: Upload a selfie. See the real YouCam analysis with consumer-friendly scoring.
3. **Goal Selection**: User selects a focus (e.g., Hydration).
4. **Recommendation**: Explainable product matching based on the goal and skin profile.
5. **Simulation**: See a visualization of the goal.
6. **Save Baseline**: Create a Day 0 snapshot.
7. **Progress Tracking**: Fast-forward to Day 21 and compare a new scan against the baseline to close the loop.
