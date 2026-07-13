import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_organization_and_matter_lifecycle(client: AsyncClient):
    # Register & Login first
    register_payload = {
        "email": "sarah@firm.com",
        "password": "strongpassword123",
        "full_name": "Sarah Partner",
    }
    await client.post("/api/v1/auth/register", json=register_payload)

    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "sarah@firm.com",
        "password": "strongpassword123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Onboard organization
    org_payload = {
        "name": "Sarah Partner LLC",
        "slug": "sarah-partner"
    }
    org_resp = await client.post("/api/v1/organizations", json=org_payload, headers=headers)
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    # Re-login to get token with organization claim
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "sarah@firm.com",
        "password": "strongpassword123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Matter
    matter_payload = {
        "title": "Sarah Matter Alpha",
        "description": "Litigation alpha",
        "matter_number": "MTR-A-001"
    }
    matter_resp = await client.post("/api/v1/matters", json=matter_payload, headers=headers)
    assert matter_resp.status_code == 201
    matter_data = matter_resp.json()
    assert matter_data["title"] == "Sarah Matter Alpha"
    assert matter_data["organization_id"] == org_id
