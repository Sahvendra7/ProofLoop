from typing import List, Dict
from app.models.schemas import Product, SkinMeasurements, Recommendation

# Static Product Catalogue (Source of Truth)
PRODUCTS = [
    Product(
        id="prod_1",
        name="Hydro-Barrier Gel Cream",
        brand="DermaLoop",
        price=32.00,
        category="Moisturizer",
        description="A lightweight gel cream that deeply hydrates without leaving a greasy finish. Perfect for combination skin.",
        ingredients=["Hyaluronic Acid", "Ceramides", "Glycerin"],
        texture="Lightweight Gel",
        target_concerns=["Dryness", "Dehydration", "Redness"],
        suitable_goals=["Hydration", "Oil control"],
        routine_step="Moisturize",
        image="/products/hydro-barrier.jpg"
    ),
    Product(
        id="prod_2",
        name="Clarity BHA Liquid",
        brand="DermaLoop",
        price=28.00,
        category="Exfoliant",
        description="Gentle leave-on exfoliant that clears pores, reduces breakouts, and smooths skin texture.",
        ingredients=["Salicylic Acid 2%", "Green Tea Extract"],
        texture="Liquid",
        target_concerns=["Pores", "Acne", "Texture"],
        suitable_goals=["Pore appearance", "Texture appearance", "Oil control"],
        routine_step="Treat",
        image="/products/clarity-bha.jpg"
    ),
    Product(
        id="prod_3",
        name="Calm & Restore Serum",
        brand="DermaLoop",
        price=45.00,
        category="Serum",
        description="Soothing serum designed to visibly reduce redness and strengthen the skin barrier.",
        ingredients=["Centella Asiatica", "Niacinamide", "Panthenol"],
        texture="Milky Serum",
        target_concerns=["Redness", "Sensitivity"],
        suitable_goals=["Redness appearance", "Overall skin appearance"],
        routine_step="Treat",
        image="/products/calm-restore.jpg"
    ),
    Product(
        id="prod_4",
        name="Radiance Vitamin C Drops",
        brand="DermaLoop",
        price=55.00,
        category="Serum",
        description="Brightening serum that evens skin tone and protects against environmental stressors.",
        ingredients=["Vitamin C 15%", "Vitamin E", "Ferulic Acid"],
        texture="Light Serum",
        target_concerns=["Dullness", "Dark Circles", "Texture"],
        suitable_goals=["Overall skin appearance", "Texture appearance"],
        routine_step="Treat",
        image="/products/radiance-c.jpg"
    )
]

def generate_recommendations(measurements: SkinMeasurements, goal: str) -> List[Recommendation]:
    """
    Deterministic recommendation logic based on measurements and goal.
    """
    recommendations = []
    
    for product in PRODUCTS:
        # Step 1: Check if product supports the goal
        if goal not in product.suitable_goals and "Overall skin appearance" not in product.suitable_goals:
            continue
            
        score = 60 # Base score for matching the goal
        reasons = [f"Supports your '{goal}' goal."]
        
        # Step 2: Adjust score based on relevant measurements
        if "Hydration" in product.suitable_goals:
            if measurements.hydration < 50:
                score += 20
                reasons.append("Targets your currently low hydration levels.")
            else:
                score -= 10
                
        if "Oil control" in product.suitable_goals:
            if measurements.oiliness > 60:
                score += 25
                reasons.append("Helps balance your higher oiliness levels.")
                
        if "Pore appearance" in product.suitable_goals:
            if measurements.pores > 50:
                score += 20
                reasons.append("Formulated to refine pore appearance.")
                
        if "Redness appearance" in product.suitable_goals:
            if measurements.redness > 50:
                score += 20
                reasons.append("Contains soothing ingredients to reduce measured redness.")
                
        if "Texture appearance" in product.suitable_goals:
            if measurements.texture > 50: # Assuming higher texture score means rougher texture here
                score += 15
                reasons.append("Improves uneven skin texture.")

        if "Overall skin appearance" in product.suitable_goals and goal == "Overall skin appearance":
            score += 10
            
        # Ensure score is capped
        score = min(score, 99)
        
        if score > 65:
            recommendations.append(
                Recommendation(
                    product=product,
                    match_score=score,
                    explanation=reasons
                )
            )
            
    # Sort by match score descending
    recommendations.sort(key=lambda x: x.match_score, reverse=True)
    return recommendations
