"""CTF and cybersecurity challenge tracking models."""
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from enum import Enum

from app.core.database import Base


class CTFPlatformName(str, Enum):
    """CTF platforms."""

    HACKTHEBOX = "hackthebox"
    TRYHACKME = "tryhackme"
    PICOCTF = "picoctf"
    CTFTIME = "ctftime"
    OTHER = "other"


class ChallengeCategory(str, Enum):
    """Challenge categories."""

    WEB = "web"
    CRYPTO = "crypto"
    FORENSICS = "forensics"
    PWN = "pwn"
    REVERSE = "reverse"
    STEGANOGRAPHY = "steganography"
    OSINT = "osint"
    MISC = "misc"


class ChallengeDifficulty(str, Enum):
    """Challenge difficulty."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    INSANE = "insane"


class CTFPlatform(Base):
    """CTF platform account tracking."""

    __tablename__ = "ctf_platforms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    platform_name = Column(SQLEnum(CTFPlatformName), nullable=False)
    username = Column(String(255), nullable=False)
    profile_url = Column(String(500), nullable=True)

    # API Key (should be encrypted in production)
    api_key_encrypted = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    challenges = relationship("CTFChallenge", back_populates="platform", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<CTFPlatform(id={self.id}, platform={self.platform_name}, user={self.username})>"


class CTFChallenge(Base):
    """CTF challenge tracking."""

    __tablename__ = "ctf_challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    platform_id = Column(
        UUID(as_uuid=True), ForeignKey("ctf_platforms.id"), nullable=False
    )

    name = Column(String(255), nullable=False, index=True)
    description = Column(String(2000), nullable=True)

    category = Column(SQLEnum(ChallengeCategory), nullable=False)
    difficulty = Column(SQLEnum(ChallengeDifficulty), nullable=True)

    is_completed = Column(Boolean, default=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    time_spent_minutes = Column(Integer, nullable=True)

    notes = Column(String(2000), nullable=True)
    writeup_url = Column(String(500), nullable=True)

    # External ID from platform
    external_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    platform = relationship("CTFPlatform", back_populates="challenges")

    def __repr__(self) -> str:
        return f"<CTFChallenge(id={self.id}, name={self.name}, category={self.category})>"
