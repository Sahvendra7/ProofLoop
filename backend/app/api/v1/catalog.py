"""Goals, products and per-scan recommendations."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.api import schemas as s
from app.api.deps import current_session, owned_scan
from app.core.errors import AppError
from app.db.models import SessionRow
from app.db.session import get_db
from app.domain.catalog import load_catalog
from app.domain.metrics import GOALS, GOALS_BY_KEY
from app.domain.recommend import Preferences, recommend

router = APIRouter(tags=["catalog"])


@router.get("/goals", response_model=list[s.GoalOut])
def list_goals() -> list[s.GoalOut]:
    return [p.goal_out(g) for g in GOALS]


@router.get("/products", response_model=s.CatalogOut)
def list_products() -> s.CatalogOut:
    catalog = load_catalog()
    return s.CatalogOut(disclaimer=catalog.disclaimer, products=[p.product_out(x) for x in catalog.products])


@router.get("/products/{product_id}", response_model=s.ProductOut)
def get_product(product_id: str) -> s.ProductOut:
    product = load_catalog().get(product_id)
    if product is None:
        raise AppError("product_not_found", "Product not found.", 404)
    return p.product_out(product)


@router.get("/scans/{scan_id}/recommendations", response_model=s.RecommendationOut)
def get_recommendations(
    scan_id: str,
    goal: str = Query(..., max_length=32),
    budget_max: float | None = Query(None, gt=0, le=10_000),
    fragrance_free: bool = Query(False),
    finish: Literal["light", "rich"] | None = Query(None),
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
) -> s.RecommendationOut:
    scan = owned_scan(db, session, scan_id)
    if scan.status != "complete":
        raise AppError("scan_not_complete", "This scan has no results yet.", 409)
    goal_def = GOALS_BY_KEY.get(goal)
    if goal_def is None:
        raise AppError("unknown_goal", f"'{goal}' isn't a supported focus.", 422)
    catalog = load_catalog()
    result = recommend(
        p.scores_of(scan),
        goal,
        catalog,
        Preferences(budget_max=budget_max, fragrance_free=fragrance_free, finish=finish),
    )
    return p.recommendation_out(scan, goal_def, result, catalog.disclaimer)
