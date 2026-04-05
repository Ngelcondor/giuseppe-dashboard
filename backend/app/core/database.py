"""Database configuration and session management."""
import logging
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import inspect, text
from typing import AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create async engine
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    poolclass=NullPool,
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    future=True,
)

# Base class for all models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency to get database session.

    Yields:
        AsyncSession: Database session for request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def _sync_missing_columns(conn):
    """
    Dev helper: detect columns defined in models but missing in DB,
    and add them with ALTER TABLE. Runs synchronously inside run_sync.
    """
    inspector = inspect(conn)
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue  # create_all will handle new tables

        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name not in existing_cols:
                # Build column type string for ALTER TABLE
                col_type = col.type.compile(dialect=conn.dialect)

                # Determine default value for the ALTER TABLE
                default_str = ""
                if col.server_default is not None:
                    default_str = f" DEFAULT {col.server_default.arg}"
                elif col.default is not None and col.default.is_scalar:
                    val = col.default.arg
                    if isinstance(val, bool):
                        default_str = f" DEFAULT {'true' if val else 'false'}"
                    elif isinstance(val, (int, float)):
                        default_str = f" DEFAULT {val}"
                    else:
                        default_str = f" DEFAULT '{val}'"

                # For NOT NULL columns without a default, force nullable
                # (can't add NOT NULL col to table with existing rows)
                if not col.nullable and not default_str:
                    nullable_str = ""  # make it nullable as fallback
                else:
                    nullable_str = "" if col.nullable else " NOT NULL"

                sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}{nullable_str}{default_str}'
                try:
                    conn.execute(text(sql))
                    logger.info(f"Added missing column: {table_name}.{col.name}")
                except Exception as e:
                    # Column might have been added concurrently
                    logger.warning(f"Could not add column {table_name}.{col.name}: {e}")


async def init_db() -> None:
    """Initialize database tables and sync missing columns."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_sync_missing_columns)


async def close_db() -> None:
    """Close database connection."""
    await engine.dispose()
