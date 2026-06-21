"""Database configuration and session management."""
import enum as _enum
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


def _render_default(col):
    """Build the ' DEFAULT <x>' clause for an ALTER TABLE, quoting literals
    correctly. Returns '' when the column has no usable scalar default.

    Handles: string server_default (quoted), SQL-expression server_default
    (raw, e.g. now()), bool/int/float, and Enum members (uses .value)."""
    if col.server_default is not None:
        arg = col.server_default.arg
        # arg may be a plain str or a TextClause (.text). SQL expressions
        # (e.g. now()) contain parens and must be passed through raw.
        s = getattr(arg, "text", arg)
        if not isinstance(s, str):
            return f" DEFAULT {arg}"
        if "(" in s or "'" in s:
            return f" DEFAULT {s}"  # SQL expression or already-quoted
        try:
            float(s)
            return f" DEFAULT {s}"  # numeric literal
        except ValueError:
            return f" DEFAULT '{s}'"  # string literal -> quote
    if col.default is not None and getattr(col.default, "is_scalar", False):
        val = col.default.arg
        if isinstance(val, bool):
            return f" DEFAULT {'true' if val else 'false'}"
        if isinstance(val, (int, float)):
            return f" DEFAULT {val}"
        if isinstance(val, _enum.Enum):
            # SQLAlchemy native Enum stores member NAMES as PG labels
            return f" DEFAULT '{val.name}'"
        return f" DEFAULT '{val}'"
    return ""


def _sync_missing_columns(conn):
    """
    Dev helper: detect columns defined in models but missing in DB,
    and add them with ALTER TABLE. Runs synchronously inside run_sync.

    Each column is added inside its own SAVEPOINT so a single failed
    statement can't abort the outer transaction and poison every
    later table (Postgres aborts the whole tx on the first error).
    """
    inspector = inspect(conn)
    for table_name, table in Base.metadata.tables.items():
        if not inspector.has_table(table_name):
            continue  # create_all will handle new tables

        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
        for col in table.columns:
            if col.name in existing_cols:
                continue

            col_type = col.type.compile(dialect=conn.dialect)
            default_str = _render_default(col)

            # Can't add a NOT NULL column without a default to a populated
            # table -> fall back to nullable in that case.
            nullable_str = "" if (col.nullable or not default_str) else " NOT NULL"

            # Create the backing DB type first if the column has one
            # (e.g. a Postgres ENUM that create_all skipped because its
            # table already existed). Own savepoint so a no-op/failure
            # never poisons the column add below.
            create_type = getattr(col.type, "create", None)
            if callable(create_type):
                try:
                    with conn.begin_nested():
                        create_type(conn, checkfirst=True)
                except Exception:
                    pass

            sql = (
                f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" '
                f'{col_type}{nullable_str}{default_str}'
            )
            try:
                with conn.begin_nested():
                    conn.execute(text(sql))
                logger.info(f"Added missing column: {table_name}.{col.name}")
            except Exception as e:
                logger.warning(f"Could not add column {table_name}.{col.name}: {e}")


async def init_db() -> None:
    """Initialize database tables and sync missing columns."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        await conn.run_sync(_sync_missing_columns)


async def close_db() -> None:
    """Close database connection."""
    await engine.dispose()
