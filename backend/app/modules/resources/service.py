import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationAppError
from app.core.security import hash_password
from app.db.geo import point_to_lat_lng, point_wkt
from app.models.enums import ResourceStatus
from app.models.resource import Resource
from app.models.user import User, UserRole
from app.modules.resources.schemas import ResourceCreateRequest, ResourceListParams, ResourceUpdateRequest

ALLOWED_STATUS_TRANSITIONS: dict[ResourceStatus, set[ResourceStatus]] = {
    ResourceStatus.available: {ResourceStatus.assigned, ResourceStatus.unavailable},
    ResourceStatus.assigned: {ResourceStatus.available, ResourceStatus.unavailable},
    ResourceStatus.unavailable: {ResourceStatus.available},
}

DEFAULT_RESOURCE_PASSWORD = "RescueGrid2026!"


def serialize_resource(resource: Resource, operator_email: str | None = None) -> dict:
    lat, lng = point_to_lat_lng(resource.location)
    data = {
        "id": str(resource.id),
        "type": resource.type.value,
        "name": resource.name,
        "location": {"latitude": lat, "longitude": lng},
        "capabilities": resource.capabilities,
        "status": resource.status.value,
        "is_active": resource.is_active,
        "operator_user_id": str(resource.operator_user_id) if resource.operator_user_id else None,
        "created_at": resource.created_at.isoformat(),
        "updated_at": resource.updated_at.isoformat(),
    }
    if operator_email:
        data["operator_email"] = operator_email
    return data


class ResourceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, body: ResourceCreateRequest) -> dict:
        operator_user_id = body.operator_user_id
        operator_email: str | None = None

        # Automatically create field_team login credentials for this resource if not linked
        if operator_user_id is None:
            # Generate slug from resource name
            slug = re.sub(r"[^a-zA-Z0-9]+", ".", body.name.lower()).strip(".")
            slug = slug[:30].strip(".") or f"unit.{uuid.uuid4().hex[:6]}"
            base_email = f"{slug}@rescuegrid.in"
            email = base_email

            # Check if email is unique
            existing = await self.session.execute(select(User).where(User.email == email))
            if existing.scalar_one_or_none() is not None:
                email = f"{slug}.{uuid.uuid4().hex[:4]}@rescuegrid.in"

            user = User(
                name=body.name,
                email=email,
                password_hash=hash_password(DEFAULT_RESOURCE_PASSWORD),
                role=UserRole.field_team,
                is_active=True,
            )
            self.session.add(user)
            await self.session.flush()
            operator_user_id = user.id
            operator_email = email
        else:
            op_user = await self.session.get(User, operator_user_id)
            if op_user:
                operator_email = op_user.email

        resource = Resource(
            type=body.type,
            name=body.name,
            location=point_wkt(body.location.latitude, body.location.longitude),
            capabilities=body.capabilities,
            status=ResourceStatus.available,
            operator_user_id=operator_user_id,
        )
        self.session.add(resource)
        await self.session.commit()
        await self.session.refresh(resource)
        return serialize_resource(resource, operator_email=operator_email)

    async def list_resources(self, params: ResourceListParams) -> dict:
        stmt = select(Resource)
        if params.type:
            stmt = stmt.where(Resource.type == params.type)
        if params.status:
            stmt = stmt.where(Resource.status == params.status)
        if params.active_only:
            stmt = stmt.where(Resource.is_active.is_(True))
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = stmt.order_by(Resource.name.asc()).offset((params.page - 1) * params.limit).limit(params.limit)
        rows = (await self.session.execute(stmt)).scalars().all()
        return {
            "items": [serialize_resource(r) for r in rows],
            "total": int(total),
            "page": params.page,
            "limit": params.limit,
        }

    async def update(self, resource_id: uuid.UUID, body: ResourceUpdateRequest) -> dict:
        result = await self.session.execute(select(Resource).where(Resource.id == resource_id))
        resource = result.scalar_one_or_none()
        if resource is None:
            raise NotFoundError("Resource not found")

        if body.status is not None and body.status != resource.status:
            allowed = ALLOWED_STATUS_TRANSITIONS.get(resource.status, set())
            if body.status not in allowed:
                raise ValidationAppError(
                    "Invalid resource status transition",
                    details={"from": resource.status.value, "to": body.status.value},
                )
            resource.status = body.status

        if body.name is not None:
            resource.name = body.name
        if body.location is not None:
            resource.location = point_wkt(body.location.latitude, body.location.longitude)
        if body.capabilities is not None:
            resource.capabilities = body.capabilities
        if body.is_active is not None:
            resource.is_active = body.is_active
            if not body.is_active:
                resource.status = ResourceStatus.unavailable
        if body.operator_user_id is not None:
            resource.operator_user_id = body.operator_user_id

        await self.session.commit()
        await self.session.refresh(resource)
        return serialize_resource(resource)

    async def delete(self, resource_id: uuid.UUID) -> None:
        from app.models.assignment import Assignment
        from sqlalchemy import delete as sa_delete

        result = await self.session.execute(select(Resource).where(Resource.id == resource_id))
        resource = result.scalar_one_or_none()
        if resource is None:
            raise NotFoundError("Resource not found")

        # Clean up any assignments referencing this resource
        await self.session.execute(sa_delete(Assignment).where(Assignment.resource_id == resource_id))
        await self.session.delete(resource)
        await self.session.commit()

