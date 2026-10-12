"""Product catalogue: loaded from app/data/catalog.json and validated at startup.

This is a fictional sample catalogue for demonstration. Ingredient roles are the
commonly cited cosmetic functions of each ingredient, not efficacy claims.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.metrics import METRICS_BY_KEY

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "catalog.json"


class Ingredient(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    role: str


class Caution(BaseModel):
    model_config = ConfigDict(frozen=True)
    # Shown when the user's measurement for this metric is in the attention band.
    when_low: str
    note: str


class Product(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str
    name: str
    brand: str
    category: str
    routine_step: Literal["cleanse", "treat", "moisturize", "protect"]
    price: float = Field(gt=0)
    size_ml: int = Field(gt=0)
    texture: str
    finish: Literal["light", "rich"]
    fragrance_free: bool
    description: str
    key_ingredients: list[Ingredient] = Field(min_length=1)
    primary_targets: list[str] = Field(min_length=1)
    secondary_targets: list[str] = Field(default_factory=list)
    cautions: list[Caution] = Field(default_factory=list)
    palette: list[str] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def _known_metrics(self) -> Product:
        for key in [*self.primary_targets, *self.secondary_targets, *(c.when_low for c in self.cautions)]:
            if key not in METRICS_BY_KEY:
                raise ValueError(f"{self.id}: unknown metric '{key}'")
        if set(self.primary_targets) & set(self.secondary_targets):
            raise ValueError(f"{self.id}: a metric cannot be both primary and secondary")
        return self


class Catalog(BaseModel):
    disclaimer: str
    products: list[Product]

    @model_validator(mode="after")
    def _unique_ids(self) -> Catalog:
        ids = [p.id for p in self.products]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate product ids")
        return self

    def get(self, product_id: str) -> Product | None:
        return next((p for p in self.products if p.id == product_id), None)


@lru_cache
def load_catalog(path: Path = CATALOG_PATH) -> Catalog:
    return Catalog.model_validate(json.loads(path.read_text(encoding="utf-8")))
