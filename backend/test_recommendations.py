from app.services.recommendation import generate_recommendations
from app.models.schemas import SkinMeasurements

def test_recommendation_logic():
    # Test a scenario where hydration is low and goal is Hydration
    measurements = SkinMeasurements(
        hydration=30,
        oiliness=40,
        redness=20,
        texture=20,
        pores=20,
        acne=10,
        dark_circles=10
    )
    
    recs = generate_recommendations(measurements, "Hydration")
    assert len(recs) > 0
    assert recs[0].product.name == "Hydro-Barrier Gel Cream"
    assert recs[0].match_score >= 80

def test_recommendation_filtering():
    # Test a scenario where a non-matching goal returns fewer or specific results
    measurements = SkinMeasurements(
        hydration=80,
        oiliness=80,
        redness=20,
        texture=20,
        pores=20,
        acne=10,
        dark_circles=10
    )
    
    recs = generate_recommendations(measurements, "Oil control")
    assert any(r.product.name == "Clarity BHA Liquid" for r in recs)

def test_overall_appearance_goal():
    measurements = SkinMeasurements(
        hydration=50,
        oiliness=50,
        redness=50,
        texture=50,
        pores=50,
        acne=50,
        dark_circles=50
    )
    recs = generate_recommendations(measurements, "Overall skin appearance")
    # All products have some overall benefit or are captured by the loop
    assert len(recs) > 0
