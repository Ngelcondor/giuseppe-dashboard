"""Symmetric encryption-at-rest for stored credentials (CalDAV app passwords).

Fernet keyed from SECRET_KEY (SHA-256 → urlsafe base64). Legacy plaintext
values are tolerated in decrypt_or_plain() so existing rows keep working and
get re-encrypted opportunistically on the next write.

NB: ruotare SECRET_KEY invalida i valori cifrati — le connessioni CalDAV
andranno reinserite (il sync fallirà con un errore chiaro, non in silenzio).
"""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_str(value: str) -> str:
    """Cifra una stringa; il prefisso marca il formato per il fallback legacy."""
    return _PREFIX + _fernet().encrypt(value.encode()).decode()


def is_encrypted(value: str) -> bool:
    return value.startswith(_PREFIX)


def decrypt_or_plain(value: str) -> str:
    """Ritorna il plaintext: decifra i valori `enc:v1:`, passa attraverso i
    valori legacy non cifrati. Su chiave sbagliata solleva InvalidToken."""
    if not is_encrypted(value):
        return value
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        logger.error("Credenziale cifrata non decifrabile (SECRET_KEY ruotata?)")
        raise
