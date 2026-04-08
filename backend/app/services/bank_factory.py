"""
Bank provider factory.

Returns the configured Open Banking provider based on settings.
"""
import logging
from app.core.config import settings
from app.services.bank_provider import BankProvider

logger = logging.getLogger(__name__)

_provider_instance: BankProvider | None = None


def get_bank_provider() -> BankProvider | None:
    """
    Get the configured bank provider.
    Returns None if no provider is configured (credentials missing).
    """
    global _provider_instance
    if _provider_instance:
        return _provider_instance

    # Try Enable Banking first (recommended for new users)
    if settings.ENABLE_BANKING_APP_ID and settings.ENABLE_BANKING_APP_SECRET:
        from app.services.enable_banking_service import EnableBankingProvider
        _provider_instance = EnableBankingProvider()
        logger.info(f"Using bank provider: {_provider_instance.provider_name}")
        return _provider_instance

    # Fall back to GoCardless (for existing users)
    if settings.GOCARDLESS_SECRET_ID and settings.GOCARDLESS_SECRET_KEY:
        from app.services.gocardless_service import GoCardlessProvider
        _provider_instance = GoCardlessProvider()
        logger.info(f"Using bank provider: {_provider_instance.provider_name}")
        return _provider_instance

    logger.info("No bank provider configured — bank sync disabled, CSV import available")
    return None
