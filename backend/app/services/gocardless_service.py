"""
GoCardless Bank Account Data (ex Nordigen) provider.

NOTE: As of 2026, GoCardless has stopped accepting new registrations.
This provider is kept for users who already have an account.
For new users, see enable_banking_service.py.
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional

import httpx

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

# ─── Token Cache ──────────────────────────────────────────────────────────────

_token_cache: dict = {"access": None, "expires_at": None}


async def _get_access_token() -> str:
    now = datetime.utcnow()
    if _token_cache["access"] and _token_cache["expires_at"] and _token_cache["expires_at"] > now:
        return _token_cache["access"]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.GOCARDLESS_BASE_URL}/token/new/",
            json={
                "secret_id": settings.GOCARDLESS_SECRET_ID,
                "secret_key": settings.GOCARDLESS_SECRET_KEY,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    _token_cache["access"] = data["access"]
    _token_cache["expires_at"] = now + timedelta(seconds=data.get("access_expires", 86400) - 60)
    return _token_cache["access"]


async def _headers() -> dict:
    token = await _get_access_token()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── GoCardless Provider ──────────────────────────────────────────────────────


class GoCardlessProvider(BankProvider):
    """GoCardless Bank Account Data provider."""

    @property
    def provider_name(self) -> str:
        return "GoCardless"

    async def list_institutions(self, country: str = "FR") -> list[dict]:
        hdrs = await _headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.GOCARDLESS_BASE_URL}/institutions/",
                params={"country": country},
                headers=hdrs,
            )
            resp.raise_for_status()
        return resp.json()

    async def initiate_auth(
        self,
        institution_id: str,
        redirect_url: Optional[str] = None,
    ) -> BankAuthResult:
        hdrs = await _headers()
        redirect = redirect_url or settings.GOCARDLESS_REDIRECT_URL
        inst_id = institution_id or settings.GOCARDLESS_INSTITUTION_ID

        async with httpx.AsyncClient(timeout=30) as client:
            # Create agreement
            resp = await client.post(
                f"{settings.GOCARDLESS_BASE_URL}/agreements/enduser/",
                headers=hdrs,
                json={
                    "institution_id": inst_id,
                    "max_historical_days": 90,
                    "access_valid_for_days": 90,
                    "access_scope": ["balances", "details", "transactions"],
                },
            )
            resp.raise_for_status()
            agreement = resp.json()

            # Create requisition
            resp = await client.post(
                f"{settings.GOCARDLESS_BASE_URL}/requisitions/",
                headers=hdrs,
                json={
                    "redirect": redirect,
                    "institution_id": inst_id,
                    "reference": "giuseppe-dashboard",
                    "agreement": agreement["id"],
                    "user_language": "IT",
                },
            )
            resp.raise_for_status()
            requisition = resp.json()

        return BankAuthResult(
            auth_link=requisition["link"],
            requisition_id=requisition["id"],
            agreement_id=agreement["id"],
            institution_id=inst_id,
            institution_name=inst_id.split("_")[0].capitalize(),
        )

    async def complete_auth(self, requisition_id: str) -> list[BankAccountInfo]:
        hdrs = await _headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.GOCARDLESS_BASE_URL}/requisitions/{requisition_id}/",
                headers=hdrs,
            )
            resp.raise_for_status()
            req_data = resp.json()

        if req_data.get("status") != "LN":
            raise ValueError(f"Auth not completed. Status: {req_data.get('status')}")

        accounts = []
        for acc_id in req_data.get("accounts", []):
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{settings.GOCARDLESS_BASE_URL}/accounts/{acc_id}/details/",
                    headers=hdrs,
                )
                resp.raise_for_status()
                details = resp.json().get("account", {})

            accounts.append(BankAccountInfo(
                account_id=acc_id,
                iban=details.get("iban"),
                name=details.get("name", details.get("ownerName", "Revolut")),
                currency=details.get("currency", "EUR"),
                owner_name=details.get("ownerName"),
            ))

        return accounts

    async def get_balances(self, account_id: str) -> list[BankBalance]:
        hdrs = await _headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.GOCARDLESS_BASE_URL}/accounts/{account_id}/balances/",
                headers=hdrs,
            )
            resp.raise_for_status()

        return [
            BankBalance(
                amount=float(b["balanceAmount"]["amount"]),
                currency=b["balanceAmount"]["currency"],
                balance_type=b.get("balanceType", "unknown"),
            )
            for b in resp.json().get("balances", [])
        ]

    async def get_transactions(
        self,
        account_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> BankTransactionList:
        hdrs = await _headers()
        params = {}
        if date_from:
            params["date_from"] = date_from.isoformat()
        if date_to:
            params["date_to"] = date_to.isoformat()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.GOCARDLESS_BASE_URL}/accounts/{account_id}/transactions/",
                headers=hdrs,
                params=params,
            )
            resp.raise_for_status()

        data = resp.json().get("transactions", {})
        result = BankTransactionList()

        for tx in data.get("booked", []):
            result.booked.append(self._parse_transaction(tx))

        for tx in data.get("pending", []):
            result.pending.append(self._parse_transaction(tx))

        return result

    @staticmethod
    def _parse_transaction(tx: dict) -> BankTransaction:
        amount = float(tx.get("transactionAmount", {}).get("amount", 0))
        booking_str = tx.get("bookingDate", tx.get("valueDate", ""))
        booking_date = date.fromisoformat(booking_str) if booking_str else None

        return BankTransaction(
            transaction_id=tx.get("transactionId") or tx.get("internalTransactionId", ""),
            amount=amount,
            currency=tx.get("transactionAmount", {}).get("currency", "EUR"),
            booking_date=booking_date,
            description=(
                tx.get("remittanceInformationUnstructured")
                or tx.get("creditorName")
                or tx.get("debtorName")
                or "N/A"
            ),
            creditor_name=tx.get("creditorName"),
            debtor_name=tx.get("debtorName"),
            merchant_category_code=tx.get("merchantCategoryCode"),
            bank_transaction_code=tx.get("proprietaryBankTransactionCode"),
            raw_data=tx,
        )
