"""FastAPI main application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import traceback

from app.core.config import settings
from app.core.database import init_db, close_db, AsyncSessionLocal
# Import all models so SQLAlchemy registers them with Base.metadata
from app.models import (  # noqa: F401
    user, budget, deadline, scadenza, habit, mood,
)
from app.models import health, notification, api_token  # noqa: F401
from app.core.redis import init_redis, close_redis
from app.api.v1.router import router as api_v1_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_admin_user() -> None:
    """Create the single admin user if the users table is empty."""
    from sqlalchemy.future import select
    from app.models.user import User
    from app.core.security import hash_password

    if not settings.ADMIN_PASSWORD:
        logger.warning("ADMIN_PASSWORD not set — skipping admin seed.")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        existing = result.scalars().first()
        if existing:
            logger.info("Admin user already exists — skipping seed.")
            return

        admin = User(
            email=settings.ADMIN_EMAIL,
            username="giuseppe",
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info(f"Admin user created: {settings.ADMIN_EMAIL}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Initializing database...")
    await init_db()
    await seed_admin_user()

    logger.info("Connecting to Redis...")
    try:
        await init_redis()
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")

    yield

    logger.info("Closing database...")
    await close_db()

    logger.info("Closing Redis...")
    try:
        await close_redis()
    except Exception as e:
        logger.warning(f"Redis close failed: {e}")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Personal dashboard API for Giuseppe - ADHD/ASD cybersecurity student",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Add CORS middleware - configured via settings/environment variables
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.cors_methods_list,
    allow_headers=settings.cors_headers_list,
)


# Error handlers with CORS headers
def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with CORS headers."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=cors_headers(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions with CORS headers."""
    logger.error(f"Unhandled error: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=cors_headers(),
    )


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# Include API routers
app.include_router(api_v1_router)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Giuseppe Dashboard API",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
