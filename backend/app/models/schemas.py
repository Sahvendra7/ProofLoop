from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SkinMeasurements(BaseModel):
    hydration: int
    oiliness: int
    redness: int
    texture: int
    pores: int
    acne: int
    dark_circles: int

class ScanResult(BaseModel):
    id: str
    measurements: SkinMeasurements
    raw_response: Optional[Dict[str, Any]] = None
    is_demo: bool = False

class Product(BaseModel):
    id: str
    name: str
    brand: str
    price: float
    category: str
    description: str
    ingredients: List[str]
    texture: str
    target_concerns: List[str]
    suitable_goals: List[str]
    routine_step: str
    image: str

class Recommendation(BaseModel):
    product: Product
    match_score: int
    explanation: List[str]

class RecommendationResponse(BaseModel):
    recommendations: List[Recommendation]
    goal: str

class Baseline(BaseModel):
    id: str
    scan_id: str
    measurements: SkinMeasurements
    created_at: str

class ProgressComparison(BaseModel):
    baseline: Baseline
    current: ScanResult
    deltas: Dict[str, int]
