import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # Register a new user
    register_payload = {
        "email": "testlawyer@firm.com",
        "password": "strongpassword123",
        "full_name": "Test Lawyer",
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Login with credentials
    login_payload = {
        "email": "testlawyer@firm.com",
        "password": "strongpassword123",
    }
    resp = await client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data

    # Try invalid password
    bad_login = {
        "email": "testlawyer@firm.com",
        "password": "wrongpassword",
    }
    resp = await client.post("/api/v1/auth/login", json=bad_login)
    assert resp.status_code == 401
