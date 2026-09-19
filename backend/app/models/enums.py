import enum


class IncidentCategory(str, enum.Enum):
    fire = "fire"
    flood = "flood"
    industrial_accident = "industrial_accident"
    road_incident = "road_incident"
    medical = "medical"
    personal_safety = "personal_safety"
    other = "other"


class IncidentSource(str, enum.Enum):
    citizen_web = "citizen_web"
    sos = "sos"
    sensor = "sensor"
    call = "call"
    field_team = "field_team"


class IncidentPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, enum.Enum):
    reported = "reported"
    classified = "classified"
    possible_duplicate = "possible_duplicate"
    merged = "merged"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class ClassificationSource(str, enum.Enum):
    llm = "llm"
    fallback = "fallback"


class MediaType(str, enum.Enum):
    photo = "photo"
    audio = "audio"


class ResourceType(str, enum.Enum):
    team = "team"
    vehicle = "vehicle"
    equipment = "equipment"
    facility = "facility"


class ResourceStatus(str, enum.Enum):
    available = "available"
    assigned = "assigned"
    unavailable = "unavailable"


class AssignmentDecision(str, enum.Enum):
    accepted_ai = "accepted_ai"
    overridden = "overridden"
    manual = "manual"


class AssignmentStatus(str, enum.Enum):
    proposed = "proposed"
    confirmed = "confirmed"
    en_route = "en_route"
    on_scene = "on_scene"
    completed = "completed"
    cancelled = "cancelled"


class AlertType(str, enum.Enum):
    critical_incident = "critical_incident"
    delayed_response = "delayed_response"
    escalation_required = "escalation_required"


class AlertStatus(str, enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"


class NotificationTargetType(str, enum.Enum):
    user = "user"
    trusted_contact = "trusted_contact"


class NotificationChannel(str, enum.Enum):
    email = "email"
    sms_simulated = "sms_simulated"
    push_simulated = "push_simulated"


class NotificationStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    failed = "failed"
    failed_permanent = "failed_permanent"


class QueueStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"
