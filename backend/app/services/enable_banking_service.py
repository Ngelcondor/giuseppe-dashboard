"""
Enable Banking provider.

Real Enable Banking API integration (https://api.enablebanking.com).

Auth is a JWT Bearer (RS256) signed with the app's private RSA key:
  - header: {"alg":"RS256","kid":<APP_ID>,"typ":"JWT"}
  - claims: {"iss":"enablebanking.com","aud":"api.enablebanking.com","iat":<now>,"exp":<now+3600>}

Flow:
1. GET /aspsps?country=<CC>            -> list banks (ASPSPs)
2. POST /auth                          -> bank authorization URL + authorization_id
3. user authorizes, bank redirects to redirect_url?code=<code>&state=<state>
4. POST /sessions {"code": <code>}     -> session_id + accounts (each has a uid)
5. GET /accounts/{uid}/balances        -> balances
6. GET /accounts/{uid}/transactions    -> transactions

NOTE: this targets the EB SANDBOX. Field names below are best-effort and MUST be
confirmed against a real round-trip — all parsing is defensive and raw responses
are logged on any HTTP/parse error so the first real connection can be debugged.
"""
import hashlib
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import httpx
from jose import jwt

from app.core.config import settings
from app.services.bank_provider import (
    BankProvider,
    BankAuthResult,
    BankAccountInfo,
    BankBalance,
    BankTransaction,
    BankTransactionList,
)

logger = logging.getLogger(__name__)

# Enable Banking API base
EB_BASE = "https://api.enablebanking.com"


def _to_float(value, default: float = 0.0) -> float:
    """Defensive float coercion — EB sends amounts as strings."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_date(value) -> Optional[date]:
    """Defensive ISO date parse (accepts 'YYYY-MM-DD' or full ISO)."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


class EnableBankingProvider(BankProvider):
    """Enable Banking open banking provider (real API)."""

    def __init__(self):
        self._app_id = settings.ENABLE_BANKING_APP_ID
        # The private key is a multiline PEM. Env vars (docker/.env) usually
        # can't hold real newlines, so accept a single-line value with literal
        # "\n" and normalize it back so jose can parse the key.
        self._app_secret = (settings.ENABLE_BANKING_APP_SECRET or "").replace("\\n", "\n")
        self._redirect_url = settings.ENABLE_BANKING_REDIRECT_URL

    @property
    def provider_name(self) -> str:
        return "Enable Banking"

    # ─── Auth ─────────────────────────────────────────────────────────────────

    def _auth_headers(self) -> dict:
        """JWT Bearer (RS256) signed with the app's private RSA key."""
        now = datetime.now(tz=timezone.utc)
        claims = {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        }
        token = jwt.encode(
            claims,
            self._app_secret,
            algorithm="RS256",
            headers={"kid": self._app_id, "typ": "JWT"},
        )
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    # ─── Institutions ─────────────────────────────────────────────────────────

    async def list_institutions(self, country: str = "ES") -> list[dict]:
        """List ASPSPs (banks) available in a country. GET /aspsps?country=<CC>."""
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{EB_BASE}/aspsps",
                params={"country": country},
                headers=headers,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error(
                    "EB list_institutions HTTP %s: %s", resp.status_code, resp.text
                )
                raise
            data = resp.json()

        aspsps = data.get("aspsps", []) if isinstance(data, dict) else []
        result = []
        for a in aspsps:
            if not isinstance(a, dict):
                continue
            name = a.get("name", "")
            cc = a.get("country", country)
            result.append(
                {
                    # EB identifies a bank by (name, country); we encode name as id
                    # and pass country separately on initiate_auth.
                    "id": name,
                    "name": name,
                    "logo": a.get("logo") or a.get("logo_url"),
                    "countries": [cc] if cc else [country],
                }
            )
        return result

    # ─── Initiate authorization ───────────────────────────────────────────────

    async def initiate_auth(
        self,
        institution_id: str,
        redirect_url: Optional[str] = None,
        country: str = "ES",
    ) -> BankAuthResult:
        """
        Start an authorization. POST /auth returns a bank URL + authorization_id.
        Send the user to the returned URL; the bank redirects back to redirect_url
        with ?code=<code>&state=<state>.
        """
        headers = self._auth_headers()
        redirect = redirect_url or self._redirect_url
        state = uuid.uuid4().hex
        valid_until = (
            datetime.now(tz=timezone.utc) + timedelta(days=90)
        ).strftime("%Y-%m-%dT%H:%M:%S.000Z")

        body = {
            "access": {"valid_until": valid_until},
            "aspsp": {"name": institution_id, "country": country},
            "state": state,
            "redirect_url": redirect,
            "psu_type": "personal",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EB_BASE}/auth", headers=headers, json=body)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("EB initiate_auth HTTP %s: %s", resp.status_code, resp.text)
                raise
            data = resp.json() if resp.content else {}

        if not isinstance(data, dict):
            logger.error("EB initiate_auth unexpected payload: %s", resp.text)
            data = {}

        auth_url = data.get("url", "")
        authorization_id = data.get("authorization_id") or state

        return BankAuthResult(
            auth_link=auth_url,
            requisition_id=authorization_id,
            agreement_id=state,
            institution_id=institution_id,
            institution_name=institution_id,
        )

    # ─── Complete authorization ───────────────────────────────────────────────

    async def complete_auth(self, token: str) -> list[BankAccountInfo]:
        """
        Exchange the callback `code` for a session. POST /sessions {"code": token}.
        Returns the accounts, each keyed by its EB account UID (used for later
        balance/transaction calls).
        """
        headers = self._auth_headers()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EB_BASE}/sessions",
                headers=headers,
                json={"code": token},
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("EB complete_auth HTTP %s: %s", resp.status_code, resp.text)
                raise
            data = resp.json() if resp.content else {}

        if not isinstance(data, dict):
            logger.error("EB complete_auth unexpected payload: %s", resp.text)
            return []

        raw_accounts = data.get("accounts", []) or []
        accounts: list[BankAccountInfo] = []

        for acc in raw_accounts:
            # accounts items may be plain uid strings or full objects
            if isinstance(acc, str):
                accounts.append(BankAccountInfo(account_id=acc))
                continue
            if not isinstance(acc, dict):
                logger.warning("EB complete_auth: skipping account of type %s", type(acc))
                continue

            uid = acc.get("uid") or acc.get("account_uid") or ""
            account_id_obj = acc.get("account_id")
            iban = None
            if isinstance(account_id_obj, dict):
                iban = account_id_obj.get("iban")
            elif isinstance(account_id_obj, str):
                iban = account_id_obj

            name = acc.get("name") or acc.get("product") or "Conto"
            currency = acc.get("currency") or "EUR"
            owner_name = acc.get("owner_name") or acc.get("ownerName")

            accounts.append(
                BankAccountInfo(
                    account_id=uid or iban or "",
                    iban=iban,
                    name=name,
                    currency=currency,
                    owner_name=owner_name,
                )
            )

        if not accounts:
            logger.error("EB complete_auth: no accounts parsed from %s", resp.text)

        return accounts

    # ─── Balances ─────────────────────────────────────────────────────────────

    async def get_balances(self, account_id: str) -> list[BankBalance]:
        """GET /accounts/{account_uid}/balances."""
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{EB_BASE}/accounts/{account_id}/balances",
                headers=headers,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error("EB get_balances HTTP %s: %s", resp.status_code, resp.text)
                raise
            data = resp.json() if resp.content else {}

        balances_raw = data.get("balances", []) if isinstance(data, dict) else []
        result: list[BankBalance] = []
        for b in balances_raw:
            if not isinstance(b, dict):
                continue
            amount_obj = b.get("balance_amount") or {}
            if not isinstance(amount_obj, dict):
                amount_obj = {}
            result.append(
                BankBalance(
                    amount=_to_float(amount_obj.get("amount")),
                    currency=amount_obj.get("currency", "EUR"),
                    balance_type=b.get("balance_type") or "closingBooked",
                )
            )
        return result

    # ─── Transactions ─────────────────────────────────────────────────────────

    async def get_transactions(
        self,
        account_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> BankTransactionList:
        """GET /accounts/{account_uid}/transactions?date_from=&date_to=."""
        headers = self._auth_headers()
        params = {}
        if date_from:
            params["date_from"] = date_from.isoformat()
        if date_to:
            params["date_to"] = date_to.isoformat()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{EB_BASE}/accounts/{account_id}/transactions",
                headers=headers,
                params=params,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.error(
                    "EB get_transactions HTTP %s: %s", resp.status_code, resp.text
                )
                raise
            data = resp.json() if resp.content else {}

        result = BankTransactionList()
        if not isinstance(data, dict):
            logger.error("EB get_transactions unexpected payload: %s", resp.text)
            return result

        for tx in data.get("transactions", []) or []:
            if not isinstance(tx, dict):
                continue
            try:
                result.booked.append(self._parse_transaction(tx))
            except Exception as e:  # never let one bad tx kill the sync
                logger.warning("EB transaction parse failed: %s | raw=%s", e, tx)

        return result

    @staticmethod
    def _parse_transaction(tx: dict) -> BankTransaction:
        """Map an Enable Banking transaction to a normalized BankTransaction."""
        amount_obj = tx.get("transaction_amount") or {}
        if not isinstance(amount_obj, dict):
            amount_obj = {}
        amount = _to_float(amount_obj.get("amount"))

        # EB uses credit_debit_indicator (CRDT/DBIT) for sign; amounts are unsigned.
        indicator = (tx.get("credit_debit_indicator") or "").upper()
        if indicator == "DBIT":
            amount = -abs(amount)
        elif indicator == "CRDT":
            amount = abs(amount)

        booking_date = _parse_date(
            tx.get("booking_date")
            or tx.get("value_date")
            or tx.get("transaction_date")
        )

        # remittance_information is a list of strings in EB
        remittance = tx.get("remittance_information")
        if isinstance(remittance, list):
            remittance_text = " ".join(str(r) for r in remittance if r)
        elif isinstance(remittance, str):
            remittance_text = remittance
        else:
            remittance_text = ""

        creditor = tx.get("creditor")
        creditor_name = None
        if isinstance(creditor, dict):
            creditor_name = creditor.get("name")
        elif isinstance(creditor, str):
            creditor_name = creditor
        if not creditor_name:
            creditor_name = tx.get("creditor_name")

        debtor = tx.get("debtor")
        debtor_name = None
        if isinstance(debtor, dict):
            debtor_name = debtor.get("name")
        elif isinstance(debtor, str):
            debtor_name = debtor
        if not debtor_name:
            debtor_name = tx.get("debtor_name")

        description = (
            remittance_text
            or creditor_name
            or debtor_name
            or "N/A"
        )

        transaction_id = (
            tx.get("transaction_id")
            or tx.get("entry_reference")
            or tx.get("reference_number")
        )
        transaction_id = str(transaction_id) if transaction_id else None
        # Some ASPSPs omit a stable id — derive a deterministic one so the
        # transaction still imports and de-duplicates across syncs.
        if not transaction_id:
            basis = f"{booking_date}|{amount}|{amount_obj.get('currency', 'EUR')}|{description}"
            transaction_id = "eb-" + hashlib.sha1(basis.encode("utf-8")).hexdigest()[:24]

        # EB sends bank_transaction_code as an OBJECT and merchant_category_code
        # as a short string (when present). Flatten both to plain strings — a
        # dict here crashes the downstream category lookup (DEFAULT_CATEGORY_MAP.get).
        btc = tx.get("bank_transaction_code")
        if isinstance(btc, dict):
            btc = btc.get("code") or btc.get("description") or btc.get("sub_family_code")
        elif not isinstance(btc, str):
            btc = None
        mcc = tx.get("merchant_category_code")
        if not isinstance(mcc, str):
            mcc = None

        return BankTransaction(
            transaction_id=transaction_id,
            amount=amount,
            currency=amount_obj.get("currency", "EUR"),
            booking_date=booking_date,
            description=description,
            creditor_name=creditor_name,
            debtor_name=debtor_name,
            merchant_category_code=mcc,
            bank_transaction_code=btc,
            raw_data=tx,
        )
