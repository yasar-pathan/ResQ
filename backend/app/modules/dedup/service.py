import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.enums import IncidentCategory, IncidentStatus
from app.models.incident import Incident
from app.modules.dedup.scoring import classify_match_score, compute_dedup_score
from app.modules.dedup.spatial_queries import find_nearby_candidates

logger = logging.getLogger(__name__)


class DedupService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def evaluate_after_classification(self, incident: Incident) -> None:
        if incident.status not in (IncidentStatus.classified,):
            return

        radius = float(self.settings.dedup_radius_meters)
        window = int(self.settings.dedup_time_window_minutes)
        candidates = await find_nearby_candidates(
            self.session,
            incident_id=incident.id,
            category=incident.category,
            radius_meters=radius,
            window_minutes=window,
        )
        if not candidates:
            return

        best_match = "none"
        best_parent_id: uuid.UUID | None = None
        best_score = 0.0
        for row in candidates:
            parent_id = row["id"]
            pid = parent_id if isinstance(parent_id, uuid.UUID) else uuid.UUID(str(parent_id))
            other_cat = IncidentCategory(row["category"])
            score = compute_dedup_score(
                distance_meters=float(row["distance_m"]),
                radius_meters=radius,
                created_at=incident.created_at,
                other_created_at=row["created_at"],
                window_minutes=window,
                category=incident.category,
                other_category=other_cat,
                description=incident.description,
                other_description=row["description"],
            )
            match = classify_match_score(score)
            if match == "none":
                continue
            if best_parent_id is None or score > best_score:
                best_score = score
                best_match = match
                best_parent_id = pid

        if best_match == "none" or best_parent_id is None:
            return

        if best_match == "merge":
            incident.status = IncidentStatus.merged
            incident.merged_into_id = best_parent_id
        elif best_match == "possible_duplicate":
            incident.status = IncidentStatus.possible_duplicate
            incident.merged_into_id = best_parent_id
