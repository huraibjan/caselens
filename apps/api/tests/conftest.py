import contextlib
from collections.abc import AsyncGenerator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from caselens.db.base import Base
from caselens.dependencies import get_db
from caselens.main import app

# Use a test database or local SQLite for unit testing
TEST_DATABASE_URL = "postgresql+asyncpg://caselens:caselens_dev_password@localhost:5432/caselens_test"

@pytest.fixture
async def db_engine():
    # Attempt to create the test database first
    admin_engine = create_async_engine("postgresql+asyncpg://caselens:caselens_dev_password@localhost:5432/postgres", isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        with contextlib.suppress(Exception):
            await conn.execute(text("CREATE DATABASE caselens_test"))
    await admin_engine.dispose()

    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "vector"'))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    async_session = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    from httpx import ASGITransport
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
from sqlalchemy import text
