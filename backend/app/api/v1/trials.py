"""Trials: a baseline scan + chosen goal + chosen product, compared against later check-ins."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.api import schemas as s
from app.api.deps import current_session, owned_scan, owned_trial
from app.core.errors import AppError
from app.db.models import ScanRow, SessionRow, TrialRow, utcnow
from app.db.session import get_db
from app.domain.catalog import load_catalog
from app.domain.compare import NOISE_BANDS, compare
from app.domain.metrics import GOALS_BY_KEY
from app.services import demo

router = APIRouter(prefix="/trials", tags=["trials"])


def _trial_out(db: Session, trial: TrialRow) -> s.TrialOut:
    now = utcnow()
    goal = GOALS_BY_KEY[trial.goal]
    product = load_catalog().get(trial.product_id)
    if product is None:
        raise AppError("product_not_found", "This trial's product is no longer in the catalogue.", 410)
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    checkins = db.scalars(
        select(ScanRow)
        .where(ScanRow.trial_id == trial.id, ScanRow.id != baseline.id, ScanRow.provenance == trial.provenance)
        .order_by(ScanRow.observed_at.asc())
    ).all()
    complete = [c for c in checkins if c.status == "complete"]

    history = [
        s.HistoryPointOut(
            scan_id=baseline.id,
            observed_at=p.capture_of(baseline).captured_at,
            focus_score=p.scores_of(baseline).get(goal.metric),
            synthetic=False,
            is_baseline=True,
        )
    ] + [
        s.HistoryPointOut(
            scan_id=c.id,
            observed_at=p.capture_of(c).captured_at,
            focus_score=p.scores_of(c).get(goal.metric),
            synthetic=c.synthetic_timeline,
            is_baseline=False,
        )
        for c in complete
    ]

    comparison = None
    if complete:
        latest = complete[-1]
        result = compare(
            p.scores_of(baseline), p.scores_of(latest), p.capture_of(baseline), p.capture_of(latest), goal.metric
        )
        comparison = p.comparison_out(latest, result)

    return s.TrialOut(
        id=trial.id,
        provenance=p.provenance(trial.provenance, trial=True),
        goal=p.goal_out(goal),
        product=p.product_out(product),
        created_at=p._aware(trial.created_at),
        baseline=p.scan_out(baseline, now),
        checkins=[p.scan_out(c, now) for c in checkins],
        history=history,
        comparison=comparison,
        focus_noise_band=NOISE_BANDS[goal.metric],
    )


@router.post("", response_model=s.TrialOut, status_code=status.HTTP_201_CREATED)
def create_trial(body: s.TrialCreateIn, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    scan = owned_scan(db, session, body.scan_id)
    if scan.status != "complete":
        raise AppError("scan_not_complete", "A trial needs a completed scan as its baseline.", 409)
    if scan.synthetic_timeline:
        raise AppError("invalid_baseline", "A synthetic follow-up can't be a baseline.", 409)
    goal = GOALS_BY_KEY.get(body.goal)
    if goal is None:
        raise AppError("unknown_goal", f"'{body.goal}' isn't a supported focus.", 422)
    if goal.metric not in p.scores_of(scan):
        raise AppError("metric_missing", "This scan has no measurement for that focus.", 409)
    if load_catalog().get(body.product_id) is None:
        raise AppError("product_not_found", "Product not found.", 404)
    trial = TrialRow(
        session_id=session.id,
        provenance=scan.provenance,
        goal=goal.key,
        product_id=body.product_id,
        baseline_scan_id=scan.id,
    )
    db.add(trial)
    db.flush()
    return _trial_out(db, trial)


@router.get("", response_model=list[s.TrialSummaryOut])
def list_trials(session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    trials = db.scalars(
        select(TrialRow).where(TrialRow.session_id == session.id).order_by(TrialRow.created_at.desc())
    ).all()
    catalog = load_catalog()
    out = []
    for t in trials:
        product = catalog.get(t.product_id)
        count = len(db.scalars(select(ScanRow.id).where(ScanRow.trial_id == t.id, ScanRow.status == "complete")).all())
        out.append(
            s.TrialSummaryOut(
                id=t.id,
                baseline_scan_id=t.baseline_scan_id,
                provenance=p.provenance(t.provenance, trial=True),
                goal=p.goal_out(GOALS_BY_KEY[t.goal]),
                product_name=product.name if product else t.product_id,
                created_at=p._aware(t.created_at),
                checkin_count=count,
            )
        )
    return out


@router.get("/{trial_id}", response_model=s.TrialOut)
def get_trial(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    return _trial_out(db, owned_trial(db, session, trial_id))


@router.post("/{trial_id}/demo-checkin", response_model=s.TrialOut, status_code=status.HTTP_201_CREATED)
def demo_checkin(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    trial = owned_trial(db, session, trial_id)
    if trial.provenance != "demo":
        raise AppError(
            "provenance_mismatch",
            "Synthetic follow-ups are only available for sample-data trials. Real trials need a real check-in scan.",
            409,
        )
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    db.add(demo.build_demo_followup(baseline, trial.id))
    db.flush()
    return _trial_out(db, trial)


@router.delete("/{trial_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trial(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    db.delete(owned_trial(db, session, trial_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
