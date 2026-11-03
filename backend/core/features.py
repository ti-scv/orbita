"""Per-unit feature switches."""


def unit_feature_enabled(unit, feature):
    if feature not in ("checkin", "autoagenda", "surveys"):
        raise ValueError("Recurso de unidade desconhecido.")
    return bool(unit and getattr(unit, feature + "_enabled", False))
