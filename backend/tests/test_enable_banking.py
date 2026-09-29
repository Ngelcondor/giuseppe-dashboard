"""Unit tests for the Enable Banking provider's consent handling.

HTTP is served by an ``httpx.MockTransport`` and the RS256 JWT is stubbed, so
these run without network, keys or a database.
"""
import asyncio
import json
from datetime import datetime, timedelta

import httpx
import pytest

from app.services import enable_banking_service as eb
from app.services.bank_provider import BankSessionExpired

DAY = 86_400


def _provider(monkeypatch, handler):
    """EnableBankingProvider whose HTTP calls all go to `handler`."""
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        eb.httpx, "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    p = eb.EnableBankingProvider()
    monkeypatch.setattr(p, "_auth_headers", lambda: {})
    return p


def _run(coro):
    return asyncio.run(coro)


# ─── _parse_utc_naive ────────────────────────────────────────────────────────

def test_parse_utc_naive_normalises_offsets_to_naive_utc():
    assert eb._parse_utc_naive("2026-12-27T10:00:00Z") == datetime(2026, 12, 27, 10, 0)
    assert eb._parse_utc_naive("2026-12-27T12:00:00.000000+02:00") == datetime(2026, 12, 27, 10, 0)
    assert eb._parse_utc_naive("2026-12-27T10:00:00") == datetime(2026, 12, 27, 10, 0)


def test_parse_utc_naive_rejects_garbage():
    assert eb._parse_utc_naive(None) is None
    assert eb._parse_utc_naive("") is None
    assert eb._parse_utc_naive("not-a-date") is None


# ─── dead session → BankSessionExpired ──────────────────────────────────────

@pytest.mark.parametrize("status, body", [
    (401, {"error": "x"}),
    (403, {"error": "EXPIRED_SESSION"}),
    (404, {"message": "Session not found"}),
    (403, {"message": "Consent revoked"}),
])
def test_balances_on_dead_session_raise_session_expired(monkeypatch, status, body):
    p = _provider(monkeypatch, lambda req: httpx.Response(status, json=body))
    with pytest.raises(BankSessionExpired):
        _run(p.get_balances("acc-uid"))


@pytest.mark.parametrize("status", [403, 404, 429])
def test_ambiguous_4xx_do_not_expire_the_connection(monkeypatch, status):
    """A 4xx that doesn't name the session must stay a generic error: marking
    the connection EXPIRED can only be undone by a new SCA."""
    p = _provider(monkeypatch, lambda req: httpx.Response(status, json={"error": "ASPSP_ERROR"}))
    with pytest.raises(httpx.HTTPStatusError):
        _run(p.get_balances("acc-uid"))


def test_transactions_on_dead_session_raise_session_expired(monkeypatch):
    p = _provider(monkeypatch, lambda req: httpx.Response(401, json={"error": "x"}))
    with pytest.raises(BankSessionExpired):
        _run(p.get_transactions("acc-uid"))


def test_other_http_errors_stay_generic(monkeypatch):
    p = _provider(monkeypatch, lambda req: httpx.Response(500, text="boom"))
    with pytest.raises(httpx.HTTPStatusError):
        _run(p.get_balances("acc-uid"))


# ─── consent length ──────────────────────────────────────────────────────────

def _aspsps(max_validity):
    bank = {"name": "Revolut", "country": "ES"}
    if max_validity is not None:
        bank["maximum_consent_validity"] = max_validity
    return {"aspsps": [{"name": "Other", "country": "ES", "maximum_consent_validity": 5 * DAY}, bank]}


@pytest.mark.parametrize("max_validity, expected", [
    (180 * DAY, timedelta(days=180) - timedelta(hours=1)),
    (90 * DAY, timedelta(days=90) - timedelta(hours=1)),
    (400 * DAY, timedelta(days=180)),        # capped at the PSD2 ceiling
    (None, timedelta(days=90)),              # bank doesn't say → default
])
def test_consent_validity_uses_bank_maximum(monkeypatch, max_validity, expected):
    p = _provider(monkeypatch, lambda req: httpx.Response(200, json=_aspsps(max_validity)))
    assert _run(p._consent_validity("Revolut", "ES")) == expected


def test_consent_validity_falls_back_when_lookup_fails(monkeypatch):
    p = _provider(monkeypatch, lambda req: httpx.Response(503))
    assert _run(p._consent_validity("Revolut", "ES")) == timedelta(days=90)


def test_initiate_auth_requests_the_bank_maximum(monkeypatch):
    sent = {}

    def handler(req):
        if req.url.path == "/aspsps":
            return httpx.Response(200, json=_aspsps(180 * DAY))
        sent["body"] = req.read()
        return httpx.Response(200, json={"url": "https://bank/auth", "authorization_id": "auth-1"})

    p = _provider(monkeypatch, handler)
    res = _run(p.initiate_auth("Revolut", country="ES"))
    assert res.auth_link == "https://bank/auth"
    valid_until = eb._parse_utc_naive(json.loads(sent["body"])["access"]["valid_until"])
    assert timedelta(days=179) < valid_until - datetime.utcnow() < timedelta(days=180)


# ─── granted expiry from POST /sessions ──────────────────────────────────────

def test_complete_auth_carries_granted_valid_until(monkeypatch):
    session = {
        "session_id": "s-1",
        "access": {"valid_until": "2027-03-28T09:30:00.000000+00:00"},
        "accounts": [{"uid": "acc-1", "account_id": {"iban": "LT00"}, "currency": "EUR", "name": "Main"}],
    }
    p = _provider(monkeypatch, lambda req: httpx.Response(200, json=session))
    accounts = _run(p.complete_auth("code"))
    assert [a.account_id for a in accounts] == ["acc-1"]
    assert accounts[0].valid_until == datetime(2027, 3, 28, 9, 30)


def test_complete_auth_without_access_leaves_valid_until_empty(monkeypatch):
    p = _provider(monkeypatch, lambda req: httpx.Response(200, json={"accounts": ["acc-1"]}))
    accounts = _run(p.complete_auth("code"))
    assert accounts[0].account_id == "acc-1" and accounts[0].valid_until is None
