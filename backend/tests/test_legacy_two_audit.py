from operations.management.commands.audit_legacy_two import IDS, blocker

def test_exact_scope_and_dependencies():
    assert list(IDS.values()) == [18,19,23,24,25,42,51,52,54,58,62,63,64,65,68]
    assert len(IDS) == 15
    assert "G4" in blocker(35)
    assert "Canvas 63" in blocker(61)
    assert "denominadores" in blocker(74)
    assert "homologação" in blocker(78)
