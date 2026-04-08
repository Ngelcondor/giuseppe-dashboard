"""
Abstract bank provider interface.

Allows swapping between Open Banking providers (GoCardless, Enable Banking,
TrueLayer, etc.) without changing the rest of the application.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class BankAuthResult:
    """Result of initiating bank authorization."""

    auth_link: str
    requisition_id: str  # or session_id, depending on provider
    agreement_id: Optional[str] = None
    institution_id: str = ""
    institution_name: str = ""


@dataclass
class BankAccountInfo:
    """Bank account details after auth."""

    account_id: str
    iban: Optional[str] = None
    name: Optional[str] = None
    currency: str = "EUR"
    owner_name: Optional[str] = None


@dataclass
class BankBalance:
    """Account balance."""

    amount: float
    currency: str = "EUR"
    balance_type: str = "closingBooked"  # closingBooked, expected, etc.


@dataclass
class BankTransaction:
    """Normalized bank transaction."""

    transaction_id: str
    amount: float
    currency: str = "EUR"
    booking_date: Optional[date] = None
    description: str = ""
    creditor_name: Optional[str] = None
    debtor_name: Optional[str] = None
    merchant_category_code: Optional[str] = None
    bank_transaction_code: Optional[str] = None
    raw_data: Optional[dict] = field(default_factory=dict)


@dataclass
class BankTransactionList:
    """List of booked and pending transactions."""

    booked: list[BankTransaction] = field(default_factory=list)
    pending: list[BankTransaction] = field(default_factory=list)


class BankProvider(ABC):
    """Abstract interface for Open Banking providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name."""
        ...

    @abstractmethod
    async def list_institutions(self, country: str = "FR") -> list[dict]:
        """List available banking institutions."""
        ...

    @abstractmethod
    async def initiate_auth(
        self,
        institution_id: str,
        redirect_url: Optional[str] = None,
    ) -> BankAuthResult:
        """Start the bank authorization flow. Returns auth link for user."""
        ...

    @abstractmethod
    async def complete_auth(self, requisition_id: str) -> list[BankAccountInfo]:
        """Complete auth after user redirect. Returns list of accounts."""
        ...

    @abstractmethod
    async def get_balances(self, account_id: str) -> list[BankBalance]:
        """Get account balances."""
        ...

    @abstractmethod
    async def get_transactions(
        self,
        account_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> BankTransactionList:
        """Get account transactions."""
        ...
