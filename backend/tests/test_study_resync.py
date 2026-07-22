"""Unit tests for the progress-preserving CPTS resync (POST /study/resync).

These exercise the pure ``resync_curriculum`` reconcile helper — no DB/session —
so they run without a database. The endpoint is a thin DB wrapper around it.
"""
from app.models.study import CPTS_CURRICULUM, resync_curriculum


def _module(result, title):
    return next(m for m in result if m["title"] == title)


def _section(module, title):
    return next(s for s in module["sections"] if s["title"] == title)


def test_fresh_plan_is_full_curriculum_with_no_progress():
    result = resync_curriculum([])
    assert len(result) == len(CPTS_CURRICULUM) == 28
    assert any(m["title"] == "Getting Started" for m in result)          # module the old seed lacked
    for m in result:
        assert m["completed"] is False and m["obsidian_link"] is None
        assert all(s["completed"] is False and s["obsidian_link"] is None for s in m["sections"])


def test_exact_section_match_carries_completed_and_link():
    snap = [{
        "title": "Penetration Testing Process",
        "completed": False, "completed_at": None, "obsidian_link": None,
        "sections": [
            {"title": "Pre-Engagement", "completed": True, "completed_at": "2026-07-01",
             "obsidian_link": "obsidian://pre"},
        ],
    }]
    ptp = _module(resync_curriculum(snap), "Penetration Testing Process")
    pe = _section(ptp, "Pre-Engagement")
    assert pe["completed"] is True
    assert pe["obsidian_link"] == "obsidian://pre"
    assert pe["completed_at"] == "2026-07-01"


def test_prefix_match_carries_completion_but_not_the_link():
    # The degraded seed titled this section "Introduction"; the canonical title is
    # "Introduction to the Penetration Tester Path" — a prefix match.
    snap = [{
        "title": "Penetration Testing Process",
        "completed": False, "completed_at": None, "obsidian_link": None,
        "sections": [
            {"title": "Introduction", "completed": True, "completed_at": "2026-07-01",
             "obsidian_link": "obsidian://intro"},
        ],
    }]
    ptp = _module(resync_curriculum(snap), "Penetration Testing Process")
    intro = _section(ptp, "Introduction to the Penetration Tester Path")
    assert intro["completed"] is True            # completion is recovered
    assert intro["obsidian_link"] is None        # but a title-specific link is not moved


def test_obsolete_rows_are_dropped_and_new_ones_start_clean():
    snap = [{
        "title": "Penetration Testing Process",
        "completed": False, "completed_at": None, "obsidian_link": None,
        "sections": [
            {"title": "A Removed Section", "completed": True, "completed_at": "x",
             "obsidian_link": "obsidian://gone"},
        ],
    }]
    ptp = _module(resync_curriculum(snap), "Penetration Testing Process")
    assert all(s["title"] != "A Removed Section" for s in ptp["sections"])
    practice = _section(ptp, "Practice")          # a section the old seed lacked
    assert practice["completed"] is False and practice["obsidian_link"] is None


def test_file_inclusion_gets_the_corrected_htb_url():
    fi = _module(resync_curriculum([]), "File Inclusion")
    assert fi["htb_url"] == "https://academy.hackthebox.com/module/details/23"


def test_resync_is_idempotent():
    snap = [{
        "title": "Penetration Testing Process",
        "completed": False, "completed_at": None, "obsidian_link": None,
        "sections": [
            {"title": "Pre-Engagement", "completed": True, "completed_at": "2026-07-01",
             "obsidian_link": "obsidian://pre"},
            {"title": "Introduction", "completed": True, "completed_at": None, "obsidian_link": None},
        ],
    }]
    once = resync_curriculum(snap)
    # Feed the rebuilt plan back in — completion + links must stay stable.
    again = resync_curriculum([
        {"title": m["title"], "completed": m["completed"], "completed_at": m["completed_at"],
         "obsidian_link": m["obsidian_link"], "sections": m["sections"]}
        for m in once
    ])
    ptp = _module(again, "Penetration Testing Process")
    assert _section(ptp, "Pre-Engagement")["obsidian_link"] == "obsidian://pre"
    assert _section(ptp, "Pre-Engagement")["completed"] is True
    assert _section(ptp, "Introduction to the Penetration Tester Path")["completed"] is True
