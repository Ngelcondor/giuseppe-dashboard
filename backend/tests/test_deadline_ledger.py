"""Deadline ledger: parity with the Scadenze view + the bank auto-tick matcher.

Parity fixtures are the ones used to check the UI by eye (29/09/2026): the
month headers read Settembre "Da pagare €288 / €298,99", Agosto "Non pagato
€42 / €220,99", Luglio "Saldato €60,99". The matcher cases are real bank
strings from the prod feed.
"""
import uuid
from datetime import date
from types import SimpleNamespace

from app.services.deadline_ledger import (
    TxLite,
    in_range,
    match_terms,
    occurrences_between,
    propose_matches,
    rows_for,
    totals,
    ui_rows,
)

TODAY = date(2026, 9, 29)


def dl(title, due, amount=None, rt="none", total=None, paid=0, interval=None, done=False, occ=None, auto=None):
    return SimpleNamespace(
        id=uuid.uuid4(), title=title, due_date=date.fromisoformat(due), amount=amount,
        recurrence_type=rt, installments_total=total, installments_paid=paid,
        recurrence_interval=interval, is_completed=done, paid_occurrences=occ,
        auto_paid_occurrences=auto,
    )


FIXTURES = [
    dl("Spotify", "2026-03-05", 10.99, "subscription", interval="monthly",
       occ=["2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05"]),
    dl("HTB Academy", "2026-01-12", 18, "subscription", interval="monthly", occ=["2026-08-12"]),
    dl("MacBook (Klarna)", "2026-08-15", 150, "installments", total=4, occ=["2026-08-15"]),
    dl("Deposito affitto", "2026-09-10", 120),
    dl("Assicurazione moto", "2026-10-20", 80),
    dl("OSCP voucher", "2026-11-15", None),
    dl("Tassa rifiuti", "2026-07-01", 50, done=True),
    dl("Multa ZTL", "2026-08-03", 42),
]


def month(rows, y, m):
    import calendar
    return totals(in_range(rows, date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])))


# ─── parity with the UI ──────────────────────────────────────────────────────

def test_month_totals_match_the_scadenze_headers():
    rows = rows_for(FIXTURES, TODAY)
    sep, aug, jul = month(rows, 2026, 9), month(rows, 2026, 8), month(rows, 2026, 7)
    assert (sep.total, sep.paid, sep.remaining) == (298.99, 10.99, 288.0)
    assert (aug.total, aug.paid, aug.remaining) == (220.99, 178.99, 42.0)
    assert (jul.total, jul.paid, jul.remaining) == (60.99, 60.99, 0.0)


def test_past_subscription_charges_show_only_when_ticked():
    spotify = FIXTURES[0]
    past = [r.date.isoformat() for r in ui_rows(spotify, TODAY) if r.date < date(2026, 9, 1)]
    assert past == ["2026-06-05", "2026-07-05", "2026-08-05"]   # not March–May: never ticked


def test_subscription_projects_twelve_months_from_today():
    rows = ui_rows(FIXTURES[0], TODAY)
    assert max(r.date for r in rows) == date(2027, 9, 5)          # ≤ 29/09/2027
    assert min(r.date for r in rows if r.date >= date(2026, 9, 1)) == date(2026, 9, 5)


def test_installments_step_monthly_and_number_the_rate():
    rows = ui_rows(FIXTURES[2], TODAY)
    assert [(r.date.isoformat(), r.index, r.total, r.paid) for r in rows] == [
        ("2026-08-15", 1, 4, True), ("2026-09-15", 2, 4, False),
        ("2026-10-15", 3, 4, False), ("2026-11-15", 4, 4, False),
    ]


def test_installments_ignore_interval_like_the_frontend():
    # quarterly interval on a rate plan: the UI still spaces rate one month apart
    d = dl("Klarna · Dell", "2026-07-27", 67.43, "installments", total=12, paid=10, interval="quarterly")
    assert [r.date for r in ui_rows(d, TODAY)] == [date(2026, 7, 27), date(2026, 8, 27)]


def test_day_clamping_is_iterative_like_addMonths():
    d = dl("Fine mese", "2026-01-31", 5, "subscription", interval="monthly")
    dates = [r.date for r in occurrences_between(d, date(2026, 1, 1), date(2026, 4, 30))]
    assert dates == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 28), date(2026, 4, 28)]


def test_json_null_paid_occurrences_is_empty():
    d = dl("Rata", "2026-09-10", 10, "installments", total=2)
    d.paid_occurrences = "null"          # JSON scalar seen in prod
    assert all(not r.paid for r in ui_rows(d, TODAY))


def test_settled_plan_collapses_to_one_paid_row():
    d = dl("Scalapay · Hetzner", "2026-07-05", 18.21, "installments", total=3, paid=3)
    rows = ui_rows(d, TODAY)
    assert len(rows) == 1 and rows[0].paid and rows[0].date == date(2026, 7, 5)


def test_enum_members_work_like_strings():
    import enum

    class RT(str, enum.Enum):
        SUBSCRIPTION = "subscription"

    d = dl("Iliad", "2026-07-24", 11.90, RT.SUBSCRIPTION, interval=SimpleNamespace(value="monthly"))
    assert [r.date for r in occurrences_between(d, date(2026, 8, 1), date(2026, 9, 30))] == [
        date(2026, 8, 24), date(2026, 9, 24)]


# ─── matcher ─────────────────────────────────────────────────────────────────

def tx(desc, amount, day, merchant=None):
    return TxLite(uuid.uuid4(), date.fromisoformat(day), amount, f"{desc} {merchant or desc}".lower())


def occ(d, day):
    return next(r for r in occurrences_between(d, date(2026, 1, 1), date(2027, 12, 31)) if r.date.isoformat() == day)


def test_match_terms_split_payee_and_detail():
    assert match_terms("Klarna - gearup") == ({"klarna"}, {"gearup"})
    assert match_terms("Cofidis · Amazon") == ({"cofidis"}, {"amazon"})
    assert match_terms("iCloud+")[0] == {"icloud", "apple.com/bill"}
    assert match_terms("LOANEY prestito") == ({"loaney"}, set())


def test_klarna_merchant_charge_ticks_its_plan():
    plan = dl("Klarna - gearup", "2026-09-14", 19.95, "installments", total=3, paid=2)
    assert len(propose_matches([occ(plan, "2026-09-14")], [tx("Klarna*gearup Booste", 19.95, "2026-09-04")])) == 1
    # 15+ days away: outside the ±14 window
    assert propose_matches([occ(plan, "2026-09-14")], [tx("Klarna*gearup Booste", 19.95, "2026-08-29")]) == []


def test_paypal_pay_in_3_matches_on_provider_and_amount_only():
    plan = dl("Paypal - Transavia", "2026-08-31", 22.00, "installments", total=3)
    pairs = propose_matches([occ(plan, "2026-08-31")], [tx("Paypal *paga In 3 Rate", 22.0, "2026-08-31")])
    assert len(pairs) == 1


def test_cofidis_one_day_early_and_cent_rounding():
    plan = dl("Cofidis - amazon", "2026-08-19", 20.50, "installments", total=4, paid=1)
    assert len(propose_matches([occ(plan, "2026-08-19")], [tx("Cofidis Amazon", 20.5, "2026-08-18")])) == 1
    ae = dl("Paypal - AE settembre 2", "2026-09-24", 34.18, "installments", total=3)
    assert len(propose_matches([occ(ae, "2026-09-24")], [tx("Paypal *paga In 3 Rate", 34.19, "2026-09-22")])) == 1


def test_klarna_rata_for_hetzner_does_not_tick_the_hetzner_subscription():
    hetzner = dl("Hetzner", "2026-07-08", 51.89, "subscription", interval="monthly")
    assert propose_matches([occ(hetzner, "2026-09-08")], [tx("Klarna*hetzner", 7.79, "2026-09-04")]) == []


def test_klarna_subscription_does_not_absorb_rate_charges():
    plus = dl("Klarna", "2026-10-04", 4.99, "subscription", interval="monthly")
    charges = [tx("Klarna*lootbar", 5.04, "2026-10-03"), tx("Klarna*klarna", 20.98, "2026-10-04")]
    assert propose_matches([occ(plus, "2026-10-04")], charges) == []


def test_same_amount_plans_each_take_the_nearest_charge():
    intesa = dl("Paypal - IntesaSP 1", "2026-08-23", 36.45, "installments", total=3)
    ae = dl("Paypal - AE settembre 1", "2026-08-20", 36.45, "installments", total=3)
    t1, t2 = tx("Paypal *paga In 3 Rate", 36.45, "2026-08-18"), tx("Paypal *paga In 3 Rate", 36.45, "2026-08-24")
    pairs = propose_matches([occ(intesa, "2026-08-23"), occ(ae, "2026-08-20")], [t1, t2])
    got = {r.deadline.title: t.date.isoformat() for r, t in pairs}
    assert got == {"Paypal - IntesaSP 1": "2026-08-24", "Paypal - AE settembre 1": "2026-08-18"}


def test_one_charge_ticks_at_most_one_occurrence():
    a = dl("Paypal - IntesaSP 1", "2026-08-23", 36.45, "installments", total=3)
    b = dl("Paypal - AE settembre 1", "2026-08-23", 36.45, "installments", total=3)
    pairs = propose_matches([occ(a, "2026-08-23"), occ(b, "2026-08-23")], [tx("Paypal *paga In 3 Rate", 36.45, "2026-08-23")])
    assert len(pairs) == 1


def test_detail_word_breaks_ties():
    rayban = dl("Klarna - Rayban", "2026-09-10", 20.00, "installments", total=3)
    hinge = dl("Klarna - Hinge", "2026-09-10", 20.00, "installments", total=3)
    t = tx("Klarna*hinge", 20.0, "2026-09-10")
    (r, _), = propose_matches([occ(rayban, "2026-09-10"), occ(hinge, "2026-09-10")], [t])
    assert r.deadline.title == "Klarna - Hinge"


def test_paid_rejected_and_amountless_occurrences_are_skipped():
    plan = dl("Klarna - CK", "2026-09-19", 51.30, "installments", total=3, occ=["2026-09-19"])
    t = tx("Klarna*ck", 51.30, "2026-09-19")
    assert propose_matches([occ(plan, "2026-09-19")], [t]) == []                      # already paid
    fresh = dl("Klarna - CK", "2026-09-19", 51.30, "installments", total=3)
    o = occ(fresh, "2026-09-19")
    assert propose_matches([o], [t], rejected={o.key}) == []                          # user undid it
    nameless = dl("Klarna - CK", "2026-09-19", None, "installments", total=3)
    assert propose_matches([occ(nameless, "2026-09-19")], [t]) == []


def test_icloud_matches_apple_bill():
    icloud = dl("iCloud+", "2026-07-07", 9.99, "subscription", interval="monthly")
    assert len(propose_matches([occ(icloud, "2026-09-07")], [tx("apple.com/bill", 9.99, "2026-09-06")])) == 1


def test_spotify_country_suffix_still_matches():
    spotify = dl("Spotify", "2026-07-20", 6.49, "subscription", interval="monthly")
    assert len(propose_matches([occ(spotify, "2026-08-20")], [tx("Spotifyes", 6.49, "2026-08-20")])) == 1


def test_charge_that_paid_a_hand_ticked_rata_cannot_tick_a_sibling_plan():
    intesa = dl("Paypal - IntesaSP 1", "2026-09-23", 36.45, "installments", total=3, occ=["2026-09-23"])
    ae = dl("Paypal - AE settembre 1", "2026-09-24", 36.45, "installments", total=3)
    only_charge = tx("Paypal *paga In 3 Rate", 36.45, "2026-09-23")
    assert propose_matches([occ(intesa, "2026-09-23"), occ(ae, "2026-09-24")], [only_charge]) == []
    second = tx("Paypal *paga In 3 Rate", 36.45, "2026-09-24")
    (r, t), = propose_matches([occ(intesa, "2026-09-23"), occ(ae, "2026-09-24")], [only_charge, second])
    assert r.deadline.title == "Paypal - AE settembre 1" and t is second


def test_scalapay_plans_funded_through_paypal_match_with_drifted_dates():
    plan = dl("Scalapay · Ryanair", "2026-07-22", 15.99, "installments", total=3)
    assert len(propose_matches([occ(plan, "2026-07-22")], [tx("Paypal *paga In 3 Rate", 15.99, "2026-07-09")])) == 1


def test_spaced_payee_names_match_compact_titles():
    loan = dl("RealCredito", "2026-08-25", 112.0)
    assert len(propose_matches([occ(loan, "2026-08-25")], [tx("Real Credito", 112.0, "2026-08-24")])) == 1
