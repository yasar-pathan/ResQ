from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape


def point_wkt(latitude: float, longitude: float) -> WKTElement:
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


def point_to_lat_lng(geom) -> tuple[float, float]:
    if geom is None:
        raise ValueError("geometry is required")
    shape = to_shape(geom)
    return float(shape.y), float(shape.x)
