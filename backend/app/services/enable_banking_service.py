"""
Enable Banking provider.

Alternative to GoCardless for Open Banking access.
Free for personal use — no PSD2 licence required for accessing your own data.
Register at: https://enablebanking.com/

Enable Banking uses a different auth flow:
1. Create a session with the bank
2. User authorizes via redirect
3. Use session to fetch accounts, balances, transactions
"""
import logging
from datetime import date, datetime, timedelta
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

# Enable Banking API base
EB_BASE = "https://api.enablebanking.com"


class EnableBankingProvider(BankProvider):
    """Enable Banking open banking provider."""

    def __init__(self):
        self._app_id = settings.ENABLE_BANKING_APP_ID
        self._app_secret = settings.ENABLE_BANKING_APP_SECRET
        self._redirect_url = settings.ENABLE_BANKING_REDIRECT_URL

    @property
    def provider_name(self) -> str:
        return "Enable Banking"

    def _auth_headers(self) -> dict:
        """Basic auth headers for Enable Banking API."""
        import base64
        creds = base64.b64encode(f"{self._app_id}:{self._app_secret}".encode()).decode()
        return {
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/json",
        }

    async def list_institutions(self, country: str = "FR") -> list[dict]:
        """List ASPSPs (banks) available in a country."""
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{EB_BASE}/aspsps",
                params={"country": country},
                headers=headers,
            )
            resp.raise_for_status()
            aspsps = resp.json().get("aspsps", [])

        return [
            {
                "id": a.get("name", ""),
                "name": a.get("name", ""),
                "logo": a.get("logo_url"),
                "countries": [country],
            }
            for a in aspsps
        ]

    async def initiate_auth(
        self,
        institution_id: str,
        redirect_url: Optional[str] = None,
    ) -> BankAuthResult:
        """
        Start an authorization session.
        Enable Banking creates a session and returns a URL for the user.
        """
        headers = self._auth_headers()
        redirect = redirect_url or self._redirect_url

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EB_BASE}/sessions",
                headers=headers,
                json={
                    "access": {
                        "valid_until": (datetime.utcnow() + timedelta(days=90)).isoformat() + "Z",
                    },
                    "aspsp": {"name": institution_id, "country": "FR"},
                    "state": "giuseppe-dashboard",
                    "redirect_url": redirect,
                    "psu_type": "personal",
                },
            )
            resp.raise_for_status()
            session = resp.json()

        return BankAuthResult(
            auth_link=session.get("url", ""),
            requisition_id=session.get("session_id", ""),
            institution_id=institution_id,
            institution_name=institution_id,
        )

    async def complete_auth(self, requisition_id: str) -> list[BankAccountInfo]:
        """Fetch accounts after user has authorized."""
        headers = self._auth_headers()

        async with httpx.AsyncClient(timeout=30) as client:
            # Get session status
            resp = await client.get(
                f"{EB_BASE}/sessions/{requisition_id}",
                headers=headers,
            )
            resp.raise_for_status()
            session = resp.json()

            if session.get("status") != "AUTHORIZED":
                raise ValueError(f"Session not authorized. Status: {session.get('status')}")

            # Get accounts
            resp = await client.get(
                f"{EB_BASE}/sessions/{requisition_id}/accounts",
                headers=headers,
            )
            resp.raise_for_status()
            accounts_data = resp.json().get("accounts", [])

        return [
            BankAccountInfo(
                account_id=acc.get("account_id", {}).get("iban", acc.get("uid", "")),
                iban=acc.get("account_id", {}).get("iban"),
                name=acc.get("product", acc.get("name", "Account")),
                currency=acc.get("currency", "EUR"),
                owner_name=acc.get("owner_name"),
            )
            for acc in accounts_data
        ]

    async def get_balances(self, account_id: str) -> list[BankBalance]:
        """Get account balances."""
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{EB_BASE}/accounts/{account_id}/balances",
                headers=headers,
            )
            resp.raise_for_status()
            balances = resp.json().get("balances", [])

        return [
            BankBalance(
                amount=float(b.get("balance_amount", {}).get("amount", 0)),
                currency=b.get("balance_amount", {}).get("currency", "EUR"),
                balance_type=b.get("balance_type", "closingBooked"),
            )
            for b in balances
        ]

    async def get_transactions(
        self,
        account_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> BankTransactionList:
        """Get account transactions."""
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
            resp.raise_for_status()
            data = resp.json()

        result = BankTransactionList()

        for tx in data.get("transactions", []):
            booking_str = tx.get("booking_date", "")
            booking_date = date.fromisoformat(booking_str) if booking_str else None

            parsed = BankTransaction(
                transaction_id=tx.get("transaction_id", tx.get("entry_reference", "")),
                amount=float(tx.get("transaction_amount", {}).get("amount", 0)),
                currency=tx.get("transaction_amount", {}).get("currency", "EUR"),
                booking_date=booking_date,
                description=(
                    tx.get("remittance_information_unstructured")
                    or tx.get("creditor_name")
                    or tx.get("debtor_name")
                    or "N/A"
                ),
                creditor_name=tx.get("creditor_name"),
                debtor_name=tx.get("debtor_name"),
                merchant_category_code=tx.get("merchant_category_code"),
                raw_data=tx,
            )
            result.booked.append(parsed)

        return result
