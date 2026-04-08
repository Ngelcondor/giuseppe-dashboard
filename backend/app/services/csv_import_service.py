"""
Revolut CSV import service.

Parses CSV exports from Revolut app and converts them into Transaction objects.
Revolut CSV format (standard export):
  Type, Product, Started Date, Completed Date, Description, Amount, Fee,
  Currency, State, Balance
"""
import csv
import io
import logging
from datetime import datetime, date
from typing import Optional

from app.models.budget import TransactionType, TransactionSource, DEFAULT_CATEGORY_MAP

logger = logging.getLogger(__name__)


def _guess_category(description: str) -> str:
    """
    Guess a budget category from the transaction description.
    Uses keyword matching as fallback when no MCC is available.
    """
    desc_lower = description.lower()

    keyword_map = {
        "Alimentari": [
            "carrefour", "lidl", "aldi", "monoprix", "franprix", "picard",
            "supermarche", "supermercato", "grocery", "boulangerie",
        ],
        "Ristorazione": [
            "restaurant", "mcdonalds", "burger", "pizza", "kebab", "sushi",
            "uber eats", "deliveroo", "just eat", "glovo",
        ],
        "Trasporti": [
            "uber", "bolt", "taxi", "ratp", "sncf", "metro", "bus",
            "train", "essence", "total energies", "shell", "bp ",
        ],
        "Abbonamenti": [
            "spotify", "netflix", "disney", "apple", "openai", "claude",
            "amazon prime", "youtube", "adobe", "notion",
        ],
        "Salute": [
            "pharmacie", "medecin", "docteur", "psichiatra", "psicologa",
            "hospital", "clinique", "dentist",
        ],
        "Tech": [
            "amazon", "apple store", "fnac", "darty", "mediaworld",
            "keychron", "logitech",
        ],
        "Casa": [
            "affitto", "loyer", "ikea", "leroy merlin", "castorama",
            "assicurazione", "edf", "engie",
        ],
        "Shopping": [
            "zara", "h&m", "uniqlo", "decathlon", "nike", "adidas",
            "asos", "shein", "pvh",
        ],
        "Svago": [
            "cinema", "theatre", "concert", "steam", "playstation",
            "nintendo", "lootbar", "gaming",
        ],
    }

    for category, keywords in keyword_map.items():
        if any(kw in desc_lower for kw in keywords):
            return category

    return "Altro"


def parse_revolut_csv(
    csv_content: str | bytes,
    user_id: str,
) -> list[dict]:
    """
    Parse a Revolut CSV export and return a list of transaction dicts
    ready to be inserted as Transaction model instances.

    Args:
        csv_content: Raw CSV file content (string or bytes).
        user_id: UUID of the user.

    Returns:
        List of dicts with Transaction fields.
    """
    if isinstance(csv_content, bytes):
        csv_content = csv_content.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(csv_content))
    transactions = []

    # Support both English and Italian Revolut CSV headers
    HEADER_MAP = {
        "amount": ["Amount", "Importo"],
        "description": ["Description", "Descrizione"],
        "state": ["State", "Stato"],
        "completed_date": ["Completed Date", "Data di completamento"],
        "started_date": ["Started Date", "Data di inizio"],
        "type": ["Type", "Tipo"],
        "currency": ["Currency", "Valuta"],
        "balance": ["Balance", "Saldo"],
    }

    def _get(row: dict, field: str, default: str = "") -> str:
        """Get a field value trying all known header variants."""
        for key in HEADER_MAP.get(field, [field]):
            if key in row:
                return row[key].strip()
        return default

    for row in reader:
        try:
            # Parse amount
            amount_str = _get(row, "amount", "0").replace(",", ".")
            amount = float(amount_str)

            if amount == 0:
                continue

            # Skip failed/reverted transactions
            state = _get(row, "state").lower()
            if state in ("reverted", "failed", "declined", "annullato", "rifiutato"):
                continue

            # Parse date — Revolut uses "YYYY-MM-DD HH:MM:SS" or "DD MMM YYYY"
            date_str = _get(row, "completed_date") or _get(row, "started_date")
            txn_date = _parse_revolut_date(date_str)
            if not txn_date:
                logger.warning(f"Could not parse date: {date_str}, skipping row")
                continue

            # Determine type
            txn_type = TransactionType.INCOME if amount > 0 else TransactionType.EXPENSE

            # Description
            description = _get(row, "description")
            raw_type = _get(row, "type")

            # Category
            category = _guess_category(description)

            # Currency
            currency = _get(row, "currency") or "EUR"

            # Balance after transaction (informational)
            balance_str = _get(row, "balance")

            transactions.append({
                "user_id": user_id,
                "amount": abs(amount),
                "category": category,
                "description": description,
                "transaction_type": txn_type,
                "date": txn_date,
                "source": TransactionSource.CSV_IMPORT,
                "external_id": f"csv_{txn_date.isoformat()}_{description[:50]}_{amount}",
                "raw_description": f"[{raw_type}] {description} | State: {state} | Balance: {balance_str}",
                "merchant_name": description,
                "notes": f"Importato da CSV Revolut ({currency})",
            })

        except Exception as e:
            logger.warning(f"Error parsing CSV row: {e}, row: {row}")
            continue

    logger.info(f"Parsed {len(transactions)} transactions from Revolut CSV")
    return transactions


def _parse_revolut_date(date_str: str) -> Optional[date]:
    """Try multiple date formats used by Revolut."""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d %b %Y",
        "%d %B %Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None
